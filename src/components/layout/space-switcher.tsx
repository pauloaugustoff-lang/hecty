"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";
import { switchSpaceAction } from "@/lib/data/spaces-actions";
import type { SpaceMembership } from "@/lib/spaces/current-space";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

export function SpaceSwitcher({ spaces, currentSpaceId }: { spaces: SpaceMembership[]; currentSpaceId: string }) {
  const [isPending, startTransition] = useTransition();
  const current = spaces.find((s) => s.id === currentSpaceId) ?? spaces[0];

  function select(spaceId: string) {
    if (spaceId === currentSpaceId) return;
    const formData = new FormData();
    formData.set("spaceId", spaceId);
    startTransition(() => {
      switchSpaceAction(formData);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised px-2.5 py-1.5 text-[13px] font-medium text-text-primary",
          "hover:border-border-strong focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
          isPending && "opacity-60",
        )}
      >
        {current?.type === "compartilhado" ? <Users className="h-3.5 w-3.5 text-text-tertiary" /> : null}
        <span className="max-w-[9rem] truncate">{current?.name ?? "Espaço"}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Seus espaços financeiros</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {spaces.map((space) => (
          <DropdownMenuItem key={space.id} onSelect={() => select(space.id)} className="justify-between">
            <span className="flex flex-col">
              <span>{space.name}</span>
              <span className="text-[11px] text-text-tertiary">{space.type === "compartilhado" ? "Compartilhado" : "Individual"}</span>
            </span>
            {space.id === currentSpaceId ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
