"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addMonths, endOfMonth, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import { natureLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

function centsParamToInput(value: string | null): string {
  if (!value) return "";
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "";
  return formatCentsToBRL(cents).replace("R$", "").trim();
}

export function TransactionFilters({
  accounts,
  cards,
  categories,
}: {
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [minAmountInput, setMinAmountInput] = useState(() => centsParamToInput(searchParams.get("minAmount")));
  const [maxAmountInput, setMaxAmountInput] = useState(() => centsParamToInput(searchParams.get("maxAmount")));

  const categoryId = searchParams.get("categoryId") ?? "";
  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategories = useMemo(() => categories.filter((c) => c.parent_id === categoryId), [categories, categoryId]);

  const fromParam = searchParams.get("from");
  // Serve só de âncora pras setas/seletor de mês — não precisa refletir um
  // range "de mês inteiro" de fato, já que from/to continuam livres.
  const monthAnchor = fromParam ? new Date(`${fromParam}T00:00:00`) : new Date();

  function setCompetenceMonth(monthStr: string) {
    const [year, monthNum] = monthStr.split("-").map(Number);
    if (!year || !monthNum) return;
    const first = new Date(year, monthNum - 1, 1);
    const last = endOfMonth(first);
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", format(first, "yyyy-MM-dd"));
    params.set("to", format(last, "yyyy-MM-dd"));
    params.delete("offset");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("offset");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function updateAmountParam(key: string, rawInput: string) {
    if (!rawInput.trim()) {
      updateParam(key, "");
      return;
    }
    try {
      updateParam(key, String(parseBRLToCents(rawInput)));
    } catch {
      // valor ainda incompleto (ex.: "12,") — não atualiza a URL até dar parse
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar descrição…"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => updateParam("search", e.target.value)}
        className="w-56"
      />
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-border px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCompetenceMonth(format(subMonths(monthAnchor, 1), "yyyy-MM"))}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <input
          type="month"
          value={format(monthAnchor, "yyyy-MM")}
          onChange={(e) => e.target.value && setCompetenceMonth(e.target.value)}
          className="h-7 rounded-[var(--radius-sm)] border-0 bg-transparent px-1 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          aria-label="Selecionar competência"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCompetenceMonth(format(addMonths(monthAnchor, 1), "yyyy-MM"))}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => updateParam("from", e.target.value)}
        className="w-40"
        aria-label="De"
      />
      <Input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => updateParam("to", e.target.value)}
        className="w-40"
        aria-label="Até"
      />
      <Input
        inputMode="decimal"
        placeholder="Valor mín."
        value={minAmountInput}
        onChange={(e) => {
          setMinAmountInput(e.target.value);
          updateAmountParam("minAmount", e.target.value);
        }}
        className="w-28"
        aria-label="Valor mínimo"
      />
      <Input
        inputMode="decimal"
        placeholder="Valor máx."
        value={maxAmountInput}
        onChange={(e) => {
          setMaxAmountInput(e.target.value);
          updateAmountParam("maxAmount", e.target.value);
        }}
        className="w-28"
        aria-label="Valor máximo"
      />
      <Select value={searchParams.get("accountId") ?? "all"} onValueChange={(v) => updateParam("accountId", v === "all" ? "" : v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Conta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as contas</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("cardId") ?? "all"} onValueChange={(v) => updateParam("cardId", v === "all" ? "" : v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Cartão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os cartões</SelectItem>
          {cards.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("nature") ?? "all"} onValueChange={(v) => updateParam("nature", v === "all" ? "" : v)}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Natureza" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as naturezas</SelectItem>
          {Object.entries(natureLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={categoryId || "all"}
        onValueChange={(v) => {
          const params = new URLSearchParams(searchParams.toString());
          if (v === "all") params.delete("categoryId");
          else params.set("categoryId", v);
          params.delete("subcategoryId");
          params.delete("offset");
          startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
          });
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {parentCategories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams.get("subcategoryId") ?? "all"}
        onValueChange={(v) => updateParam("subcategoryId", v === "all" ? "" : v)}
        disabled={!categoryId || subcategories.length === 0}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Subcategoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as subcategorias</SelectItem>
          {subcategories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
