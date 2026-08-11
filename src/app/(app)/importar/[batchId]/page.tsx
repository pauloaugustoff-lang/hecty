import { notFound } from "next/navigation";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { getImportBatch, listImportBatchRows } from "@/lib/data/imports";
import { importStatusLabels } from "@/lib/domain/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { BatchReview } from "./batch-review";
import { UndoBatchButton } from "./undo-batch-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function ImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const space = await requireCurrentSpace();
  const batch = await getImportBatch(batchId);

  if (!batch || batch.space_id !== space.id) notFound();

  const rows = await listImportBatchRows(batchId);

  return (
    <div>
      <PageHeader
        title={batch.file_name}
        description={`Enviado em ${format(new Date(batch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={batch.status === "concluida" ? "positive" : batch.status === "desfeita" ? "neutral" : "pending"}>
              {importStatusLabels[batch.status]}
            </Badge>
            {batch.status === "concluida" ? <UndoBatchButton batchId={batch.id} spaceId={space.id} /> : null}
          </div>
        }
      />

      {batch.status === "pendente" ? (
        <BatchReview batchId={batch.id} spaceId={space.id} rows={rows} />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle p-4 text-sm text-text-secondary">
          {batch.status === "concluida"
            ? `${batch.imported_rows} lançamento(s) importado(s), ${batch.ignored_rows} ignorado(s).`
            : batch.status === "desfeita"
              ? "Esta importação foi desfeita."
              : "Este lote ainda está sendo processado."}
        </div>
      )}
    </div>
  );
}
