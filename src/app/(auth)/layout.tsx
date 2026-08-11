import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex justify-end px-4 py-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="mb-10 flex flex-col items-center gap-2">
          <Logo height={64} />
          <span className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Controle pessoal de receitas, despesas e investimentos</span>
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <footer className="border-t border-border-subtle px-4 py-4 text-center text-xs text-text-tertiary">
        Seus dados financeiros ficam isolados no seu espaço — nunca visíveis a outros usuários.
      </footer>
    </div>
  );
}
