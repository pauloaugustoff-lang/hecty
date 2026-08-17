"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows, chunk } from "@/lib/supabase/fetch-all";
import { revalidateTransactionData } from "@/lib/revalidate-financial";
import { tagFormSchema } from "@/lib/validation/schemas";
import type { TagRow } from "@/lib/data/tags";

export interface TagActionState {
  error?: string;
  success?: boolean;
}

/**
 * O vínculo lançamento→tag é pelo NOME (transactions.tags é text[]), então
 * renomear ou excluir uma tag precisa propagar para os lançamentos que a
 * usam — senão eles ficariam apontando pra um nome que não existe mais.
 * newName = null remove a tag dos lançamentos. Inclui lançamentos excluídos
 * (soft delete), pra restauração não ressuscitar um nome órfão.
 */
async function replaceTagInTransactions(spaceId: string, oldName: string, newName: string | null): Promise<void> {
  const supabase = await createClient();
  const rows = await fetchAllRows<{ id: string; tags: string[] }>((pageFrom, pageTo) =>
    supabase
      .from("transactions")
      .select("id, tags")
      .eq("space_id", spaceId)
      .contains("tags", [oldName])
      .order("id")
      .range(pageFrom, pageTo),
  );

  // Linhas com o mesmo array resultante vão num único UPDATE.
  const groups = new Map<string, { tags: string[]; ids: string[] }>();
  for (const row of rows) {
    const nextTags = newName
      ? Array.from(new Set(row.tags.map((t) => (t === oldName ? newName : t))))
      : row.tags.filter((t) => t !== oldName);
    const key = JSON.stringify(nextTags);
    const group = groups.get(key) ?? { tags: nextTags, ids: [] };
    group.ids.push(row.id);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    for (const ids of chunk(group.ids, 200)) {
      const { error } = await supabase.from("transactions").update({ tags: group.tags }).eq("space_id", spaceId).in("id", ids);
      if (error) throw error;
    }
  }
}

export async function updateTagAction(
  tagId: string,
  spaceId: string,
  _prev: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  const parsed = tagFormSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? "#8b5cf6",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("tags").select("id, name").eq("space_id", spaceId);
  const tag = (existing ?? []).find((t) => t.id === tagId) as TagRow | undefined;
  if (!tag) return { error: "Tag não encontrada." };

  const collision = (existing ?? []).some(
    (t) => t.id !== tagId && t.name.toLowerCase() === parsed.data.name.toLowerCase(),
  );
  if (collision) return { error: "Já existe uma tag com esse nome." };

  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", tagId)
    .eq("space_id", spaceId);
  if (error) return { error: "Não foi possível salvar as alterações." };

  if (tag.name !== parsed.data.name) {
    try {
      await replaceTagInTransactions(spaceId, tag.name, parsed.data.name);
    } catch {
      return { error: "Tag renomeada, mas houve erro ao atualizar os lançamentos. Tente salvar de novo." };
    }
  }

  revalidatePath("/configuracoes/tags");
  revalidateTransactionData();
  return { success: true };
}

export async function deleteTagAction(tagId: string, spaceId: string): Promise<TagActionState> {
  const supabase = await createClient();
  const { data: tag } = await supabase.from("tags").select("id, name").eq("id", tagId).eq("space_id", spaceId).maybeSingle();
  if (!tag) return { error: "Tag não encontrada." };

  try {
    await replaceTagInTransactions(spaceId, tag.name, null);
  } catch {
    return { error: "Não foi possível remover a tag dos lançamentos. Tente novamente." };
  }

  const { error } = await supabase.from("tags").delete().eq("id", tagId).eq("space_id", spaceId);
  if (error) return { error: "Não foi possível excluir a tag." };

  revalidatePath("/configuracoes/tags");
  revalidateTransactionData();
  return { success: true };
}
