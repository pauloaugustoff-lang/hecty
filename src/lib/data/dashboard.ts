import { createClient } from "@/lib/supabase/server";
import { computeDashboardMetrics, type DashboardTransactionInput, type DashboardMetrics } from "@/lib/domain/dashboard-metrics";
import { analyzeRedemption } from "@/lib/money/redemption";
import { format, startOfMonth, subMonths } from "date-fns";

const REIMBURSING_NATURES = ["reembolso", "estorno"] as const;

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

// Filtra e agrupa por competence_date, não movement_date: uma compra no
// cartão conta como despesa/saída de caixa no mês em que a fatura vence
// (é quando o dinheiro efetivamente sai da conta), não no mês da compra.
// Para qualquer lançamento não ligado a cartão, competence_date é sempre
// igual a movement_date, então o comportamento não muda.
async function fetchTransactions(spaceId: string, from: string, to: string): Promise<RawTx[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, amount_cents, direction, nature, classification_status, movement_date, competence_date, category_id, category:categories!transactions_category_id_fkey(name, color), subcategory_id, subcategory:categories!transactions_subcategory_id_fkey(name, color), redemption_details(*)",
    )
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .gte("competence_date", from)
    .lte("competence_date", to);

  if (error) throw error;
  const rows = (data as unknown as RawTx[]) ?? [];
  return applyReimbursementAbatement(spaceId, rows);
}

// Um reembolso/estorno vinculado a uma ou mais despesas (ex.: mãe reembolsa
// metade do plano de saúde, ou uma única transferência cobre dois boletos)
// abate o valor de cada despesa em vez de só contar como receita à parte —
// senão a categoria mostraria o gasto bruto, não o custo real. O vínculo
// pode atravessar períodos (despesa em junho, reembolso em julho), então a
// consulta abaixo não é filtrada por competence_date.
async function applyReimbursementAbatement(spaceId: string, rows: RawTx[]): Promise<RawTx[]> {
  const despesaIds = rows.filter((r) => r.nature === "despesa").map((r) => r.id);
  if (despesaIds.length === 0) return rows;

  const supabase = await createClient();
  const { data: links } = await supabase
    .from("transaction_reimbursement_links")
    .select("expense_transaction_id, allocated_amount_cents, reimbursement_transaction_id")
    .eq("space_id", spaceId)
    .in("expense_transaction_id", despesaIds);

  if (!links?.length) return rows;

  const reductionByDespesaId = new Map<string, number>();
  const reimbursementIds = new Set<string>();
  for (const link of links) {
    reductionByDespesaId.set(link.expense_transaction_id, (reductionByDespesaId.get(link.expense_transaction_id) ?? 0) + link.allocated_amount_cents);
    reimbursementIds.add(link.reimbursement_transaction_id);
  }

  return rows
    .map((row) => {
      if (row.nature === "despesa" && reductionByDespesaId.has(row.id)) {
        return { ...row, amount_cents: Math.max(0, row.amount_cents - reductionByDespesaId.get(row.id)!) };
      }
      return row;
    })
    // Remove reembolsos/estornos já contabilizados acima (via redução na
    // despesa) que por acaso também caíram neste mesmo período consultado —
    // senão contariam duas vezes: uma como redução, outra como receita própria.
    .filter((row) => !((REIMBURSING_NATURES as readonly string[]).includes(row.nature) && reimbursementIds.has(row.id)));
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

export async function getExpenseBreakdown(spaceId: string, from: string, to: string): Promise<CategoryBreakdownPoint[]> {
  const rows = await fetchTransactions(spaceId, from, to);
  const buckets = new Map<string, CategoryBreakdownPoint>();
  const subBuckets = new Map<string, Map<string, SubcategoryBreakdownPoint>>();

  for (const row of rows) {
    if (row.nature !== "despesa" || row.direction !== "saida") continue;

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
