"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  investmentAssetFormSchema,
  investmentMovementFormSchema,
  type InvestmentAssetFormInput,
} from "@/lib/validation/schemas";
import { normalizeDescription } from "@/lib/import/normalize";
import { computeDedupHash } from "@/lib/import/dedup";
import { classificationStatusFor } from "@/lib/domain/classification";
import { revalidateTransactionData } from "@/lib/revalidate-financial";
import { movementCashDirection, movementTypeLabels } from "@/lib/investments/labels";
import { resolveQuoteSymbol } from "@/lib/investments/symbols";
import { fetchQuotes } from "@/lib/investments/quotes";
import { coverageStartDate, indexesInUse, listAssets, quoteSymbolsForSpace } from "@/lib/data/investments";
import { ensureIndexCoverage, saveQuotes } from "@/lib/data/market-data";
import type { InvestmentMovementType, TransactionNature } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function revalidateInvestmentData(): void {
  revalidatePath("/investimentos");
  revalidatePath("/investimentos/[assetId]", "page");
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}

/**
 * Campos numéricos que não são dinheiro (taxa, quantidade, fator de
 * desdobramento) chegam como texto digitado — e quem digita em português
 * escreve "5,5". Number("5,5") é NaN, então a vírgula vira ponto antes.
 */
function optionalNumber(formData: FormData, key: string): number | null {
  const text = optionalString(formData, key);
  if (text === null) return null;
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

// Ativos ---------------------------------------------------------------------

function parseAssetFormData(formData: FormData) {
  return investmentAssetFormSchema.safeParse({
    name: formData.get("name"),
    assetClass: formData.get("assetClass"),
    pricingMode: formData.get("pricingMode"),
    currency: formData.get("currency") || "BRL",
    ticker: optionalString(formData, "ticker")?.toUpperCase() ?? null,
    quoteSymbol: optionalString(formData, "quoteSymbol")?.toUpperCase() ?? null,
    rateIndex: optionalString(formData, "rateIndex"),
    ratePercent: optionalNumber(formData, "ratePercent"),
    rateSpread: optionalNumber(formData, "rateSpread"),
    issueDate: optionalString(formData, "issueDate"),
    maturityDate: optionalString(formData, "maturityDate"),
    isTaxExempt: formData.get("isTaxExempt") === "on" || formData.get("isTaxExempt") === "true",
    manualValueCents: optionalNumber(formData, "manualValueCents"),
    manualValueDate: optionalString(formData, "manualValueDate"),
    initialAmountCents: optionalNumber(formData, "initialAmountCents"),
    initialQuantity: optionalNumber(formData, "initialQuantity"),
    initialUnitPriceCents: optionalNumber(formData, "initialUnitPriceCents"),
    initialDate: optionalString(formData, "initialDate"),
    accountId: optionalString(formData, "accountId"),
    institution: formData.get("institution") ?? "",
    notes: formData.get("notes") ?? "",
    color: formData.get("color") ?? "#109b7e",
  });
}

/**
 * Campos de um modo de precificação não fazem sentido nos outros — um CDB não
 * tem ticker, uma ação não tem índice. Zerar o que não pertence ao modo evita
 * que, ao trocar "renda fixa" por "ação", sobrem no banco os dados antigos
 * silenciosamente influenciando o cálculo.
 */
function assetColumnsFor(data: InvestmentAssetFormInput) {
  const isQuoted = data.pricingMode === "cotacao";
  const isIndexed = data.pricingMode === "indexado";
  const isManual = data.pricingMode === "manual";

  return {
    name: data.name,
    asset_class: data.assetClass,
    pricing_mode: data.pricingMode,
    currency: data.currency,
    ticker: isQuoted ? data.ticker : null,
    quote_symbol: isQuoted ? data.quoteSymbol : null,
    rate_index: isIndexed ? data.rateIndex : null,
    rate_percent: isIndexed ? data.ratePercent : null,
    rate_spread: isIndexed ? data.rateSpread : null,
    issue_date: isIndexed ? data.issueDate : null,
    maturity_date: isIndexed ? data.maturityDate : null,
    is_tax_exempt: data.isTaxExempt,
    manual_value_cents: isManual ? data.manualValueCents : null,
    manual_value_date: isManual ? data.manualValueDate : null,
    account_id: data.accountId,
    institution: data.institution,
    notes: data.notes,
    color: data.color,
  };
}

/**
 * Grava o aporte que veio junto com o cadastro do ativo.
 *
 * A trava é contar os movimentos antes: o bloco só existe na tela enquanto o
 * ativo não tem nenhum, e conferir aqui de novo garante que reenviar o
 * formulário (dois cliques, voltar do navegador, editar depois) não crie um
 * segundo aporte por cima do primeiro.
 */
async function saveInitialContribution(
  spaceId: string,
  assetId: string,
  data: InvestmentAssetFormInput,
): Promise<void> {
  const quantity = data.initialQuantity ?? 0;
  const unitPrice = data.initialUnitPriceCents ?? 0;
  const amount = data.initialAmountCents ?? (quantity > 0 && unitPrice > 0 ? Math.round(quantity * unitPrice) : 0);
  if (amount <= 0 && quantity <= 0) return;

  const supabase = await createClient();

  const { count } = await supabase
    .from("investment_movements")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
    .eq("space_id", spaceId);
  if ((count ?? 0) > 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("investment_movements").insert({
    space_id: spaceId,
    asset_id: assetId,
    movement_type: "aporte",
    // Para renda fixa a data da aplicação É a data do aporte; não faz sentido
    // pedir a mesma data duas vezes na mesma tela.
    movement_date: data.initialDate ?? data.issueDate ?? new Date().toISOString().slice(0, 10),
    quantity,
    unit_price_cents: unitPrice > 0 ? unitPrice : null,
    amount_cents: amount,
    created_by: user?.id ?? null,
  });
}

export async function createAssetAction(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseAssetFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("investment_assets")
    .insert({ space_id: spaceId, ...assetColumnsFor(parsed.data) })
    .select("id")
    .single();

  if (error || !created) return { error: "Não foi possível criar o ativo." };

  await saveInitialContribution(spaceId, created.id, parsed.data);

  revalidateInvestmentData();
  return { success: true };
}

export async function updateAssetAction(
  assetId: string,
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseAssetFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_assets")
    .update(assetColumnsFor(parsed.data))
    .eq("id", assetId)
    .eq("space_id", spaceId);

  if (error) return { error: "Não foi possível salvar as alterações." };

  await saveInitialContribution(spaceId, assetId, parsed.data);

  revalidateInvestmentData();
  return { success: true };
}

export async function toggleArchiveAssetAction(assetId: string, spaceId: string, archive: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("investment_assets").update({ is_archived: archive }).eq("id", assetId).eq("space_id", spaceId);
  revalidateInvestmentData();
}

/**
 * Exclusão definitiva. O FK de investment_movements é ON DELETE CASCADE, então
 * apagar um ativo com histórico levaria junto todos os aportes — só permitimos
 * quando não há movimento nenhum. Ativo com histórico se arquiva.
 */
export async function deleteAssetAction(assetId: string, spaceId: string): Promise<ActionState> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("investment_movements")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
    .eq("space_id", spaceId);

  if ((count ?? 0) > 0) {
    return {
      error: `Este ativo tem ${count} movimento(s) — excluí-lo apagaria todos permanentemente. Arquive-o.`,
    };
  }

  const { error } = await supabase.from("investment_assets").delete().eq("id", assetId).eq("space_id", spaceId);
  if (error) return { error: "Não foi possível excluir o ativo." };

  revalidateInvestmentData();
  return { success: true };
}

// Movimentos -----------------------------------------------------------------

function parseMovementFormData(formData: FormData) {
  return investmentMovementFormSchema.safeParse({
    assetId: formData.get("assetId"),
    movementType: formData.get("movementType"),
    movementDate: formData.get("movementDate"),
    quantity: optionalNumber(formData, "quantity") ?? 0,
    unitPriceCents: optionalNumber(formData, "unitPriceCents"),
    amountCents: optionalNumber(formData, "amountCents") ?? 0,
    feesCents: optionalNumber(formData, "feesCents") ?? 0,
    taxCents: optionalNumber(formData, "taxCents") ?? 0,
    splitFactor: optionalNumber(formData, "splitFactor"),
    transactionId: optionalString(formData, "transactionId"),
    notes: formData.get("notes") ?? "",
    createTransactionAccountId: optionalString(formData, "createTransactionAccountId"),
  });
}

const NATURE_BY_MOVEMENT: Partial<Record<InvestmentMovementType, TransactionNature>> = {
  aporte: "aplicacao_financeira",
  resgate: "resgate_investimento",
  provento: "rendimento_investimento",
  taxa: "despesa",
  imposto: "despesa",
};

/**
 * Cria o lançamento bancário correspondente ao movimento, quando a pessoa pede
 * ("lançar também em Transações"). É o caminho de ida da ponte entre as abas —
 * o de volta é vincular um lançamento que já existe a um ativo.
 */
async function createTransactionForMovement(
  spaceId: string,
  accountId: string,
  assetName: string,
  movementType: InvestmentMovementType,
  movementDate: string,
  amountCents: number,
): Promise<string | null> {
  const direction = movementCashDirection(movementType);
  if (!direction || amountCents <= 0) return null;

  const nature = NATURE_BY_MOVEMENT[movementType] ?? "ajuste";
  const description = `${movementTypeLabels[movementType]} — ${assetName}`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      space_id: spaceId,
      account_id: accountId,
      movement_date: movementDate,
      competence_date: movementDate,
      original_description: description,
      normalized_description: normalizeDescription(description),
      amount_cents: amountCents,
      direction,
      nature,
      origin: "manual",
      classification_status: classificationStatusFor(nature, false),
      dedup_hash: computeDedupHash({
        spaceId,
        accountId,
        movementDate,
        amountCents,
        direction,
        description,
      }),
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function createMovementAction(
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseMovementFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let transactionId = parsed.data.transactionId ?? null;

  if (!transactionId && parsed.data.createTransactionAccountId) {
    const { data: asset } = await supabase
      .from("investment_assets")
      .select("name")
      .eq("id", parsed.data.assetId)
      .eq("space_id", spaceId)
      .maybeSingle();

    transactionId = await createTransactionForMovement(
      spaceId,
      parsed.data.createTransactionAccountId,
      asset?.name ?? "Investimento",
      parsed.data.movementType,
      parsed.data.movementDate,
      parsed.data.amountCents,
    );
  }

  const { error } = await supabase.from("investment_movements").insert({
    space_id: spaceId,
    asset_id: parsed.data.assetId,
    movement_type: parsed.data.movementType,
    movement_date: parsed.data.movementDate,
    quantity: parsed.data.quantity,
    unit_price_cents: parsed.data.unitPriceCents,
    amount_cents: parsed.data.amountCents,
    fees_cents: parsed.data.feesCents,
    tax_cents: parsed.data.taxCents,
    split_factor: parsed.data.movementType === "desdobramento" ? parsed.data.splitFactor : null,
    transaction_id: transactionId,
    notes: parsed.data.notes,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Não foi possível registrar o movimento." };

  revalidateInvestmentData();
  revalidateTransactionData();
  return { success: true };
}

export async function updateMovementAction(
  movementId: string,
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseMovementFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_movements")
    .update({
      asset_id: parsed.data.assetId,
      movement_type: parsed.data.movementType,
      movement_date: parsed.data.movementDate,
      quantity: parsed.data.quantity,
      unit_price_cents: parsed.data.unitPriceCents,
      amount_cents: parsed.data.amountCents,
      fees_cents: parsed.data.feesCents,
      tax_cents: parsed.data.taxCents,
      split_factor: parsed.data.movementType === "desdobramento" ? parsed.data.splitFactor : null,
      notes: parsed.data.notes,
    })
    .eq("id", movementId)
    .eq("space_id", spaceId);

  if (error) return { error: "Não foi possível salvar o movimento." };

  revalidateInvestmentData();
  return { success: true };
}

/**
 * Só o movimento é apagado. O lançamento bancário vinculado permanece — ele é
 * o extrato, e apagar dinheiro que de fato saiu da conta por causa de uma
 * correção de carteira desbalancearia o saldo.
 */
export async function deleteMovementAction(movementId: string, spaceId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_movements")
    .delete()
    .eq("id", movementId)
    .eq("space_id", spaceId);

  if (error) return { error: "Não foi possível excluir o movimento." };

  revalidateInvestmentData();
  return { success: true };
}

// Ponte com Transações -------------------------------------------------------

/** Transforma um lançamento já existente em movimento do ativo escolhido. */
export async function linkTransactionAction(
  spaceId: string,
  transactionId: string,
  assetId: string,
  quantity: number,
): Promise<ActionState> {
  const supabase = await createClient();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, movement_date, amount_cents, direction, nature")
    .eq("id", transactionId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!transaction) return { error: "Lançamento não encontrado." };

  const movementType: InvestmentMovementType =
    transaction.nature === "rendimento_investimento"
      ? "provento"
      : transaction.direction === "saida"
        ? "aporte"
        : "resgate";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("investment_movements").insert({
    space_id: spaceId,
    asset_id: assetId,
    movement_type: movementType,
    movement_date: transaction.movement_date,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    amount_cents: transaction.amount_cents,
    transaction_id: transaction.id,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Não foi possível vincular o lançamento." };

  revalidateInvestmentData();
  return { success: true };
}

// Dados de mercado -----------------------------------------------------------

export interface RefreshState {
  error?: string;
  success?: boolean;
  updated?: number;
  failed?: string[];
}

/**
 * Atualiza cotações e séries de índice. É explícito, por botão, e não
 * automático a cada carregamento da página: são chamadas a serviços externos
 * que podem demorar ou falhar, e a carteira precisa abrir instantaneamente
 * mesmo com o Yahoo fora do ar.
 */
export async function refreshMarketDataAction(spaceId: string): Promise<RefreshState> {
  try {
    const symbols = await quoteSymbolsForSpace(spaceId);
    const { quotes, failed } = symbols.length > 0 ? await fetchQuotes(symbols) : { quotes: [], failed: [] };
    if (quotes.length > 0) await saveQuotes(quotes);

    const assets = await listAssets(spaceId, { includeArchived: true });
    const indexes = indexesInUse(assets);
    if (indexes.length > 0) {
      await ensureIndexCoverage(indexes, await coverageStartDate(spaceId));
    }

    revalidateInvestmentData();
    return { success: true, updated: quotes.length, failed };
  } catch (error) {
    // O cache de mercado é gravado pela service role. Quando essa chave falta
    // ou está inválida, o sintoma é sempre o mesmo — nenhum preço aparece —
    // mas a causa é de configuração, não de rede. Sem distinguir os dois, o
    // aviso genérico manda a pessoa "tentar de novo" para sempre.
    // Pode ser um Error (createAdminClient) ou um PostgrestError solto, que
    // não herda de Error — daí ler a mensagem sem depender do instanceof.
    const message = String((error as { message?: unknown })?.message ?? "");
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY") || message.includes("Invalid API key")) {
      return {
        error:
          "As cotações são gravadas com a chave de serviço do Supabase, e ela não está configurada corretamente neste ambiente. Confira SUPABASE_SERVICE_ROLE_KEY.",
      };
    }
    return { error: "Não foi possível atualizar os dados de mercado agora. Tente de novo em instantes." };
  }
}

/** Preço manual, para quando o provedor não conhece o papel. */
export async function setManualValueAction(
  assetId: string,
  spaceId: string,
  valueCents: number,
  valueDate: string,
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("investment_assets")
    .update({ manual_value_cents: valueCents, manual_value_date: valueDate, pricing_mode: "manual" })
    .eq("id", assetId)
    .eq("space_id", spaceId);

  if (error) return { error: "Não foi possível salvar o saldo informado." };

  revalidateInvestmentData();
  return { success: true };
}

/** Símbolo reconhecido pelo provedor? Usado no formulário, antes de salvar. */
export async function previewQuoteAction(
  assetClass: string,
  ticker: string | null,
  quoteSymbol: string | null,
): Promise<{ symbol: string; closeCents: number; currency: string; quoteDate: string } | { error: string }> {
  const symbol = resolveQuoteSymbol({
    asset_class: assetClass as Parameters<typeof resolveQuoteSymbol>[0]["asset_class"],
    ticker,
    quote_symbol: quoteSymbol,
  });
  if (!symbol) return { error: "Informe o ticker do ativo." };

  const { quotes } = await fetchQuotes([symbol]);
  const quote = quotes[0];
  if (!quote) return { error: `Não encontrei cotação para "${symbol}".` };

  return { symbol: quote.symbol, closeCents: quote.closeCents, currency: quote.currency, quoteDate: quote.quoteDate };
}
