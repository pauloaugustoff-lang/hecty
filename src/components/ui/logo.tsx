import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * Logotipo institucional da Hecty. Troca automaticamente entre a versão
 * para fundo claro e a versão reversa (fundo escuro) conforme o tema —
 * ver .logo-for-light / .logo-for-dark em globals.css. Os arquivos de
 * origem ficam em public/brand/ e não devem ser redesenhados.
 */
export function Logo({
  height = 26,
  className,
  variant = "auto",
}: {
  height?: number;
  className?: string;
  /** "auto" troca com o tema da página; "light"/"dark" fixam uma versão
   * independente do tema (ex.: sidebar sempre navy). */
  variant?: "auto" | "light" | "dark";
}) {
  const width = Math.round(height * (1983 / 793));

  if (variant !== "auto") {
    return (
      <span className={cn("inline-flex items-center", className)} style={{ height }}>
        <Image
          src={variant === "dark" ? "/brand/hecty-logo-horizontal-reversa.png" : "/brand/hecty-logo-horizontal.png"}
          alt="Hecty"
          width={width}
          height={height}
          className="h-full w-auto"
          priority
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)} style={{ height }}>
      <Image
        src="/brand/hecty-logo-horizontal.png"
        alt="Hecty"
        width={width}
        height={height}
        className="logo-for-light h-full w-auto"
        priority
      />
      <Image
        src="/brand/hecty-logo-horizontal-reversa.png"
        alt="Hecty"
        width={width}
        height={height}
        className="logo-for-dark h-full w-auto"
        priority
      />
    </span>
  );
}

/** Apenas o símbolo (sem o nome), para espaços reduzidos. Fundo claro. */
export function LogoSymbol({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/hecty-symbol.png"
      alt="Hecty"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
