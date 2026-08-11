import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const BUCKET = "imports";

export async function uploadImportFile(
  supabase: SupabaseClient<Database>,
  spaceId: string,
  file: File,
): Promise<string> {
  const path = `${spaceId}/${randomUUID()}/${file.name}`;
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
