import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";

export default function InvestimentosPage() {
  return (
    <div>
      <PageHeader title="Investimentos" description="Acompanhamento de carteira e posições — planejado para um próximo ciclo." />
      <EmptyState
        icon={TrendingUp}
        title="Em breve"
        description="Nesta primeira versão, os movimentos de investimento (aplicações e resgates) já são registrados em Transações e decompostos entre principal e rendimento. O acompanhamento de posições e rentabilidade da carteira chega em uma próxima etapa."
      />
    </div>
  );
}
