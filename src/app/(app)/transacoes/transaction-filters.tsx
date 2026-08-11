"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import { natureLabels } from "@/lib/domain/labels";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function TransactionFilters({ accounts, cards }: { accounts: AccountRow[]; cards: CardRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Buscar descrição…"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => updateParam("search", e.target.value)}
        className="w-56"
      />
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
    </div>
  );
}
