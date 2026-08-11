import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listCategories, groupCategoriesByParent } from "@/lib/data/categories";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryFormDialog } from "./category-form-dialog";
import { ArchiveCategoryButton } from "./archive-category-button";
import type { CategoryKind } from "@/lib/supabase/types";

const KIND_ORDER: CategoryKind[] = ["despesa", "receita", "investimento", "transferencia", "outro"];
const KIND_LABELS: Record<CategoryKind, string> = {
  despesa: "Despesas",
  receita: "Receitas",
  investimento: "Investimentos",
  transferencia: "Transferências",
  outro: "Outros",
};

export default async function CategoriasPage() {
  const space = await requireCurrentSpace();
  const categories = await listCategories(space.id, { includeArchived: true });
  const grouped = groupCategoriesByParent(categories);

  return (
    <div>
      <PageHeader
        title="Categorias"
        description="Personalize a taxonomia de categorias e subcategorias do seu espaço financeiro."
        actions={<CategoryFormDialog spaceId={space.id} />}
      />

      <div className="space-y-8">
        {KIND_ORDER.map((kind) => {
          const kindCategories = grouped.filter((c) => c.kind === kind);
          if (kindCategories.length === 0) return null;

          return (
            <section key={kind}>
              <h2 className="mb-3 font-display text-base font-medium text-text-primary">{KIND_LABELS[kind]}</h2>
              <div className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle">
                {kindCategories.map((category) => (
                  <div key={category.id} className={category.is_archived ? "opacity-60" : ""}>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="font-medium text-text-primary">{category.name}</span>
                        {category.is_archived ? <span className="text-[11px] text-text-tertiary">arquivada</span> : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {!category.is_system ? <CategoryFormDialog spaceId={space.id} category={category} /> : null}
                        <CategoryFormDialog spaceId={space.id} parent={category} />
                        <ArchiveCategoryButton categoryId={category.id} isArchived={category.is_archived} />
                      </div>
                    </div>
                    {category.children.length > 0 ? (
                      <div className="divide-y divide-border-subtle border-t border-border-subtle bg-surface-sunken/40 pl-6">
                        {category.children.map((sub) => (
                          <div key={sub.id} className={`flex items-center justify-between px-4 py-2 ${sub.is_archived ? "opacity-60" : ""}`}>
                            <div className="flex items-center gap-2 text-[13px]">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sub.color }} />
                              <span className="text-text-primary">{sub.name}</span>
                              {sub.is_archived ? <span className="text-[11px] text-text-tertiary">arquivada</span> : null}
                            </div>
                            <div className="flex items-center gap-1">
                              {!sub.is_system ? <CategoryFormDialog spaceId={space.id} category={sub} /> : null}
                              <ArchiveCategoryButton categoryId={sub.id} isArchived={sub.is_archived} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
