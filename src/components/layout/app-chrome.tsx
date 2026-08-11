"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils/cn";
import { signOutAction } from "@/app/(auth)/actions";
import { SpaceSwitcher } from "./space-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { SpaceMembership } from "@/lib/spaces/current-space";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex-1 space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-[var(--radius-md)] px-4 py-3 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-[var(--blue)] text-white shadow-[var(--shadow-sm)]"
                  : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                item.future && "opacity-60",
              )}
            >
              <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
              <span className="flex-1">{item.label}</span>
              {item.future ? (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                  em breve
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Wordmark() {
  return (
    <span className="mb-6 flex items-center px-2">
      <Logo height={40} variant="dark" />
    </span>
  );
}

export function AppChrome({
  spaces,
  currentSpaceId,
  userName,
  userEmail,
  children,
}: {
  spaces: SpaceMembership[];
  currentSpaceId: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <aside className="hidden h-full w-60 shrink-0 flex-col bg-[var(--navy)] px-3 py-5 md:flex">
        <Wordmark />
        <NavLinks />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(10,13,17,0.5)] md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--navy)] px-3 py-5 md:hidden">
            <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
            <Wordmark />
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu className="h-4 w-4" />
            </Button>
            <SpaceSwitcher spaces={spaces} currentSpaceId={currentSpaceId} />
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                <User className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block truncate font-medium text-text-primary">{userName}</span>
                  <span className="block truncate text-text-tertiary">{userEmail}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOutAction} className="w-full">
                    <button type="submit" className="flex w-full items-center gap-2 text-negative">
                      <LogOut className="h-3.5 w-3.5" /> Sair
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
