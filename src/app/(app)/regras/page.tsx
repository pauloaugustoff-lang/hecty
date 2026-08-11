import { redirect } from "next/navigation";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { createClient } from "@/lib/supabase/server";
import { listRules } from "@/lib/data/rules";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/categories";
import { natureLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Workflow } from "lucide-react";
import { RuleFormDialog } from "./rule-form-dialog";
import { DeleteRuleButton } from "./delete-rule-button";
import { ToggleActiveSwitch } from "./toggle-active-switch";

const MATCH_TYPE_SHORT: Record<string, string> = {
  contem: "contém",
  comeca_com: "começa com",
  termina_com: "termina com",
  exato: "=",
  regex: "regex",
};

export default async function RegrasPage() {
  const space = await requireCurrentSpace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [rules, accounts, cards, categories] = await Promise.all([
    listRules(space.id),
    listAccounts(space.id),
    listCards(space.id),
    listCategories(space.id),
  ]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  return (
    <div>
      <PageHeader
        title="Regras automáticas"
        description="Classificam novos lançamentos automaticamente com base na descrição, conta, cartão e valor. A primeira regra que casar, por prioridade, é aplicada."
        actions={<RuleFormDialog spaceId={space.id} userId={user.id} accounts={accounts} cards={cards} categories={categories} />}
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhuma regra criada"
          description='Ex.: descrição contém "CEMIG" → Despesa &gt; Moradia &gt; Energia elétrica.'
          action={<RuleFormDialog spaceId={space.id} userId={user.id} accounts={accounts} cards={cards} categories={categories} />}
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle">
          <Table>
            <Thead>
              <Tr>
                <Th>Prioridade</Th>
                <Th>Regra</Th>
                <Th>Condição</Th>
                <Th>Classifica como</Th>
                <Th>Aplicada</Th>
                <Th>Ativa</Th>
                <Th className="w-24" />
              </Tr>
            </Thead>
            <Tbody>
              {rules.map((rule) => (
                <Tr key={rule.id} className={rule.is_active ? "" : "opacity-50"}>
                  <Td className="tabular text-text-secondary">{rule.priority}</Td>
                  <Td className="font-medium">{rule.name}</Td>
                  <Td className="text-[13px] text-text-secondary">
                    descrição {MATCH_TYPE_SHORT[rule.match_type]}{" "}
                    {rule.match_values.map((v, i) => (
                      <span key={v}>
                        {i > 0 ? " ou " : ""}
                        &quot;{v}&quot;
                      </span>
                    ))}
                    {rule.min_amount_cents ? ` · mín. ${formatCentsToBRL(rule.min_amount_cents)}` : ""}
                  </Td>
                  <Td className="text-[13px] text-text-secondary">
                    {rule.action_nature ? natureLabels[rule.action_nature] : "—"}
                    {categoryName(rule.action_category_id) ? ` · ${categoryName(rule.action_category_id)}` : ""}
                  </Td>
                  <Td className="tabular text-text-secondary">{rule.times_applied}x</Td>
                  <Td>
                    <ToggleActiveSwitch ruleId={rule.id} isActive={rule.is_active} />
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <RuleFormDialog spaceId={space.id} userId={user.id} accounts={accounts} cards={cards} categories={categories} rule={rule} />
                      <DeleteRuleButton ruleId={rule.id} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
