# Hecty

Sistema web de controle financeiro pessoal: importação, classificação e
análise de receitas, despesas, transferências e movimentações de
investimento. Multiusuário desde o início, organizado por **espaços
financeiros** com permissões por papel e isolamento real via Row Level
Security no Postgres.

Este é o primeiro ciclo do produto — o planner. Uma camada de
acompanhamento de investimentos (posições, rentabilidade de carteira)
está prevista para um ciclo futuro; a página **Investimentos** já existe
como espaço reservado.

## Identidade visual

Marca **Hecty** (anagrama de Tyche — prosperidade como resultado de
organização, não de acaso). Arquivos originais em `public/brand/`
(nunca redesenhados, apenas redimensionados) e uma folha de referência
completa (paleta, tipografia, aplicações) em `design/hecty-brandsheet-reference.png`.

- Tokens de cor/tipografia/sombra em `src/app/globals.css` (paleta oficial: navy `#0B1D3A`, azul `#1E4DB7`, esmeralda `#109B7E` — reservado a rendimento/resultado positivo, nunca decorativo).
- Tipografia: **Sora** (títulos e números financeiros de destaque) + **Inter** (interface, tabelas, formulários), ambas via `next/font/google` em `src/app/layout.tsx`.
- Componente `<Logo />` (`src/components/ui/logo.tsx`) troca automaticamente entre a versão para fundo claro e a reversa conforme o tema.
- `favicon.ico`, `icon.png`, `apple-icon.png` e `opengraph-image.png` em `src/app/` são gerados a partir dos assets originais por `scripts/generate-brand-assets.mjs` (rode `node scripts/generate-brand-assets.mjs` se os arquivos-fonte em `public/brand/` forem substituídos).

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **React 19**
- **Tailwind CSS v4** com tokens de design em `src/app/globals.css`
- **Supabase**: Postgres + Auth + Storage (upload dos arquivos de importação) + Row Level Security
- **Zod** para validação (client e server)
- **Recharts** para os gráficos do dashboard
- **Radix UI** para primitivas acessíveis (diálogo, select, dropdown, tabs, tooltip, switch, checkbox)
- **Vitest** para os testes de regra de negócio
- **pgTAP** para os testes de RLS e integridade no banco

## Arquitetura em uma página

- **Espaços financeiros** (`spaces`) são a unidade de isolamento — não o
  usuário. Toda entidade financeira (`accounts`, `cards`, `categories`,
  `transactions`, `rules`, `import_batches`, `budgets`, ...) pertence a um
  `space_id`. Um usuário pode pertencer a vários espaços, com papéis
  diferentes em cada um (`proprietario`, `administrador`, `editor`,
  `visualizador`).
- **RLS é a fonte de verdade do isolamento**, não o código da aplicação.
  Três funções `SECURITY DEFINER` (`is_space_member`, `can_edit_space`,
  `can_admin_space`, em `supabase/migrations/0007_rls_functions.sql`) são
  usadas por todas as políticas, evitando recursão de RLS ao consultar
  `space_members`.
- **Dinheiro nunca é ponto flutuante.** Todo valor monetário é um inteiro
  em centavos (`bigint` no banco, `number` inteiro no TypeScript). Veja
  `src/lib/money/money.ts`.
- **Movimentação de caixa ≠ receita.** A distinção central do produto —
  ver `src/lib/money/redemption.ts` e `src/lib/domain/dashboard-metrics.ts`.
  Um resgate de investimento só vira receita depois de decomposto em
  principal + rendimento líquido; até lá, fica como natureza
  `resgate_a_decompor` e não entra no resultado econômico.
- **Regras determinísticas antes de qualquer IA.** O motor de regras
  (`src/lib/rules/engine.ts`) é puro e testável; a camada de sugestão por
  IA fica para um ciclo futuro (o schema já tem `suggested_by_rule_id` e
  `nivel de confiança` é um conceito preparado na UI de revisão, não
  implementado).
- **Lógica de negócio pura e testável** vive em `src/lib/` separada de
  código Server Component/Server Action — é isso que permite testar
  cálculo financeiro, deduplicação e decomposição de resgate sem precisar
  de um banco rodando.

## Estrutura de pastas

```
src/
  app/
    (auth)/          login, cadastro, recuperar/redefinir senha, aceite de convite
    (app)/           área autenticada (layout com sidebar + topbar)
      visao-geral/   dashboard
      transacoes/    tabela densa + lançamento manual, transferência, pagamento de fatura
      importar/      assistente de importação (CSV/OFX/XLSX) + histórico de lotes
      revisar/       classificação em massa
      contas/ cartoes/
      planejamento/  orçamento por categoria e mês
      relatorios/
      regras/
      investimentos/ placeholder "em breve"
      configuracoes/ espaço, categorias, membros e convites, cadastro público
  components/
    ui/              primitivas de design system (Button, Input, Select, Dialog, Table, ...)
    layout/          shell da aplicação (AppChrome com sidebar responsiva)
    dashboard/       KPIs e gráficos
  lib/
    supabase/        clients (browser, server, admin) + tipos do banco
    money/           aritmética monetária e decomposição de resgate
    domain/          rótulos e a lógica de indicadores do dashboard
    import/          parsers (CSV/OFX/XLSX), normalização, dedup, pipeline
    rules/           motor de regras
    transactions/    transferências entre contas, ciclo de fatura do cartão
    data/            camada de acesso a dados (Server Components)
    demo/            gerador de dados de demonstração
supabase/
  migrations/        schema versionado (extensões → tabelas → RLS → funções)
  tests/database/    testes pgTAP de RLS e integridade
```

## Configuração

### 1. Pré-requisitos

- Node.js 20.9+ (o projeto já foi testado com Node 24)
- Uma conta e um projeto no [supabase.com](https://supabase.com) — crie um
  projeto **dedicado** a este produto (não reaproveite um projeto de
  outro sistema).

### 2. Variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Preencha `.env.local` com os dados do seu projeto (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

A `SUPABASE_SERVICE_ROLE_KEY` é usada apenas em `src/lib/supabase/admin.ts`
(hoje, só para alternar o cadastro público) e nunca é enviada ao
navegador — o arquivo importa `"server-only"` para garantir isso em
tempo de build.

### 3. Aplicar as migrations

Com a [CLI do Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started)
(pode ser usada via `npx`, sem instalar globalmente):

```bash
npx supabase login
npx supabase link --project-ref SEU-PROJECT-REF
npx supabase db push
```

Isso cria todo o schema: enums, tabelas, RLS, funções, o bucket de
storage `imports` e o gatilho que provisiona o espaço pessoal no
primeiro cadastro.

### 4. Instalar dependências e rodar

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, crie uma conta — um espaço financeiro
pessoal com a taxonomia padrão de categorias é criado automaticamente.

### 5. Dados de demonstração (opcional)

Depois de logado, em **Configurações → Dados de demonstração**, clique em
"Carregar dados de demonstração". Isso cria um **novo espaço financeiro
separado**, marcado internamente como demonstração (`is_demo = true`),
com contas, cartão, ~3 meses de lançamentos e um exemplo completo de
resgate decomposto (R$ 105.000 no extrato = R$ 100.000 de principal +
R$ 5.000 de receita) — nunca mistura com dados reais.

## Scripts

```bash
npm run dev         # servidor de desenvolvimento (Turbopack)
npm run build        # build de produção
npm run lint          # ESLint
npm run typecheck    # tsc --noEmit
npm test              # testes de regra de negócio (Vitest)
npm run test:watch   # Vitest em modo watch
```

## Testes

**Regras financeiras, deduplicação, decomposição de resgate, motor de
regras, transferências, importação (`npm test`)** — 83+ testes Vitest
cobrindo lógica pura em `src/lib/`, sem precisar de banco. Rodados e
verificados neste repositório.

**RLS e integridade do banco (`supabase/tests/database/*.sql`, pgTAP)** —
cobrem isolamento entre espaços, permissões por papel (visualizador não
escreve, editor não apaga, proprietário pode tudo), hierarquia de
categorias, invariantes de transação (conta XOR cartão, valor > 0,
subcategoria pertence à categoria) e o fluxo de aceite de convite. Exigem
um stack Supabase local via Docker (`supabase start`), que não estava
disponível no ambiente onde este projeto foi desenvolvido — **foram
escritos e revisados, mas ainda não executados**. Rode-os antes de
confiar neles em produção:

```bash
supabase start
supabase test db
```

## Decisões e limitações conhecidas do primeiro ciclo

- **Leitura de PDF não está implementada.** O schema (`import_source_type`)
  já reserva o valor `pdf`, e a mensagem de erro do assistente já orienta
  o usuário a usar CSV/OFX/XLSX por enquanto.
- **Camada de IA para sugestão de classificação não está implementada.**
  O schema já tem os campos necessários (`suggested_by_rule_id`, e a
  central de revisão já mostra "origem da sugestão"); apenas regras
  determinísticas classificam hoje.
- **Cadastro público** é controlado por uma linha em `app_settings`
  (lida com a chave anônima, alterada apenas via chave de serviço). Para
  reforço adicional, desative também "Enable email signups" nas
  configurações de Auth do projeto Supabase.
- **Relatórios** cobre evolução de receitas/despesas, maiores variações
  mês a mês e despesas recorrentes. Os demais recortes citados no briefing
  original (ex. evolução patrimonial simplificada) reaproveitam os mesmos
  componentes de gráfico e podem ser adicionados incrementalmente.
