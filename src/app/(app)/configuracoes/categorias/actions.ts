"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoryFormSchema } from "@/lib/validation/schemas";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function parseCategoryFormData(formData: FormData) {
  const parentId = formData.get("parentId");
  return categoryFormSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    parentId: parentId ? String(parentId) : null,
    color: formData.get("color") ?? "#64748b",
  });
}

export async function createCategoryAction(
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    space_id: spaceId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    parent_id: parsed.data.parentId,
    color: parsed.data.color,
  });

  if (error) {
    return { error: parsed.data.parentId ? "Não foi possível criar a subcategoria." : "Não foi possível criar a categoria." };
  }

  revalidatePath("/configuracoes/categorias");
  return { success: true };
}

export async function updateCategoryAction(
  categoryId: string,
  _spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCategoryFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", categoryId);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/configuracoes/categorias");
  return { success: true };
}

export async function toggleArchiveCategoryAction(categoryId: string, archive: boolean) {
  const supabase = await createClient();
  await supabase.from("categories").update({ is_archived: archive }).eq("id", categoryId);
  revalidatePath("/configuracoes/categorias");
}
