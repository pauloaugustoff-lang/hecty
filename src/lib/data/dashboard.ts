import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows, chunk } from "@/lib/supabase/fetch-all";
import { computeDashboardMetrics, type DashboardTransactionInput, type DashboardMetrics } from "@/lib/domain/dashboard-metrics";
import { analyzeRedemption } from "@/lib/money/redemption";
import { REVENUE_NATURES } from "@/lib/domain/labels";
import { listTags } from "@/lib/data/tags";
import { format, startOfMonth, subMonths } from "date-fns";

const REIMBURSING_NATURES = ["reembolso", "estorno"] as const;
// Categoria sintética (não existe no banco) pro excedente de um reembolso/
// estorno maior que a despesa vinculada — fica destacado no painel em vez de
// cair em "Sem categoria" junto com lançamentos realmente sem classificação.
const LEFTOVER_REIMBURSEMENT_CATEGORY_ID = "__reembolso_a_maior__";

interface RawTx {
  id: string;
  amount_cents: number;
  direction: "entrada" | "saida";
  nature: DashboardTransactionInput["nature"];
  classification_status: DashboardTransactionInput["classificationStatus"];
  movement_date: string;
  competence_date: string;
  category_id: string | null;
  category: { name: string; color: string } | null;
  subcategory_id: string | null;
  subcategory: { name: string; color: string } | null;
  tags: string[];
  // redemption_details.transaction_id é chave primária (relação 1:1), então
  // o PostgREST retorna um objeto único aqui, não um array.
  redemption_details: {
    total_amount_cents: number;
    principal_cents: number | null;
    net_yield_cents: number | null;
    gross_yield_cents: number | null;
    tax_cents: number | null;
    fees_cents: number | null;
  } | null;
}

// Painéis agregados (Resultado econômico, Gastos por categoria etc.) ainda
// somam amount_cents cru, assumindo uma única moeda — conversão automática
// entre moedas ainda não existe. Até existir, lançamentos de contas (ou
// cartões pagos por uma conta) que não sejam BRL ficam de fora dessas somas,
// em vez de contar errado como se fossem reais.
export const getNonBrlAccountAndCardIds = cache(
  async (spaceId: string): Promise<{ accountIds: Set<string>; cardIds: Set<string> }> => {
    const supabase = await createClient();
    const [{ data: accounts }, { data: cards }] = await Promise.all([
      supabase.from("accounts").select("id, currency").eq("space_id", spaceId),
      supabase.from("cards").select("id, payment_account_id").eq("space_id", spaceId),
    ]);

    const nonBrlAccountIds = new Set((accounts ?? []).filter((a) => a.currency !== "BRL").map((a) => a.id));
    const cardIds = new Set(
      (cards ?? []).filter((c) => c.payment_account_id && nonBrlAccountIds.has(c.payment_account_id)).map((c) => c.id),
    );
    return { accountIds: nonBrlAccountIds, cardIds };
  },
);

// Filtra e agrupa por competence_date, não movement_date: uma compra no
// cartão conta como despesa/saída de caixa no mês em que a fatura vence
// (é quando o dinheiro efetivamente sai da conta), não no mês da compra.
// Para qualquer lançamento não ligado a cartão, competence_date é sempre
// igual a movement_date, então o comportamento não muda.
//
// Paginado via fetchAllRows (janelas de 6–12 meses passam fácil do max_rows
// de 1000 do PostgREST, que truncaria a resposta sem erro) e memoizado com
// React cache() — a Visão Geral chama isto 5x com a mesma janela num único
// render; sem o cache eram 5 consultas pesadas idênticas por carregamento.
// Exportado para o Planejamento (budgets.ts) reutilizar em vez de duplicar
// o abatimento de reembolso e a exclusão de moedas não-BRL.
export const fetchTransactions = cache(async (spaceId: string, from: string, to: string): Promise<RawTx[]> => {
  const supabase = await createClient();
  const [allRows, { accountIds: nonBrlAccountIds, cardIds: nonBrlCardIds }] = await Promise.all([
    fetchAllRows<RawTx & { account_id: string | null; card_id: string | null }>((pageFrom, pageTo) =>
      supabase
        .from("transactions")
        .select(
          "id, amount_cents, direction, nature, classification_status, movement_date, competence_date, category_id, category:categories!transactions_category_id_fkey(name, color), subcategory_id, subcategory:categories!transactions_subcategory_id_fkey(name, color), tags, account_id, card_id, redemption_details(*)",
        )
        .eq("space_id", spaceId)
        .is("deleted_at", null)
        .gte("competence_date", from)
        .lte("competence_date", to)
        .order("id")
        .range(pageFrom, pageTo),
    ),
    getNonBrlAccountAndCardIds(spaceId),
  ]);

  const rows = allRows.filter(
    (row) => !(row.account_id && nonBrlAccountIds.has(row.account_id)) && !(row.card_id && nonBrlCardIds.has(row.card_id)),
  );
  return applyReimbursementAbatement(spaceId, rows);
});

interface ReimbursementLink {
  id: string;
  expense_transaction_id: string;
  allocated_amount_cents: number;
  reimbursement_transaction_id: string;
  // Valor da despesa vinculada — necessário quando ela está fora da janela
  // consultada (despesa em junho, reembolso em julho).
  expense: { amount_cents: number } | null;
}

const LINK_SELECT =
  "id, expense_transaction_id, allocated_amount_cents, reimbursement_transaction_id, expense:transactions!expense_transaction_id(amount_cents)";

// Um reembolso/estorno vinculado a uma ou mais despesas (ex.: mãe reembolsa
// metade do plano de saúde, ou uma única transferência cobre dois boletos)
// abate o valor de cada despesa em vez de só contar como receita à parte —
// senão a categoria mostraria o gasto bruto, não o custo real. Os vínculos
// são buscados pelos DOIS lados: pelas despesas da janela (para abater) e
// pelos reembolsos da janela (para não recontar como receita um reembolso
// cuja despesa está em OUTRO período — antes disso o mesmo valor abatia a
// despesa em junho E contava como receita cheia em julho). Ids em blocos
// pra não estourar o limite de tamanho de URL do PostgREST.
async function applyReimbursementAbatement(spaceId: string, rows: RawTx[]): Promise<RawTx[]> {
  const despesaIds = rows.filter((r) => r.nature === "despesa").map((r) => r.id);
  const reimbRowIds = rows
    .filter((r) => (REIMBURSING_NATURES as readonly string[]).includes(r.nature))
    .map((r) => r.id);
  if (despesaIds.length === 0 && reimbRowIds.length === 0) return rows;

  const supabase = await createClient();
  const results = await Promise.all([
    ...chunk(despesaIds, 200).map((ids) =>
      supabase.from("transaction_reimbursement_links").select(LINK_SELECT).eq("space_id", spaceId).in("expense_transaction_id", ids),
    ),
    ...chunk(reimbRowIds, 200).map((ids) =>
      supabase.from("transaction_reimbursement_links").select(LINK_SELECT).eq("space_id", spaceId).in("reimbursement_transaction_id", ids),
    ),
  ]);

  const linkById = new Map<string, ReimbursementLink>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const link of (data as unknown as ReimbursementLink[]) ?? []) {
      linkById.set(link.id, link);
    }
  }
  if (linkById.size === 0) return rows;
  // Ordem determinística: a absorção percorre os vínculos acumulando redução
  // por despesa, então a ordem afeta qual reembolso fica com o excedente.
  const links = Array.from(linkById.values()).sort((a, b) => a.id.localeCompare(b.id));

  const despesaAmountById = new Map(rows.filter((r) => r.nature === "despesa").map((r) => [r.id, r.amount_cents]));
  for (const link of links) {
    if (!despesaAmountById.has(link.expense_transaction_id)) {
      despesaAmountById.set(link.expense_transaction_id, link.expense?.amount_cents ?? 0);
    }
  }
  const reductionByDespesaId = new Map<string, number>();
  // Quando o reembolso/estorno vinculado é maior que a despesa que ele cobre
  // (ex.: R$130 de reembolso para uma despesa de R$100), o excedente não pode
  // simplesmente sumir: a despesa abate só até zero, e a diferença volta a
  // contar como receita própria do lançamento de reembolso/estorno.
  const leftoverByReimbursementId = new Map<string, number>();
  for (const link of links) {
    const despesaAmount = despesaAmountById.get(link.expense_transaction_id) ?? 0;
    const alreadyReduced = reductionByDespesaId.get(link.expense_transaction_id) ?? 0;
    const remainingDespesaAmount = Math.max(0, despesaAmount - alreadyReduced);
    const absorbed = Math.min(remainingDespesaAmount, link.allocated_amount_cents);
    const leftover = link.allocated_amount_cents - absorbed;
    reductionByDespesaId.set(link.expense_transaction_id, alreadyReduced + absorbed);
    if (leftover > 0) {
      leftoverByReimbursementId.set(
        link.reimbursement_transaction_id,
        (leftoverByReimbursementId.get(link.reimbursement_transaction_id) ?? 0) + leftover,
      );
    }
  }

  const reimbursementIds = new Set(links.map((l) => l.reimbursement_transaction_id));

  return rows
    .map((row) => {
      if (row.nature === "despesa" && reductionByDespesaId.has(row.id)) {
        return { ...row, amount_cents: Math.max(0, row.amount_cents - reductionByDespesaId.get(row.id)!) };
      }
      // Reembolso/estorno já contabilizado acima (via redução na despesa) não
      // pode contar de novo pelo próprio valor — mas se sobrou excedente não
      // absorvido por nenhuma despesa, esse resto conta como receita própria,
      // sob uma categoria sintética própria (em vez da categoria real do
      // lançamento, que costuma estar vazia ou não fazer sentido pra esse
      // valor específico — é o excedente, não a categoria original).
      if ((REIMBURSING_NATURES as readonly string[]).includes(row.nature) && reimbursementIds.has(row.id)) {
        return {
          ...row,
          amount_cents: leftoverByReimbursementId.get(row.id) ?? 0,
          category_id: LEFTOVER_REIMBURSEMENT_CATEGORY_ID,
          category: { name: "Reembolso a maior", color: "#f59e0b" },
          subcategory_id: null,
          subcategory: null,
        };
      }
      return row;
    })
    .filter((row) => !((REIMBURSING_NATURES as readonly string[]).includes(row.nature) && reimbursementIds.has(row.id) && row.amount_cents === 0));
}

function toDashboardInput(tx: RawTx): DashboardTransactionInput {
  const redemptionRow = tx.redemption_details;
  const redemption = redemptionRow
    ? analyzeRedemption({
        totalAmountCents: redemptionRow.total_amount_cents,
        principalCents: redemptionRow.principal_cents,
        grossYieldCents: redemptionRow.gross_yield_cents,
        taxCents: redemptionRow.tax_cents,
        feesCents: redemptionRow.fees_cents,
        netYieldCents: redemptionRow.net_yield_cents,
      })
    : null;

  return {
    amountCents: tx.amount_cents,
    direction: tx.direction,
    nature: tx.nature,
    classificationStatus: tx.classification_status,
    redemption,
  };
}

export async function getDashboardMetrics(spaceId: string, from: string, to: string): Promise<DashboardMetrics> {
  const rows = await fetchTransactions(spaceId, from, to);
  return computeDashboardMetrics(rows.map(toDashboardInput));
}

export interface MonthlyPoint {
  month: string;
  label: string;
  receitas: number;
  despesas: number;
}

export async function getMonthlySeries(spaceId: string, monthsBack = 6): Promise<MonthlyPoint[]> {
  const now = new Date();
  const from = format(startOfMonth(subMonths(now, monthsBack - 1)), "yyyy-MM-dd");
  const to = format(now, "yyyy-MM-dd");

  const rows = await fetchTransactions(spaceId, from, to);

  const buckets = new Map<string, { receitas: number; despesas: number }>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const key = format(startOfMonth(subMonths(now, i)), "yyyy-MM");
    buckets.set(key, { receitas: 0, despesas: 0 });
  }

  for (const row of rows) {
    const key = row.competence_date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const input = toDashboardInput(row);
    const metrics = computeDashboardMetrics([input]);
    bucket.receitas += metrics.receitasEfetivasCents;
    bucket.despesas += metrics.despesasCents;
  }

  return Array.from(buckets.entries()).map(([month, values]) => ({
    month,
    label: format(new Date(`${month}-01T00:00:00`), "MMM"),
    ...values,
  }));
}

export interface SubcategoryBreakdownPoint {
  subcategoryId: string;
  name: string;
  color: string;
  amountCents: number;
}

export interface CategoryBreakdownPoint {
  categoryId: string;
  name: string;
  color: string;
  amountCents: number;
  subcategories: SubcategoryBreakdownPoint[];
}

function buildCategoryBreakdown(
  rows: RawTx[],
  direction: "entrada" | "saida",
  includesNature: (nature: string) => boolean,
): CategoryBreakdownPoint[] {
  const buckets = new Map<string, CategoryBreakdownPoint>();
  const subBuckets = new Map<string, Map<string, SubcategoryBreakdownPoint>>();

  for (const row of rows) {
    if (row.direction !== direction || !includesNature(row.nature)) continue;

    const key = row.category_id ?? "sem-categoria";
    const name = row.category?.name ?? "Sem categoria";
    const color = row.category?.color ?? "#94a3b8";

    const existing = buckets.get(key);
    if (existing) {
      existing.amountCents += row.amount_cents;
    } else {
      buckets.set(key, { categoryId: key, name, color, amountCents: row.amount_cents, subcategories: [] });
    }

    const subKey = row.subcategory_id ?? "sem-subcategoria";
    const subName = row.subcategory?.name ?? "Sem subcategoria";
    const subColor = row.subcategory?.color ?? color;

    if (!subBuckets.has(key)) subBuckets.set(key, new Map());
    const subMap = subBuckets.get(key)!;
    const existingSub = subMap.get(subKey);
    if (existingSub) {
      existingSub.amountCents += row.amount_cents;
    } else {
      subMap.set(subKey, { subcategoryId: subKey, name: subName, color: subColor, amountCents: row.amount_cents });
    }
  }

  return Array.from(buckets.values())
    .map((category) => ({
      ...category,
      subcategories: Array.from(subBuckets.get(category.categoryId)?.values() ?? []).sort((a, b) => b.amountCents - a.amountCents),
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export async function getExpenseBreakdown(spaceId: string, from: string, to: string): Promise<CategoryBreakdownPoint[]> {
  const rows = await fetchTransactions(spaceId, from, to);
  return buildCategoryBreakdown(rows, "saida", (nature) => nature === "despesa");
}

export async function getRevenueBreakdown(spaceId: string, from: string, to: string): Promise<CategoryBreakdownPoint[]> {
  const rows = await fetchTransactions(spaceId, from, to);
  const revenueNatures = new Set<string>(REVENUE_NATURES);
  return buildCategoryBreakdown(rows, "entrada", (nature) => revenueNatures.has(nature));
}

export async function getInvestmentBreakdown(spaceId: string, from: string, to: string): Promise<CategoryBreakdownPoint[]> {
  const rows = await fetchTransactions(spaceId, from, to);
  return buildCategoryBreakdown(rows, "saida", (nature) => nature === "aplicacao_financeira");
}

// Gasto por tag: marcação transversal a categoria (ex.: "Viagem Tiradentes"
// cobrindo hospedagem, restaurante, compras). Uma despesa pode ter mais de
// uma tag — nesse caso entra no total de cada uma (não divide o valor).
export async function getTagBreakdown(spaceId: string, from: string, to: string): Promise<CategoryBreakdownPoint[]> {
  const [rows, tags] = await Promise.all([fetchTransactions(spaceId, from, to), listTags(spaceId)]);
  const colorByTagName = new Map(tags.map((t) => [t.name, t.color]));

  const buckets = new Map<string, CategoryBreakdownPoint>();
  for (const row of rows) {
    if (row.direction !== "saida" || row.nature !== "despesa") continue;
    for (const tagName of row.tags) {
      const existing = buckets.get(tagName);
      if (existing) {
        existing.amountCents += row.amount_cents;
      } else {
        buckets.set(tagName, {
          categoryId: tagName,
          name: tagName,
          color: colorByTagName.get(tagName) ?? "#94a3b8",
          amountCents: row.amount_cents,
          subcategories: [],
        });
      }
    }
  }

  return Array.from(buckets.values()).sort((a, b) => b.amountCents - a.amountCents);
}
