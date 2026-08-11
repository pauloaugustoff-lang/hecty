"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface-overlay !border !border-border !text-text-primary !shadow-[var(--shadow-overlay)] !rounded-[var(--radius-md)]",
          title: "!font-sans !text-sm !font-medium",
          description: "!text-text-secondary !text-[13px]",
          actionButton: "!bg-accent !text-[var(--text-on-accent)]",
          cancelButton: "!bg-surface-sunken !text-text-secondary",
        },
      }}
    />
  );
}
