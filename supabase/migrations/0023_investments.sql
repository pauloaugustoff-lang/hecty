-- Carteira de investimentos ------------------------------------------------
-- Até aqui um investimento só existia como LANÇAMENTO (natureza
-- aplicacao_financeira / resgate_investimento) — o dinheiro saindo e voltando
-- da conta. Não havia o ATIVO em si, então não dava para saber quanto a
-- carteira vale hoje. Estas tabelas introduzem a posição:
--
--   investment_assets    o que você tem (PETR4, um CDB do Inter, VOO)
--   investment_movements o que aconteceu com ele (aporte, resgate, provento…)
--   asset_quotes         cache de cotação por símbolo/data (dado público)
--   index_rates          séries CDI/Selic/IPCA/poupança do BCB (dado público)
--
-- O vínculo com Transações é opcional e vive em movements.transaction_id: nem
-- todo movimento toca a conta bancária (dividendo reinvestido, bonificação,
-- desdobramento) e nem toda transação de investimento precisa estar detalhada.

-- Enums --------------------------------------------------------------------

create type asset_class as enum (
  'acao',
  'fii',
  'etf',
  'bdr',
  'stock',
  'reit',
  'fundo',
  'tesouro_direto',
  'cdb',
  'lci_lca',
  'cri_cra',
  'debenture',
  'poupanca',
  'previdencia',
  'cripto',
  'outro'
);

-- Como o saldo atual do ativo é calculado. É isto — e não a classe — que
-- decide qual motor roda: a classe é rótulo, o modo é comportamento.
--   cotacao  quantidade x último preço de mercado
--   indexado principal corrigido por um índice (renda fixa)
--   manual   você informa o saldo atual quando quiser
create type asset_pricing_mode as enum ('cotacao', 'indexado', 'manual');

create type investment_index as enum ('prefixado', 'cdi', 'ipca', 'selic', 'poupanca');

create type investment_movement_type as enum (
  'aporte',
  'resgate',
  'provento',
  'bonificacao',
  'desdobramento',
  'taxa',
  'imposto',
  'ajuste'
);

-- Ativos -------------------------------------------------------------------

create table investment_assets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,

  name text not null,
  asset_class asset_class not null default 'outro',
  pricing_mode asset_pricing_mode not null default 'manual',
  currency char(3) not null default 'BRL',

  -- pricing_mode = 'cotacao'
  ticker text,
  -- Símbolo no provedor de cotação (ex.: PETR4.SA, VOO, BTC-USD). Fica
  -- separado do ticker porque o sufixo do provedor não é o nome do papel.
  quote_symbol text,

  -- pricing_mode = 'indexado'
  rate_index investment_index,
  -- % do índice: 110 = 110% do CDI. Nulo quando a remuneração é índice + spread.
  rate_percent numeric(10,4),
  -- Spread anual somado ao índice: IPCA + 5,5 => 5.5. Em 'prefixado' é a
  -- própria taxa anual.
  rate_spread numeric(10,4),
  issue_date date,
  maturity_date date,
  is_tax_exempt boolean not null default false,

  -- pricing_mode = 'manual'
  manual_value_cents bigint,
  manual_value_date date,

  account_id uuid references accounts (id) on delete set null,
  institution text not null default '',
  notes text not null default '',
  color text not null default '#109b7e',
  is_archived boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_assets_cotacao_needs_symbol check (
    pricing_mode <> 'cotacao' or coalesce(quote_symbol, ticker) is not null
  ),
  constraint investment_assets_indexado_needs_index check (
    pricing_mode <> 'indexado' or rate_index is not null
  )
);

create index investment_assets_space_id_idx on investment_assets (space_id);
create index investment_assets_quote_symbol_idx on investment_assets (quote_symbol)
  where quote_symbol is not null;

-- Movimentos ---------------------------------------------------------------

create table investment_movements (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  asset_id uuid not null references investment_assets (id) on delete cascade,

  movement_type investment_movement_type not null,
  movement_date date not null,

  -- Quantidade de cotas/ações. Renda fixa indexada trabalha só com valor, e
  -- aí fica 0. 8 casas para caber cripto (0,00000001 BTC).
  quantity numeric(24,8) not null default 0,
  unit_price_cents bigint,

  -- Valor financeiro bruto do movimento, sempre positivo — o sinal vem do
  -- movement_type, não do número (mesma escolha de transactions.amount_cents).
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  fees_cents bigint not null default 0 check (fees_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),

  -- Só em 'desdobramento': 10 para um split 1:10, 0.1 para um grupamento 10:1.
  split_factor numeric(12,6),

  transaction_id uuid references transactions (id) on delete set null,
  notes text not null default '',

  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_movements_split_factor check (
    (movement_type = 'desdobramento' and split_factor is not null and split_factor > 0)
    or (movement_type <> 'desdobramento' and split_factor is null)
  )
);

create index investment_movements_space_id_idx on investment_movements (space_id);
create index investment_movements_asset_id_idx on investment_movements (asset_id, movement_date);
create index investment_movements_transaction_id_idx on investment_movements (transaction_id)
  where transaction_id is not null;

-- Cache de cotações --------------------------------------------------------
-- Dado público de mercado, não dado do usuário: a chave é o símbolo, sem
-- space_id, para que o mesmo PETR4.SA sirva a todos os espaços. Por isso o
-- RLS abaixo só concede SELECT — a escrita passa pela service role em
-- refreshQuotes(), senão qualquer membro poderia envenenar o preço alheio.
create table asset_quotes (
  symbol text not null,
  quote_date date not null,
  -- Menor unidade da moeda da COTAÇÃO (centavos de BRL/USD). Ativos cotados
  -- abaixo de um centavo não são suportados.
  close_cents bigint not null,
  currency char(3) not null default 'BRL',
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  primary key (symbol, quote_date)
);

-- Séries de índice ---------------------------------------------------------
-- Também dado público (SGS do Banco Central). CDI e Selic vêm como taxa
-- DIÁRIA de dia útil; IPCA e poupança, como variação MENSAL — o motor de
-- renda fixa em src/lib/investments/fixed-income.ts sabe dessa diferença.
create table index_rates (
  index_code investment_index not null,
  reference_date date not null,
  rate_percent numeric(18,10) not null,
  fetched_at timestamptz not null default now(),
  primary key (index_code, reference_date)
);

create trigger investment_assets_set_updated_at before update on investment_assets
  for each row execute function set_updated_at();
create trigger investment_movements_set_updated_at before update on investment_movements
  for each row execute function set_updated_at();

-- RLS ----------------------------------------------------------------------

alter table investment_assets enable row level security;
alter table investment_movements enable row level security;
alter table asset_quotes enable row level security;
alter table index_rates enable row level security;

create policy investment_assets_select on investment_assets for select
  using (is_space_member(space_id));
create policy investment_assets_insert on investment_assets for insert
  with check (can_edit_space(space_id));
create policy investment_assets_update on investment_assets for update
  using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy investment_assets_delete on investment_assets for delete
  using (can_edit_space(space_id));

create policy investment_movements_select on investment_movements for select
  using (is_space_member(space_id));
create policy investment_movements_insert on investment_movements for insert
  with check (can_edit_space(space_id));
create policy investment_movements_update on investment_movements for update
  using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy investment_movements_delete on investment_movements for delete
  using (can_edit_space(space_id));

create policy asset_quotes_select on asset_quotes for select
  to authenticated using (true);

create policy index_rates_select on index_rates for select
  to authenticated using (true);

-- Grants -------------------------------------------------------------------
-- As tabelas antigas do projeto nasceram quando o Supabase expunha na Data API
-- tudo o que fosse criado no schema public. Esse padrão mudou: tabela nova NÃO
-- é alcançável por anon/authenticated/service_role sem GRANT explícito (ver o
-- comentário de auto_expose_new_tables em supabase/config.toml). Sem o bloco
-- abaixo, todo acesso a estas quatro tabelas volta "permission denied" mesmo
-- com o RLS correto — e o RLS continua sendo quem decide as LINHAS; o grant só
-- abre a porta da tabela.

grant select, insert, update, delete on investment_assets to authenticated;
grant select, insert, update, delete on investment_movements to authenticated;

-- Dado público de mercado: quem está logado lê, mas só a service role escreve
-- (é o que impede um membro de um espaço de alterar o preço visto por outro).
grant select on asset_quotes to authenticated;
grant select on index_rates to authenticated;

grant all on investment_assets, investment_movements, asset_quotes, index_rates to service_role;
