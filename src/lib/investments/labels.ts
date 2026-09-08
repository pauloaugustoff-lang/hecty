import type {
  AssetClass,
  AssetPricingMode,
  InvestmentIndex,
  InvestmentMovementType,
} from "@/lib/supabase/types";

export const assetClassLabels: Record<AssetClass, string> = {
  acao: "Ação",
  fii: "FII",
  etf: "ETF",
  bdr: "BDR",
  stock: "Ação no exterior",
  reit: "REIT",
  fundo: "Fundo de investimento",
  tesouro_direto: "Tesouro Direto",
  cdb: "CDB / RDB",
  lci_lca: "LCI / LCA",
  cri_cra: "CRI / CRA",
  debenture: "Debênture",
  poupanca: "Poupança",
  previdencia: "Previdência",
  cripto: "Criptomoeda",
  outro: "Outro",
};

/** Agrupamento usado na carteira — a classe é fina demais para ser a linha do resumo. */
export type AssetGroup = "renda_variavel" | "renda_fixa" | "fundos" | "cripto" | "outros";

export const assetGroupLabels: Record<AssetGroup, string> = {
  renda_variavel: "Renda variável",
  renda_fixa: "Renda fixa",
  fundos: "Fundos e previdência",
  cripto: "Criptomoedas",
  outros: "Outros",
};

export const assetGroupOrder: AssetGroup[] = ["renda_variavel", "renda_fixa", "fundos", "cripto", "outros"];

const GROUP_BY_CLASS: Record<AssetClass, AssetGroup> = {
  acao: "renda_variavel",
  fii: "renda_variavel",
  etf: "renda_variavel",
  bdr: "renda_variavel",
  stock: "renda_variavel",
  reit: "renda_variavel",
  tesouro_direto: "renda_fixa",
  cdb: "renda_fixa",
  lci_lca: "renda_fixa",
  cri_cra: "renda_fixa",
  debenture: "renda_fixa",
  poupanca: "renda_fixa",
  fundo: "fundos",
  previdencia: "fundos",
  cripto: "cripto",
  outro: "outros",
};

export function assetGroup(assetClass: AssetClass): AssetGroup {
  return GROUP_BY_CLASS[assetClass];
}

export const pricingModeLabels: Record<AssetPricingMode, string> = {
  cotacao: "Cotação de mercado",
  indexado: "Índice (renda fixa)",
  manual: "Saldo informado por você",
};

/**
 * Modo de precificação que faz sentido para a classe. É só o valor inicial do
 * formulário — quem manda é o pricing_mode gravado, porque exceções existem
 * (um CDB sem índice conhecido pode virar 'manual', um fundo com cota pública
 * pode virar 'cotacao').
 */
export function defaultPricingMode(assetClass: AssetClass): AssetPricingMode {
  switch (assetGroup(assetClass)) {
    case "renda_variavel":
    case "cripto":
      return "cotacao";
    case "renda_fixa":
      return "indexado";
    default:
      return "manual";
  }
}

export const investmentIndexLabels: Record<InvestmentIndex, string> = {
  prefixado: "Prefixado",
  cdi: "CDI",
  ipca: "IPCA",
  selic: "Selic",
  poupanca: "Poupança",
};

export const movementTypeLabels: Record<InvestmentMovementType, string> = {
  aporte: "Aporte",
  resgate: "Resgate / venda",
  provento: "Provento",
  bonificacao: "Bonificação",
  desdobramento: "Desdobramento",
  taxa: "Taxa",
  imposto: "Imposto",
  ajuste: "Ajuste",
};

/** Movimentos que mexem em quantidade — só eles pedem o campo de quantidade no formulário. */
export const QUANTITY_MOVEMENT_TYPES: InvestmentMovementType[] = [
  "aporte",
  "resgate",
  "bonificacao",
  "desdobramento",
  "ajuste",
];

/** Sentido do dinheiro no bolso: entrada, saída ou nenhum. */
export function movementCashDirection(type: InvestmentMovementType): "entrada" | "saida" | null {
  switch (type) {
    case "aporte":
    case "taxa":
    case "imposto":
      return "saida";
    case "resgate":
    case "provento":
      return "entrada";
    default:
      return null;
  }
}

/**
 * Descrição curta da remuneração combinada ("110% do CDI", "IPCA + 5,5% a.a.",
 * "Prefixado 12% a.a."), usada na listagem da carteira.
 */
export function rateSummary(asset: {
  rate_index: InvestmentIndex | null;
  rate_percent: number | null;
  rate_spread: number | null;
}): string | null {
  if (!asset.rate_index) return null;

  const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;

  if (asset.rate_index === "prefixado") {
    return asset.rate_spread !== null ? `Prefixado ${pct(asset.rate_spread)} a.a.` : "Prefixado";
  }

  const indexName = investmentIndexLabels[asset.rate_index];
  const parts: string[] = [];
  if (asset.rate_percent !== null) parts.push(`${pct(asset.rate_percent)} do ${indexName}`);
  else parts.push(indexName);
  if (asset.rate_spread) parts.push(`+ ${pct(asset.rate_spread)} a.a.`);
  return parts.join(" ");
}
