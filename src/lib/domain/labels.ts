import type {
  AccountType,
  CardBrand,
  CategoryKind,
  ClassificationStatus,
  ImportRowStatus,
  ImportStatus,
  MemberRole,
  TransactionDirection,
  TransactionNature,
  TransactionOrigin,
} from "@/lib/supabase/types";

export const natureLabels: Record<TransactionNature, string> = {
  receita_trabalho: "Receita do trabalho",
  rendimento_investimento: "Rendimento de investimento",
  outras_receitas: "Outras receitas",
  despesa: "Despesa",
  transferencia_entre_contas: "Transferência entre contas",
  aplicacao_financeira: "Aplicação financeira",
  resgate_investimento: "Resgate de investimento",
  resgate_a_decompor: "Resgate a decompor",
  pagamento_cartao: "Pagamento de cartão",
  estorno: "Estorno",
  reembolso: "Reembolso",
  repasse: "Repasse a terceiros",
  emprestimo: "Empréstimo",
  ajuste: "Ajuste",
  nao_classificado: "Não classificado",
};

export type NatureTone = "positive" | "negative" | "pending" | "transfer" | "neutral";

export const natureTones: Record<TransactionNature, NatureTone> = {
  receita_trabalho: "positive",
  rendimento_investimento: "positive",
  outras_receitas: "positive",
  despesa: "negative",
  transferencia_entre_contas: "transfer",
  aplicacao_financeira: "transfer",
  resgate_investimento: "positive",
  resgate_a_decompor: "pending",
  pagamento_cartao: "transfer",
  estorno: "positive",
  reembolso: "positive",
  repasse: "neutral",
  emprestimo: "neutral",
  ajuste: "neutral",
  nao_classificado: "pending",
};

/** Naturezas que contam como receita efetiva no resultado econômico. */
export const REVENUE_NATURES: TransactionNature[] = [
  "receita_trabalho",
  "rendimento_investimento",
  "outras_receitas",
  "reembolso",
  "estorno",
];

/** Naturezas que contam como despesa no resultado econômico. */
export const EXPENSE_NATURES: TransactionNature[] = ["despesa"];

/** Naturezas que nunca entram no resultado econômico (não são receita nem despesa). */
export const NEUTRAL_NATURES: TransactionNature[] = [
  "transferencia_entre_contas",
  "aplicacao_financeira",
  "resgate_investimento",
  "resgate_a_decompor",
  "pagamento_cartao",
  "repasse",
  "emprestimo",
  "ajuste",
  "nao_classificado",
];

/**
 * Categoria compatível com uma natureza (pra filtrar o seletor de categoria e
 * não deixar, por ex., uma "Outras receitas" ser classificada com categoria
 * de despesa). Para naturezas ambíguas por si só (empréstimo, ajuste, não
 * classificado) usa a direção do lançamento quando disponível; sem direção,
 * retorna null e o chamador deve exibir todas as categorias sem filtrar.
 */
export function categoryKindForNature(nature: TransactionNature, direction?: TransactionDirection): CategoryKind | null {
  switch (nature) {
    case "aplicacao_financeira":
    case "resgate_investimento":
    case "resgate_a_decompor":
      return "investimento";
    case "despesa":
      return "despesa";
    case "receita_trabalho":
    case "rendimento_investimento":
    case "outras_receitas":
    case "reembolso":
    case "estorno":
      return "receita";
    case "transferencia_entre_contas":
    case "pagamento_cartao":
      return "transferencia";
    case "repasse":
    case "emprestimo":
    case "ajuste":
    case "nao_classificado":
      if (direction === "entrada") return "receita";
      if (direction === "saida") return "despesa";
      return null;
    default:
      return null;
  }
}

export const accountTypeLabels: Record<AccountType, string> = {
  corrente: "Conta corrente",
  pagamento: "Conta de pagamento",
  dinheiro: "Dinheiro",
  corretora: "Corretora",
  investimento: "Conta de investimento",
  outra: "Outra",
};

export const cardBrandLabels: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  elo: "Elo",
  amex: "American Express",
  hipercard: "Hipercard",
  outra: "Outra",
};

export const classificationStatusLabels: Record<ClassificationStatus, string> = {
  classificado: "Classificado",
  nao_classificado: "Não classificado",
  revisao_pendente: "Revisão pendente",
};

export const importStatusLabels: Record<ImportStatus, string> = {
  pendente: "Pendente",
  processando: "Processando",
  concluida: "Concluída",
  desfeita: "Desfeita",
  erro: "Erro",
};

export const importRowStatusLabels: Record<ImportRowStatus, string> = {
  pendente: "Pronto para importar",
  duplicata_possivel: "Possível duplicidade",
  duplicata_confirmada: "Duplicidade confirmada",
  importado: "Importado",
  ignorado: "Ignorado",
};

export const transactionOriginLabels: Record<TransactionOrigin, string> = {
  manual: "Manual",
  importada: "Importada",
};

export const memberRoleLabels: Record<MemberRole, string> = {
  proprietario: "Proprietário",
  administrador: "Administrador",
  editor: "Editor",
  visualizador: "Visualizador",
};

export const memberRoleDescriptions: Record<MemberRole, string> = {
  proprietario: "Controle total, incluindo excluir o espaço e transferir titularidade.",
  administrador: "Gerencia membros, dados financeiros e configurações.",
  editor: "Cria e edita contas, cartões, lançamentos, regras e importações.",
  visualizador: "Apenas consulta — não pode criar nem editar nada.",
};
