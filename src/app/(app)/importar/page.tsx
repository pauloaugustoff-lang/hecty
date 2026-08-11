import Link from "next/link";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { listImportBatches } from "@/lib/data/imports";
import { importStatusLabels } from "@/lib/domain/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { ImportWizard } from "./import-wizard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_TONE: Record<string, "positive" | "pending" | "neutral" | "negative"> = {
  concluida: "positive",
  pendente: "pending",
  processando: "pending",
  desfeita: "neutral",
  erro: "negative",
};

export default async function ImportarPage() {
  const space = await requireCurrentSpace();
  const [accounts, cards, batches] = await Promise.all([
    listAccounts(space.id),
    listCards(space.id),
    listImportBatches(space.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Importar"
        description="Envie um extrato em CSV, OFX ou XLSX. Você revisa e confirma antes de qualquer lançamento ser criado."
      />

      <ImportWizard spaceId={space.id} accounts={accounts} cards={cards} />

      {batches.length > 0 ? (
        <div className="mt-10">
          <h2 className="mb-3 font-display text-base font-medium text-text-primary">Importações anteriores</h2>
          <div className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/importar/${batch.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-sunken"
              >
                <div>
                  <p className="font-medium text-text-primary">{batch.file_name}</p>
                  <p className="text-[12px] text-text-tertiary">
                    {format(new Date(batch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {batch.total_rows} linha(s)
                  </p>
                </div>
                <Badge tone={STATUS_TONE[batch.status] ?? "neutral"}>{importStatusLabels[batch.status]}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
