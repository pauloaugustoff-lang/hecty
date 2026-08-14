import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { Database } from "@/lib/supabase/types";

export type ImportBatchRow = Database["public"]["Tables"]["import_batches"]["Row"];
export type ImportBatchRowRow = Database["public"]["Tables"]["import_batch_rows"]["Row"];

export async function listImportBatches(spaceId: string): Promise<ImportBatchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function getImportBatch(id: string): Promise<ImportBatchRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("import_batches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listImportBatchRows(batchId: string): Promise<ImportBatchRowRow[]> {
  const supabase = await createClient();
  // Paginado: um lote acima de 1000 linhas era truncado silenciosamente pelo
  // max_rows do PostgREST, mostrando (e confirmando) só parte da importação.
  return fetchAllRows<ImportBatchRowRow>((pageFrom, pageTo) =>
    supabase.from("import_batch_rows").select("*").eq("batch_id", batchId).order("row_index").range(pageFrom, pageTo),
  );
}
