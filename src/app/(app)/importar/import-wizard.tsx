"use client";

import { useState, useTransition } from "react";
import { Upload, FileSpreadsheet, ArrowRight } from "lucide-react";
import { analyzeImportFileAction, stageImportBatchAction, type AnalyzeResult } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { ColumnMapping } from "@/lib/import/pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date", label: "Data da movimentação", required: true },
  { key: "description", label: "Descrição", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "direction", label: "Entrada/Saída (opcional, se o valor já tem sinal)", required: false },
  { key: "externalId", label: "Identificador do banco (opcional)", required: false },
];

export function ImportWizard({ spaceId, accounts, cards }: { spaceId: string; accounts: AccountRow[]; cards: CardRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [statementPaymentDate, setStatementPaymentDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [accountId, cardId] = source.startsWith("account:")
    ? [source.slice(8), null]
    : source.startsWith("card:")
      ? [null, source.slice(5)]
      : [null, null];

  function handleAnalyze() {
    if (!file || !source) {
      setError("Selecione um arquivo e a conta ou cartão de destino.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await analyzeImportFileAction(spaceId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAnalysis(result);
      setMapping(result.suggestedMapping ?? {});
    });
  }

  function handleStage() {
    if (!analysis?.storagePath || !analysis.sourceType || !analysis.fileName) return;

    if (analysis.needsMapping) {
      if (!mapping.date || !mapping.description || !mapping.amount) {
        setError("Selecione ao menos as colunas de data, descrição e valor.");
        return;
      }
    }

    if (cardId && !statementPaymentDate) {
      setError("Informe a data de vencimento/pagamento desta fatura.");
      return;
    }

    setError(null);
    startTransition(async () => {
      await stageImportBatchAction(spaceId, {
        storagePath: analysis.storagePath!,
        sourceType: analysis.sourceType!,
        fileName: analysis.fileName!,
        accountId,
        cardId,
        statementPaymentDate: cardId ? statementPaymentDate : undefined,
        mapping: analysis.needsMapping ? (mapping as ColumnMapping) : undefined,
      });
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {error ? <Callout tone="danger">{error}</Callout> : null}

      {!analysis ? (
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-border-subtle p-6">
          <div>
            <Label htmlFor="source">Importar para</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="source">
                <SelectValue placeholder="Selecione a conta ou cartão" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={`account:${a.id}`}>
                      {a.name}
                    </SelectItem>
                  ))}
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={`card:${c.id}`}>
                      {c.name} (cartão)
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file">Arquivo (CSV, OFX ou XLSX)</Label>
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border px-6 py-10 text-center hover:border-border-strong"
            >
              <Upload className="h-5 w-5 text-text-tertiary" />
              <span className="text-sm text-text-secondary">{file ? file.name : "Clique para selecionar um arquivo"}</span>
              <input
                id="file"
                type="file"
                accept=".csv,.ofx,.qfx,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <Button variant="primary" onClick={handleAnalyze} disabled={isPending || !file || !source}>
            {isPending ? "Analisando…" : "Analisar arquivo"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-border-subtle p-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <FileSpreadsheet className="h-4 w-4" />
            {analysis.fileName} · {analysis.totalRows} linha(s) encontrada(s)
          </div>

          {cardId ? (
            <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3.5">
              <Label htmlFor="statementPaymentDate">Data de vencimento/pagamento desta fatura</Label>
              <Input
                id="statementPaymentDate"
                type="date"
                required
                value={statementPaymentDate}
                onChange={(e) => setStatementPaymentDate(e.target.value)}
                className="max-w-48"
              />
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                Esse arquivo é de uma fatura só, então todas as compras nele — mesmo parcelas de compras antigas —
                contam como despesa no mês dessa data, não no mês em que cada compra foi feita.
              </p>
            </div>
          ) : null}

          {analysis.needsMapping ? (
            <>
              <p className="text-sm text-text-secondary">Confirme quais colunas do arquivo correspondem a cada campo:</p>
              <div className="grid grid-cols-2 gap-3">
                {MAPPING_FIELDS.map((field) => (
                  <div key={field.key}>
                    <Label>{field.label}</Label>
                    <Select
                      value={mapping[field.key] ?? "none"}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [field.key]: v === "none" ? undefined : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{field.required ? "Selecione…" : "Nenhuma"}</SelectItem>
                        {analysis.headers?.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {analysis.sampleRows && analysis.sampleRows.length > 0 ? (
                <div className="overflow-hidden rounded-[var(--radius-md)] border border-border-subtle">
                  <Table>
                    <Thead>
                      <Tr>
                        {analysis.headers?.map((h) => (
                          <Th key={h}>{h}</Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {analysis.sampleRows.slice(0, 5).map((row, i) => (
                        <Tr key={i}>
                          {analysis.headers?.map((h) => (
                            <Td key={h} className="text-[13px]">
                              {row[h]}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              ) : null}
            </>
          ) : (
            <Callout tone="info">Arquivo OFX identificado automaticamente — nenhum mapeamento necessário.</Callout>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setAnalysis(null); setFile(null); }}>
              Voltar
            </Button>
            <Button variant="primary" onClick={handleStage} disabled={isPending || (Boolean(cardId) && !statementPaymentDate)}>
              {isPending ? "Processando…" : "Continuar para revisão"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
