-- Extensions
create extension if not exists pgcrypto;

-- Enum types -----------------------------------------------------------

create type space_type as enum ('individual', 'compartilhado');

create type member_role as enum ('proprietario', 'administrador', 'editor', 'visualizador');

create type invite_status as enum ('pendente', 'aceito', 'revogado', 'expirado');

create type account_type as enum ('corrente', 'pagamento', 'dinheiro', 'corretora', 'investimento', 'outra');

create type card_brand as enum ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outra');

create type category_kind as enum ('despesa', 'receita', 'investimento', 'transferencia', 'outro');

create type transaction_direction as enum ('entrada', 'saida');

create type transaction_origin as enum ('manual', 'importada');

create type classification_status as enum ('classificado', 'nao_classificado', 'revisao_pendente');

-- Natureza econômica do lançamento — a distinção central do produto.
create type transaction_nature as enum (
  'receita_trabalho',
  'rendimento_investimento',
  'outras_receitas',
  'despesa',
  'transferencia_entre_contas',
  'aplicacao_financeira',
  'resgate_investimento',
  'resgate_a_decompor',
  'pagamento_cartao',
  'estorno',
  'reembolso',
  'emprestimo',
  'ajuste',
  'nao_classificado'
);

create type import_source_type as enum ('csv', 'ofx', 'xlsx', 'pdf');

create type import_status as enum ('pendente', 'processando', 'concluida', 'desfeita', 'erro');

create type import_row_status as enum ('pendente', 'duplicata_possivel', 'duplicata_confirmada', 'importado', 'ignorado');

create type rule_match_type as enum ('contem', 'comeca_com', 'termina_com', 'exato', 'regex');
