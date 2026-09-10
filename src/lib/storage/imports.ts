import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const BUCKET = "imports";

/**
 * O storage do Supabase rejeita chaves com caracteres fora de um conjunto
 * restrito — um arquivo chamado "fatura março (1).xlsx" falhava no upload
 * por causa do "ç", espaços e parênteses. Remove acentos e troca o resto
 * por hífen; o nome ORIGINAL continua sendo o exibido (batch.file_name),
 * isto aqui é só a chave interna (que já é única pelo UUID no caminho).
 */
function safeStorageName(name: string): string {
  const semAcentos = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sanitized = semAcentos
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|-+$/g, "");
  return sanitized || "arquivo";
}

export async function uploadImportFile(
  supabase: SupabaseClient<Database>,
  spaceId: string,
  file: File,
): Promise<string> {
  const path = `${spaceId}/${randomUUID()}/${safeStorageName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function downloadImportFile(supabase: SupabaseClient<Database>, path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("Arquivo não encontrado.");
  return data.arrayBuffer();
}

export async function deleteImportFile(supabase: SupabaseClient<Database>, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}
