/**
 * Tipos do banco gerados manualmente a partir das migrations em
 * supabase/migrations. Quando o projeto Supabase estiver conectado,
 * substitua por `npx supabase gen types typescript --linked` e mantenha
 * este arquivo como fallback de desenvolvimento offline.
 */

export type SpaceType = "individual" | "compartilhado";
export type MemberRole = "proprietario" | "administrador" | "editor" | "visualizador";
export type InviteStatus = "pendente" | "aceito" | "revogado" | "expirado";
export type AccountType = "corrente" | "pagamento" | "dinheiro" | "corretora" | "investimento" | "outra";
export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "hipercard" | "outra";
export type CategoryKind = "despesa" | "receita" | "investimento" | "transferencia" | "outro";
export type TransactionDirection = "entrada" | "saida";
export type TransactionOrigin = "manual" | "importada";
export type ClassificationStatus = "classificado" | "nao_classificado" | "revisao_pendente";

export type TransactionNature =
  | "receita_trabalho"
  | "rendimento_investimento"
  | "outras_receitas"
  | "despesa"
  | "transferencia_entre_contas"
  | "aplicacao_financeira"
  | "resgate_investimento"
  | "resgate_a_decompor"
  | "pagamento_cartao"
  | "estorno"
  | "reembolso"
  | "emprestimo"
  | "ajuste"
  | "nao_classificado";

export type ImportSourceType = "csv" | "ofx" | "xlsx" | "pdf";
export type ImportStatus = "pendente" | "processando" | "concluida" | "desfeita" | "erro";
export type ImportRowStatus = "pendente" | "duplicata_possivel" | "duplicata_confirmada" | "importado" | "ignorado";
export type RuleMatchType = "contem" | "comeca_com" | "termina_com" | "exato" | "regex";

// Linhas de tabela, declaradas fora da interface Database para que Insert/
// Update possam referenciá-las sem indexação circular em Database[...]
// (postgrest-js resolve essa indexação para `never` quando há muitas
// referências circulares simultâneas dentro da própria definição).

export type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type AppSettingsRow = {
  id: number;
  public_signup_enabled: boolean;
  updated_at: string;
}

export type SpaceRow = {
  id: string;
  name: string;
  type: SpaceType;
  owner_id: string;
  is_demo: boolean;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export type SpaceMemberRow = {
  id: string;
  space_id: string;
  user_id: string;
  role: MemberRole;
  invited_by: string | null;
  created_at: string;
}

export type SpaceInviteRow = {
  id: string;
  space_id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  token: string;
  invited_by: string;
  accepted_by: string | null;
  created_at: string;
  expires_at: string;
}

export type CategoryRow = {
  id: string;
  space_id: string;
  parent_id: string | null;
  kind: CategoryKind;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type TagRow = {
  id: string;
  space_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type AccountRow = {
  id: string;
  space_id: string;
  name: string;
  institution: string;
  type: AccountType;
  initial_balance_cents: number;
  initial_balance_date: string;
  currency: string;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type CardRow = {
  id: string;
  space_id: string;
  name: string;
  institution: string;
  brand: CardBrand;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  payment_account_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export type TransactionRow = {
  id: string;
  space_id: string;
  account_id: string | null;
  card_id: string | null;
  movement_date: string;
  competence_date: string;
  original_description: string;
  normalized_description: string;
  amount_cents: number;
  direction: TransactionDirection;
  nature: TransactionNature;
  category_id: string | null;
  subcategory_id: string | null;
  counterparty: string;
  notes: string;
  origin: TransactionOrigin;
  classification_status: ClassificationStatus;
  installment_number: number | null;
  installment_total: number | null;
  installment_group_id: string | null;
  tags: string[];
  linked_transaction_id: string | null;
  paid_card_id: string | null;
  import_batch_id: string | null;
  import_external_id: string | null;
  dedup_hash: string;
  is_reconciled: boolean;
  classified_by_rule_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RedemptionDetailsRow = {
  transaction_id: string;
  space_id: string;
  total_amount_cents: number;
  principal_cents: number | null;
  gross_yield_cents: number | null;
  tax_cents: number | null;
  fees_cents: number | null;
  net_yield_cents: number | null;
  institution: string;
  product: string;
  application_date: string | null;
  redemption_date: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionReimbursementLinkRow = {
  id: string;
  space_id: string;
  reimbursement_transaction_id: string;
  expense_transaction_id: string;
  allocated_amount_cents: number;
  created_at: string;
}

export type ImportBatchRow = {
  id: string;
  space_id: string;
  source_type: ImportSourceType;
  file_name: string;
  account_id: string | null;
  card_id: string | null;
  status: ImportStatus;
  column_mapping: Record<string, string>;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  ignored_rows: number;
  created_by: string;
  created_at: string;
  undone_at: string | null;
  undone_by: string | null;
}

export type ImportBatchRowRow = {
  id: string;
  batch_id: string;
  space_id: string;
  row_index: number;
  raw_data: Record<string, unknown>;
  movement_date: string | null;
  competence_date: string | null;
  original_description: string;
  normalized_description: string;
  amount_cents: number | null;
  direction: TransactionDirection | null;
  external_id: string | null;
  dedup_hash: string | null;
  potential_duplicate_of: string | null;
  status: ImportRowStatus;
  suggested_nature: TransactionNature | null;
  suggested_category_id: string | null;
  suggested_subcategory_id: string | null;
  suggested_by_rule_id: string | null;
  resulting_transaction_id: string | null;
  created_at: string;
}

export type RuleRow = {
  id: string;
  space_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  match_type: RuleMatchType;
  match_values: string[];
  source_account_id: string | null;
  source_card_id: string | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  direction: TransactionDirection | null;
  action_nature: TransactionNature | null;
  action_category_id: string | null;
  action_subcategory_id: string | null;
  action_counterparty: string | null;
  action_tags: string[] | null;
  action_notes: string | null;
  action_mark_transfer: boolean;
  action_mark_redemption: boolean;
  times_applied: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type BudgetRow = {
  id: string;
  space_id: string;
  category_id: string;
  reference_month: string;
  planned_amount_cents: number;
  created_at: string;
  updated_at: string;
}

export type AuditLogRow = {
  id: string;
  space_id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSettingsRow;
        Insert: Partial<AppSettingsRow>;
        Update: Partial<AppSettingsRow>;
        Relationships: [];
      };
      spaces: {
        Row: SpaceRow;
        Insert: Partial<SpaceRow> & { name: string; owner_id: string };
        Update: Partial<SpaceRow>;
        Relationships: [];
      };
      space_members: {
        Row: SpaceMemberRow;
        Insert: Partial<SpaceMemberRow> & { space_id: string; user_id: string };
        Update: Partial<SpaceMemberRow>;
        Relationships: [];
      };
      space_invites: {
        Row: SpaceInviteRow;
        Insert: Partial<SpaceInviteRow> & { space_id: string; email: string; invited_by: string };
        Update: Partial<SpaceInviteRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Partial<CategoryRow> & { space_id: string; name: string };
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      tags: {
        Row: TagRow;
        Insert: Partial<TagRow> & { space_id: string; name: string };
        Update: Partial<TagRow>;
        Relationships: [];
      };
      accounts: {
        Row: AccountRow;
        Insert: Partial<AccountRow> & { space_id: string; name: string };
        Update: Partial<AccountRow>;
        Relationships: [];
      };
      cards: {
        Row: CardRow;
        Insert: Partial<CardRow> & { space_id: string; name: string; closing_day: number; due_day: number };
        Update: Partial<CardRow>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Partial<TransactionRow> & {
          space_id: string;
          movement_date: string;
          competence_date: string;
          amount_cents: number;
          direction: TransactionDirection;
          dedup_hash: string;
        };
        Update: Partial<TransactionRow>;
        Relationships: [];
      };
      redemption_details: {
        Row: RedemptionDetailsRow;
        Insert: Partial<RedemptionDetailsRow> & { transaction_id: string; space_id: string; total_amount_cents: number };
        Update: Partial<RedemptionDetailsRow>;
        Relationships: [];
      };
      transaction_reimbursement_links: {
        Row: TransactionReimbursementLinkRow;
        Insert: Partial<TransactionReimbursementLinkRow> & {
          space_id: string;
          reimbursement_transaction_id: string;
          expense_transaction_id: string;
          allocated_amount_cents: number;
        };
        Update: Partial<TransactionReimbursementLinkRow>;
        Relationships: [];
      };
      import_batches: {
        Row: ImportBatchRow;
        Insert: Partial<ImportBatchRow> & { space_id: string; source_type: ImportSourceType; file_name: string; created_by: string };
        Update: Partial<ImportBatchRow>;
        Relationships: [];
      };
      import_batch_rows: {
        Row: ImportBatchRowRow;
        Insert: Partial<ImportBatchRowRow> & { batch_id: string; space_id: string; row_index: number };
        Update: Partial<ImportBatchRowRow>;
        Relationships: [];
      };
      rules: {
        Row: RuleRow;
        Insert: Partial<RuleRow> & { space_id: string; name: string; match_values: string[]; created_by: string };
        Update: Partial<RuleRow>;
        Relationships: [];
      };
      budgets: {
        Row: BudgetRow;
        Insert: Partial<BudgetRow> & { space_id: string; category_id: string; reference_month: string; planned_amount_cents: number };
        Update: Partial<BudgetRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_space_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      get_invite_preview: {
        Args: { p_token: string };
        Returns: {
          space_name: string;
          role: MemberRole;
          status: InviteStatus;
          invited_by_name: string;
          expires_at: string;
        }[];
      };
    };
  };
}
