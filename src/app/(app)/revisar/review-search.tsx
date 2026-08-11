"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function ReviewSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("search", value);
    else params.delete("search");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4">
      <Input
        placeholder="Buscar por descrição…"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-72"
      />
    </div>
  );
}
