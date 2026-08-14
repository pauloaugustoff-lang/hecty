"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadImportFile, downloadImportFile } from "@/lib/storage/imports";
import { detectSourceType } from "@/lib/import/detect";
import { parseCsv } from "@/lib/import/parsers/csv";
import { parseXlsx } from "@/lib/import/parsers/xlsx";
import { parseOfx } from "@/lib/import/parsers/ofx";
import { suggestMapping, normalizeTableRows, normalizeOfxRows, type ColumnMapping, type NormalizedCandidate } from "@/lib/import/pipeline";
import { computeDedupHash } from "@/lib/import/dedup";
import { findMatchingRule, actionFromRule } from "@/lib/rules/engine";
import { toRuleDefinition } from "@/lib/data/rules";
import type { ImportRowStatus, ImportSourceType, TransactionDirection } from "@/lib/supabase/types";

export interface AnalyzeResult {
  error?: string;
  storagePath?: string;
  sourceType?: ImportSourceType;
  fileName?: string;
  headers?: string[];
  sampleRows?: Record<string, string>[];
  suggestedMapping?: Partial<ColumnMapping>;
  totalRows?: number;
  needsMapping?: boolean;
}

export async function analyzeImportFileAction(spaceId: string, formData: FormData): Promise<AnalyzeResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo." };
  }

  const sourceType = detectSourceType(file.name);
  if (!sourceType) {
    return { error: "Formato não suportado. Envie um arquivo CSV, OFX ou XLSX." };
  }
  if (sourceType === "pdf") {
    return { error: "A leitura de extratos em PDF ainda não está disponível nesta versão." };
  }

  const supabase = await createClient();
  let storagePath: string;
  try {
    storagePath = await uploadImportFile(supabase, spaceId, file);
  } catch {
    return { error: "Não foi possível enviar o arquivo." };
  }

  try {
    if (sourceType === "csv") {
      const text = await file.text();
      const table = parseCsv(text);
      return {
        storagePath,
        sourceType,
        fileName: file.name,
        headers: table.headers,
        sampleRows: table.rows.slice(0, 8),
        suggestedMapping: suggestMapping(table.headers),
        totalRows: table.rows.length,
        needsMapping: true,
      };
    }

    if (sourceType === "xlsx") {
      const buffer = await file.arrayBuffer();
      const table = await parseXlsx(buffer);
      return {
        storagePath,
        sourceType,
        fileName: file.name,
        headers: table.headers,
        sampleRows: table.rows.slice(0, 8),
        suggestedMapping: suggestMapping(table.headers),
        totalRows: table.rows.length,
        needsMapping: true,
      };
    }

    // OFX não precisa de mapeamento de colunas.
    const text = await file.text();
    const transactions = parseOfx(text);
    return {
      storagePath,
      sourceType,
      fileName: file.name,
      totalRows: transactions.length,
      needsMapping: false,
    };
  } catch {
    return { error: "Não foi possível ler o arquivo. Verifique o formato e tente novamente." };
  }
}

export interface StageInput {
  storagePath: string;
  sourceType: ImportSourceType;
  fileName: string;
  accountId: string | null;
  cardId: string | null;
  /** Obrigatório quando cardId está definido: data de vencimento/pagamento
   * desta fatura, aplicada a todas as linhas do lote. Não dá pra inferir
   * isso a partir da data de cada compra porque compras parceladas aparecem
   * em faturas de meses diferentes da compra original. */
  statementPaymentDate?: string;
  mapping?: ColumnMapping;
}

export async function stageImportBatchAction(spaceId: string, input: StageInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const buffer = await downloadImportFile(supabase, input.storagePath);

  const isCardImport = Boolean(input.cardId);

  let candidates: NormalizedCandidate[];
  if (input.sourceType === "csv") {
    const text = new TextDecoder("utf-8").decode(buffer);
    const table = parseCsv(text);
    candidates = normalizeTableRows(table, input.mapping!, isCardImport);
  } else if (input.sourceType === "xlsx") {
    const table = await parseXlsx(buffer);
    candidates = normalizeTableRows(table, input.mapping!, isCardImport);
  } else {
    const text = new TextDecoder("utf-8").decode(buffer);
    candidates = normalizeOfxRows(parseOfx(text));
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      space_id: spaceId,
      source_type: input.sourceType,
      file_name: input.fileName,
      account_id: input.accountId,
      card_id: input.cardId,
      status: "pendente",
      column_mapping: input.mapping ?? {},
      total_rows: candidates.length,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error("Não foi possível criar o lote de importação.");
  }

  const { data: rules } = await supabase.from("rules").select("*").eq("space_id", spaceId).eq("is_active", true).order("priority");
  const ruleDefs = (rules ?? []).map(toRuleDefinition);

  // Compras importadas para um cartão contam como despesa no mês do
  // vencimento da fatura (quando o dinheiro sai da conta), não no mês da
  // compra. Isso não dá pra inferir da data de cada compra, porque uma
  // parcela pode ter sido comprada em janeiro e só aparecer na fatura de
  // julho — por isso é uma única data por lote, informada pelo usuário
  // (todo o arquivo importado é de UMA fatura). Para importação em conta,
  // competence_date = movement_date, como antes.
  function competenceDateFor(movementDate: string | null): string | null {
    if (!movementDate) return movementDate;
    if (input.cardId && input.statementPaymentDate) return input.statementPaymentDate;
    return movementDate;
  }

  const rows = candidates.map((c) => {
    const dedupHash = c.movementDate && c.amountCents !== null && c.direction
      ? computeDedupHash({
          spaceId,
          accountId: input.accountId,
          cardId: input.cardId,
          movementDate: c.movementDate,
          amountCents: c.amountCents,
          direction: c.direction,
          description: c.originalDescription,
        })
      : null;

    const match =
      c.amountCents !== null && c.direction
        ? findMatchingRule(ruleDefs, {
            description: c.originalDescription,
            amountCents: c.amountCents,
            direction: c.direction,
            accountId: input.accountId,
            cardId: input.cardId,
          })
        : null;
    const action = match ? actionFromRule(match) : null;

    return {
      batch_id: batch.id,
      space_id: spaceId,
      row_index: c.rowIndex,
      raw_data: { ...c } as Record<string, unknown>,
      movement_date: c.movementDate,
      competence_date: competenceDateFor(c.movementDate),
      original_description: c.originalDescription,
      normalized_description: c.normalizedDescription,
      amount_cents: c.amountCents,
      direction: c.direction,
      external_id: c.externalId,
      dedup_hash: dedupHash,
      potential_duplicate_of: null,
      status: (c.error ? "ignorado" : "pendente") as ImportRowStatus,
      suggested_nature: action?.nature ?? null,
      suggested_category_id: action?.categoryId ?? null,
      suggested_subcategory_id: action?.subcategoryId ?? null,
      suggested_by_rule_id: match?.id ?? null,
    };
  });

  const { error: rowsError } = await supabase.from("import_batch_rows").insert(rows);
  if (rowsError) {
    throw new Error("Não foi possível preparar as linhas do lote.");
  }

  revalidatePath("/importar");
  redirect(`/importar/${batch.id}`);
}

export interface ConfirmResult {
  error?: string;
  imported?: number;
}

export async function confirmImportBatchAction(
  batchId: string,
  spaceId: string,
  selectedRowIds: string[],
): Promise<ConfirmResult> {
  const supabase = await createClient();

  const { data: batch } = await supabase.from("import_batches").select("*").eq("id", batchId).single();
  if (!batch) return { error: "Lote não encontrado." };

  const { data: rows } = await supabase.from("import_batch_rows").select("*").eq("batch_id", batchId);
  if (!rows) return { error: "Não foi possível carregar as linhas do lote." };

  const toImport = rows.filter((r) => selectedRowIds.includes(r.id) && r.movement_date && r.amount_cents !== null && r.direction);
  const toIgnore = rows.filter((r) => !selectedRowIds.includes(r.id));

  const installmentGroupCache = new Map<number, string>();

  const transactionRows = toImport.map((row) => {
    const raw = row.raw_data as { installment?: { number: number; total: number } | null };
    let installmentGroupId: string | null = null;
    let installmentNumber: number | null = null;
    let installmentTotal: number | null = null;

    if (raw.installment) {
      installmentNumber = raw.installment.number;
      installmentTotal = raw.installment.total;
      const cacheKey = row.row_index - (raw.installment.number - 1);
      if (!installmentGroupCache.has(cacheKey)) {
        installmentGroupCache.set(cacheKey, crypto.randomUUID());
      }
      installmentGroupId = installmentGroupCache.get(cacheKey) ?? null;
    }

    return {
      space_id: spaceId,
      account_id: batch.account_id,
      card_id: batch.card_id,
      movement_date: row.movement_date as string,
      competence_date: row.competence_date as string,
      original_description: row.original_description,
      normalized_description: row.normalized_description,
      amount_cents: row.amount_cents as number,
      direction: row.direction as TransactionDirection,
      nature: row.suggested_nature ?? "nao_classificado",
      category_id: row.suggested_category_id,
      subcategory_id: row.suggested_subcategory_id,
      origin: "importada" as const,
      classification_status: row.suggested_nature ? ("classificado" as const) : ("nao_classificado" as const),
      classified_by_rule_id: row.suggested_by_rule_id,
      installment_number: installmentNumber,
      installment_total: installmentTotal,
      installment_group_id: installmentGroupId,
      import_batch_id: batchId,
      import_external_id: row.external_id,
      dedup_hash: row.dedup_hash ?? "",
    };
  });

  if (transactionRows.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .insert(transactionRows)
      .select("id, dedup_hash");

    if (insertError) {
      return { error: "Não foi possível importar os lançamentos selecionados." };
    }

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      const resultingId = inserted?.[i]?.id;
      await supabase
        .from("import_batch_rows")
        .update({ status: "importado", resulting_transaction_id: resultingId })
        .eq("id", row.id);
    }
  }

  if (toIgnore.length > 0) {
    await supabase
      .from("import_batch_rows")
      .update({ status: "ignorado" })
      .in("id", toIgnore.map((r) => r.id));
  }

  await supabase
    .from("import_batches")
    .update({
      status: "concluida",
      imported_rows: transactionRows.length,
      ignored_rows: toIgnore.length,
    })
    .eq("id", batchId);

  revalidatePath(`/importar/${batchId}`);
  revalidatePath("/importar");
  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/revisar");
  revalidatePath("/contas");

  return { imported: transactionRows.length };
}

export async function undoImportBatchAction(batchId: string, spaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("import_batch_id", batchId)
    .eq("space_id", spaceId);

  await supabase
    .from("import_batches")
    .update({ status: "desfeita", undone_at: new Date().toISOString(), undone_by: user?.id })
    .eq("id", batchId);

  revalidatePath("/importar");
  revalidatePath(`/importar/${batchId}`);
  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/contas");
}
