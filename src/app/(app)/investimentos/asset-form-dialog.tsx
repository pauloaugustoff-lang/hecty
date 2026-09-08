"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Pencil, Search, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createAssetAction, updateAssetAction, previewQuoteAction, type ActionState } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import type { AssetClass, AssetPricingMode, InvestmentAssetRow, InvestmentIndex } from "@/lib/supabase/types";
import {
  assetClassLabels,
  defaultPricingMode,
  investmentIndexLabels,
  pricingModeLabels,
} from "@/lib/investments/labels";
import { defaultCurrencyForClass, resolveQuoteSymbol } from "@/lib/investments/symbols";
import { parseToCents, formatCents, CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/money/money";
import { sortByName, sortEntriesByLabel } from "@/lib/utils/sort";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const ASSET_COLORS = ["#109b7e", "#1e4db7", "#b7791f", "#5c4b87", "#0b1d3a", "#5b6472"];

const initialState: ActionState = {};

function centsToInput(cents: number | null, currency: string): string {
  if (cents === null) return "";
  return formatCents(cents, currency)
    .replace(/[^\d,.-]/g, "")
    .trim();
}

export function AssetFormDialog({
  spaceId,
  accounts,
  asset,
  movementCount = 0,
}: {
  spaceId: string;
  accounts: AccountRow[];
  asset?: InvestmentAssetRow;
  /** Quantos movimentos o ativo já tem — decide se ainda cabe pedir o aporte inicial. */
  movementCount?: number;
}) {
  const isEdit = Boolean(asset);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateAssetAction.bind(null, asset!.id, spaceId)
    : createAssetAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const [assetClass, setAssetClass] = useState<AssetClass>(asset?.asset_class ?? "acao");
  const [pricingMode, setPricingMode] = useState<AssetPricingMode>(asset?.pricing_mode ?? defaultPricingMode("acao"));
  const [currency, setCurrency] = useState<CurrencyCode>((asset?.currency as CurrencyCode) ?? "BRL");
  const [ticker, setTicker] = useState(asset?.ticker ?? "");
  const [quoteSymbol, setQuoteSymbol] = useState(asset?.quote_symbol ?? "");
  const [rateIndex, setRateIndex] = useState<InvestmentIndex | "">(asset?.rate_index ?? "");
  const [accountId, setAccountId] = useState(asset?.account_id ?? "");
  const [color, setColor] = useState(asset?.color ?? ASSET_COLORS[0]);
  const [manualValueInput, setManualValueInput] = useState(
    centsToInput(asset?.manual_value_cents ?? null, asset?.currency ?? "BRL"),
  );

  // Aporte inicial: quem cadastra um CDB já sabe quanto aplicou, e obrigar um
  // segundo passo só para lançar isso é burocracia. O bloco desaparece assim
  // que o ativo tem qualquer movimento, então nunca dá para duplicar o aporte.
  const showInitialContribution = !isEdit || movementCount === 0;
  const [initialAmountInput, setInitialAmountInput] = useState("");
  const [initialQuantityInput, setInitialQuantityInput] = useState("");
  const [initialUnitPriceInput, setInitialUnitPriceInput] = useState("");

  const [quotePreview, setQuotePreview] = useState<string | null>(null);
  const [isCheckingQuote, startQuoteCheck] = useTransition();

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Ativo atualizado" : "Ativo cadastrado");
      setOpen(false);
    }
  }, [state, isEdit]);

  /**
   * Trocar a classe reposiciona o modo de precificação e a moeda para o que
   * costuma valer naquela classe — quem cadastra uma ação americana não deveria
   * ter que lembrar de mudar para dólar. Continua tudo editável depois.
   */
  function changeAssetClass(next: AssetClass) {
    if (next === assetClass) return;
    setAssetClass(next);
    setPricingMode(defaultPricingMode(next));
    setCurrency(defaultCurrencyForClass(next) as CurrencyCode);
    setQuotePreview(null);
  }

  function checkQuote() {
    startQuoteCheck(async () => {
      const result = await previewQuoteAction(assetClass, ticker || null, quoteSymbol || null);
      if ("error" in result) {
        setQuotePreview(null);
        toast.error(result.error);
        return;
      }
      setQuotePreview(`${result.symbol}: ${formatCents(result.closeCents, result.currency)} em ${result.quoteDate}`);
      // O provedor sabe a moeda melhor do que o palpite pela classe.
      if (CURRENCIES.includes(result.currency as CurrencyCode)) setCurrency(result.currency as CurrencyCode);
    });
  }

  const resolvedSymbol = resolveQuoteSymbol({ asset_class: assetClass, ticker, quote_symbol: quoteSymbol });

  function toCents(input: string): number | null {
    if (!input.trim()) return null;
    try {
      return parseToCents(input, currency);
    } catch {
      return null;
    }
  }

  function toNumber(input: string): number | null {
    if (!input.trim()) return null;
    const value = Number(input.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  const initialQuantity = toNumber(initialQuantityInput);
  const initialUnitPriceCents = toCents(initialUnitPriceInput);
  // Em papel cotado o valor sai de quantidade x preço, e o servidor faz essa
  // conta — mandar o total daqui só abriria espaço para os dois divergirem.
  const initialAmountCents = pricingMode === "cotacao" ? null : toCents(initialAmountInput);
  const derivedInitialAmount =
    initialQuantity && initialUnitPriceCents ? Math.round(initialQuantity * initialUnitPriceCents) : null;

  let manualValueCents: number | null = null;
  if (manualValueInput) {
    try {
      manualValueCents = parseToCents(manualValueInput, currency);
    } catch {
      manualValueCents = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Editar ${asset?.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Novo ativo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          <DialogDescription>
            O cadastro já aceita o valor aplicado. Resgates, proventos e novos aportes entram depois, em Movimentos.
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="assetClass" value={assetClass} />
          <input type="hidden" name="pricingMode" value={pricingMode} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="rateIndex" value={rateIndex} />
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="color" value={color} />
          {pricingMode === "manual" ? (
            <input type="hidden" name="manualValueCents" value={manualValueCents ?? ""} />
          ) : null}
          {showInitialContribution ? (
            <>
              <input type="hidden" name="initialAmountCents" value={initialAmountCents ?? ""} />
              <input type="hidden" name="initialQuantity" value={initialQuantity ?? ""} />
              <input type="hidden" name="initialUnitPriceCents" value={initialUnitPriceCents ?? ""} />
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="asset-name">Nome</Label>
              <Input
                id="asset-name"
                name="name"
                required
                defaultValue={asset?.name}
                placeholder="Petrobras PN, CDB Inter 2027, Vanguard S&P 500"
              />
            </div>

            <div>
              <Label htmlFor="asset-class">Tipo</Label>
              <Select value={assetClass} onValueChange={(v) => changeAssetClass(v as AssetClass)}>
                <SelectTrigger id="asset-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortEntriesByLabel(Object.entries(assetClassLabels) as [AssetClass, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="asset-pricing">Como calcular o saldo</Label>
              <Select value={pricingMode} onValueChange={(v) => setPricingMode(v as AssetPricingMode)}>
                <SelectTrigger id="asset-pricing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(pricingModeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pricingMode === "cotacao" ? (
              <>
                <div>
                  <Label htmlFor="asset-ticker">Ticker</Label>
                  <Input
                    id="asset-ticker"
                    name="ticker"
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value.toUpperCase());
                      setQuotePreview(null);
                    }}
                    placeholder="PETR4, MXRF11, VOO"
                    autoCapitalize="characters"
                  />
                </div>
                <div>
                  <Label htmlFor="asset-currency">Moeda</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                    <SelectTrigger id="asset-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-sunken/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-text-secondary">
                      Símbolo no provedor:{" "}
                      <span className="font-medium text-text-primary">{resolvedSymbol ?? "—"}</span>
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={checkQuote}
                      disabled={isCheckingQuote || !resolvedSymbol}
                    >
                      {isCheckingQuote ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      Testar cotação
                    </Button>
                  </div>
                  {quotePreview ? (
                    <p className="flex items-center gap-1.5 text-[13px] text-positive">
                      <Check className="h-3.5 w-3.5" /> {quotePreview}
                    </p>
                  ) : null}
                  <div>
                    <Label htmlFor="asset-quote-symbol" className="text-[11px]">
                      Símbolo alternativo (opcional)
                    </Label>
                    <Input
                      id="asset-quote-symbol"
                      name="quoteSymbol"
                      value={quoteSymbol}
                      onChange={(e) => {
                        setQuoteSymbol(e.target.value.toUpperCase());
                        setQuotePreview(null);
                      }}
                      placeholder="Só se o padrão acima não encontrar o papel"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {pricingMode === "indexado" ? (
              <>
                <div>
                  <Label htmlFor="asset-index">Índice</Label>
                  <Select value={rateIndex} onValueChange={(v) => setRateIndex(v as InvestmentIndex)}>
                    <SelectTrigger id="asset-index">
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(investmentIndexLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="asset-rate-percent">% do índice</Label>
                    <Input
                      id="asset-rate-percent"
                      name="ratePercent"
                      inputMode="decimal"
                      defaultValue={asset?.rate_percent ?? ""}
                      placeholder="110"
                      disabled={rateIndex === "prefixado"}
                    />
                  </div>
                  <div>
                    <Label htmlFor="asset-rate-spread">
                      {rateIndex === "prefixado" ? "Taxa a.a. (%)" : "+ % a.a."}
                    </Label>
                    <Input
                      id="asset-rate-spread"
                      name="rateSpread"
                      inputMode="decimal"
                      defaultValue={asset?.rate_spread ?? ""}
                      placeholder={rateIndex === "prefixado" ? "12" : "5,5"}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="asset-issue-date">Data de aplicação</Label>
                  <Input id="asset-issue-date" name="issueDate" type="date" defaultValue={asset?.issue_date ?? ""} />
                </div>
                <div>
                  <Label htmlFor="asset-maturity-date">Vencimento</Label>
                  <Input
                    id="asset-maturity-date"
                    name="maturityDate"
                    type="date"
                    defaultValue={asset?.maturity_date ?? ""}
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-[13px] text-text-secondary">
                  <Checkbox name="isTaxExempt" defaultChecked={asset?.is_tax_exempt} value="true" />
                  Isento de imposto de renda (LCI, LCA, CRI, CRA, debênture incentivada)
                </label>
              </>
            ) : null}

            {pricingMode === "manual" ? (
              <>
                <div>
                  <Label htmlFor="asset-manual-value">Saldo atual ({currency})</Label>
                  <Input
                    id="asset-manual-value"
                    inputMode="decimal"
                    value={manualValueInput}
                    onChange={(e) => setManualValueInput(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label htmlFor="asset-manual-date">Data do saldo</Label>
                  <Input
                    id="asset-manual-date"
                    name="manualValueDate"
                    type="date"
                    defaultValue={asset?.manual_value_date ?? new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </>
            ) : null}

            {showInitialContribution ? (
              <div className="col-span-2 space-y-3 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3">
                <p className="text-[13px] font-medium text-text-primary">
                  {pricingMode === "indexado" ? "Valor aplicado" : "Aporte inicial"}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {pricingMode === "cotacao" ? (
                    <>
                      <div>
                        <Label htmlFor="asset-initial-quantity">Quantidade</Label>
                        <Input
                          id="asset-initial-quantity"
                          inputMode="decimal"
                          value={initialQuantityInput}
                          onChange={(e) => setInitialQuantityInput(e.target.value)}
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="asset-initial-price">Preço pago ({currency})</Label>
                        <Input
                          id="asset-initial-price"
                          inputMode="decimal"
                          value={initialUnitPriceInput}
                          onChange={(e) => setInitialUnitPriceInput(e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label htmlFor="asset-initial-amount">Valor ({currency})</Label>
                      <Input
                        id="asset-initial-amount"
                        inputMode="decimal"
                        value={initialAmountInput}
                        onChange={(e) => setInitialAmountInput(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="asset-initial-date">Data</Label>
                    <Input
                      id="asset-initial-date"
                      name="initialDate"
                      type="date"
                      defaultValue={pricingMode === "indexado" ? "" : new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-text-tertiary">
                  {derivedInitialAmount
                    ? `Total: ${formatCents(derivedInitialAmount, currency)}. `
                    : ""}
                  Isso lança o primeiro aporte do ativo.
                  {pricingMode === "indexado" ? " Sem data, vale a data de aplicação acima." : ""} Só o investimento é
                  registrado — se esse dinheiro já saiu da sua conta e está no extrato, vincule o lançamento pela
                  carteira em vez de lançá-lo de novo.
                </p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="asset-account">Conta / corretora</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="asset-account">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {sortByName(accounts).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="asset-institution">Instituição</Label>
              <Input
                id="asset-institution"
                name="institution"
                defaultValue={asset?.institution}
                placeholder="XP, Inter, Nubank"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="asset-notes">Observações</Label>
              <Textarea id="asset-notes" name="notes" rows={2} defaultValue={asset?.notes} />
            </div>

            <div className="col-span-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {ASSET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full border-2 transition-transform"
                    style={{ backgroundColor: c, borderColor: color === c ? "var(--text-primary)" : "transparent" }}
                    aria-label={`Selecionar cor ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
