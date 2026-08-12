"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { Input } from "@/components/ui/input";

function centsParamToInput(value: string | null): string {
  if (!value) return "";
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "";
  return formatCentsToBRL(cents).replace("R$", "").trim();
}

export function ReviewSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [minAmountInput, setMinAmountInput] = useState(() => centsParamToInput(searchParams.get("minAmount")));
  const [maxAmountInput, setMaxAmountInput] = useState(() => centsParamToInput(searchParams.get("maxAmount")));

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
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
        placeholder="Buscar por descrição…"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => updateParam("search", e.target.value)}
        className="w-72"
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
    </div>
  );
}
