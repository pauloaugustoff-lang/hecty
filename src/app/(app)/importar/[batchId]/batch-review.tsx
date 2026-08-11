"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { confirmImportBatchAction } from "../actions";
import type { ImportBatchRowRow } from "@/lib/data/imports";
import { importRowStatusLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_TONE: Record<string, "positive" | "pending" | "negative" | "neutral"> = {
  pendente: "neutral",
  duplicata_possivel: "pending",
  duplicata_confirmada: "pending",
  importado: "positive",
  ignorado: "negative",
};

export function BatchReview({ batchId, spaceId, rows }: { batchId: string; spaceId: string; rows: ImportBatchRowRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.status === "pendente").map((r) => r.id)),
  );

  const invalidRows = useMemo(() => rows.filter((r) => !r.movement_date || r.amount_cents === null || !r.direction), [rows]);
  const validRows = useMemo(() => rows.filter((r) => r.movement_date && r.amount_cents !== null && r.direction), [rows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === validRows.length ? new Set() : new Set(validRows.map((r) => r.id))));
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmImportBatchAction(batchId, spaceId, Array.from(selected));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.imported} lançamento(s) importado(s)`);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">{selected.size} de {validRows.length} linha(s) válida(s) selecionada(s) para importar</p>
        <Button variant="primary" onClick={handleConfirm} disabled={isPending || selected.size === 0}>
          {isPending ? "Importando…" : `Confirmar importação de ${selected.size}`}
        </Button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border-subtle">
        <Table>
          <Thead>
            <Tr>
              <Th className="w-10">
                <Checkbox checked={selected.size === validRows.length && validRows.length > 0} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
              </Th>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th className="text-right">Valor</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  {row.movement_date && row.amount_cents !== null && row.direction ? (
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} aria-label={`Selecionar ${row.original_description}`} />
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap text-text-secondary tabular text-[13px]">
                  {row.movement_date ? format(new Date(`${row.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </Td>
                <Td>{row.original_description || <span className="text-negative">linha inválida</span>}</Td>
                <Td className="text-right tabular">{row.amount_cents !== null ? formatCentsToBRL(row.amount_cents) : "—"}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{importRowStatusLabels[row.status]}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {invalidRows.length > 0 ? (
        <p className="mt-2 text-[13px] text-text-tertiary">
          {invalidRows.length} linha(s) não puderam ser lidas (data ou valor inválido) e não serão importadas.
        </p>
      ) : null}
    </div>
  );
}
