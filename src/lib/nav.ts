import type { LucideIcon } from "lucide-react";
import {
  Gauge,
  ArrowLeftRight,
  Upload,
  ListChecks,
  Landmark,
  CreditCard,
  Target,
  BarChart3,
  Workflow,
  TrendingUp,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  future?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/visao-geral", label: "Visão geral", icon: Gauge },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/revisar", label: "Revisar e classificar", icon: ListChecks },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/planejamento", label: "Planejamento", icon: Target },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/regras", label: "Regras automáticas", icon: Workflow },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp, future: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
