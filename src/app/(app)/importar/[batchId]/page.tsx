import { notFound } from "next/navigation";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { getImportBatch, listImportBatchRows } from "@/lib/data/imports";
import { importStatusLabels, importRowStatusLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
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
        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-border-subtle p-4 text-sm text-text-secondary">
            {batch.status === "concluida"
              ? `${batch.imported_rows} lançamento(s) importado(s), ${batch.ignored_rows} ignorado(s).`
              : batch.status === "desfeita"
                ? "Esta importação foi desfeita — os lançamentos abaixo foram removidos das suas transações."
                : "Este lote ainda está sendo processado."}
          </div>

          {rows.length > 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-border-subtle">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Descrição</Th>
                    <Th className="text-right">Valor</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((row) => (
                    <Tr key={row.id} className={row.status !== "importado" ? "opacity-60" : ""}>
                      <Td className="whitespace-nowrap text-text-secondary tabular text-[13px]">
                        {row.movement_date
                          ? format(new Date(`${row.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </Td>
                      <Td>{row.original_description || <span className="text-text-tertiary">linha inválida</span>}</Td>
                      <Td
                        className={`text-right tabular font-medium ${
                          row.direction === "entrada" ? "text-positive" : "text-text-primary"
                        }`}
                      >
                        {row.amount_cents !== null
                          ? `${row.direction === "saida" ? "−" : row.direction === "entrada" ? "+" : ""}${formatCentsToBRL(row.amount_cents)}`
                          : "—"}
                      </Td>
                      <Td>
                        <Badge tone={row.status === "importado" ? "positive" : "neutral"}>
                          {importRowStatusLabels[row.status]}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
