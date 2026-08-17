import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { createClient } from "@/lib/supabase/server";
import { listTags } from "@/lib/data/tags";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tags } from "lucide-react";
import { TagFormDialog } from "./tag-form-dialog";
import { DeleteTagButton } from "./delete-tag-button";

export default async function TagsPage() {
  const space = await requireCurrentSpace();
  const tags = await listTags(space.id);
  const supabase = await createClient();

  const usageCounts = await Promise.all(
    tags.map(async (tag) => {
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("space_id", space.id)
        .contains("tags", [tag.name])
        .is("deleted_at", null);
      return count ?? 0;
    }),
  );

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Marcações transversais a categorias — renomear ou excluir aqui atualiza todos os lançamentos que usam a tag."
        actions={<TagFormDialog spaceId={space.id} />}
      />

      {tags.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma tag criada"
          description="Crie tags para somar gastos que atravessam várias categorias — como todos os custos de uma viagem."
          action={<TagFormDialog spaceId={space.id} />}
        />
      ) : (
        <div className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle">
          {tags.map((tag, i) => (
            <div key={tag.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="font-medium text-text-primary">{tag.name}</span>
                <span className="text-[11px] text-text-tertiary">
                  {usageCounts[i]} lançamento{usageCounts[i] === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TagFormDialog spaceId={space.id} tag={tag} />
                <DeleteTagButton tagId={tag.id} spaceId={space.id} tagName={tag.name} usageCount={usageCounts[i]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
