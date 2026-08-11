import { normalizeDescription } from "@/lib/import/normalize";
import type { RuleMatchType, TransactionDirection, TransactionNature } from "@/lib/supabase/types";

export interface RuleDefinition {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  matchType: RuleMatchType;
  matchValue: string;
  sourceAccountId?: string | null;
  sourceCardId?: string | null;
  minAmountCents?: number | null;
  maxAmountCents?: number | null;
  direction?: TransactionDirection | null;
  actionNature?: TransactionNature | null;
  actionCategoryId?: string | null;
  actionSubcategoryId?: string | null;
  actionCounterparty?: string | null;
  actionTags?: string[] | null;
  actionNotes?: string | null;
  actionMarkTransfer?: boolean;
  actionMarkRedemption?: boolean;
}

export interface RuleCandidate {
  description: string;
  amountCents: number;
  direction: TransactionDirection;
  accountId?: string | null;
  cardId?: string | null;
}

export interface RuleAction {
  nature?: TransactionNature;
  categoryId?: string;
  subcategoryId?: string;
  counterparty?: string;
  tags?: string[];
  notes?: string;
  markTransfer?: boolean;
  markRedemption?: boolean;
}

function matchesText(description: string, matchType: RuleMatchType, matchValue: string): boolean {
  if (matchType === "regex") {
    try {
      return new RegExp(matchValue, "i").test(description);
    } catch {
      return false;
    }
  }

  const normalizedDescription = normalizeDescription(description);
  const normalizedValue = normalizeDescription(matchValue);

  switch (matchType) {
    case "contem":
      return normalizedDescription.includes(normalizedValue);
    case "comeca_com":
      return normalizedDescription.startsWith(normalizedValue);
    case "termina_com":
      return normalizedDescription.endsWith(normalizedValue);
    case "exato":
      return normalizedDescription === normalizedValue;
    default:
      return false;
  }
}

export function ruleMatches(rule: RuleDefinition, candidate: RuleCandidate): boolean {
  if (!rule.isActive) return false;

  if (!matchesText(candidate.description, rule.matchType, rule.matchValue)) return false;

  if (rule.sourceAccountId && rule.sourceAccountId !== candidate.accountId) return false;
  if (rule.sourceCardId && rule.sourceCardId !== candidate.cardId) return false;
  if (rule.direction && rule.direction !== candidate.direction) return false;
  if (rule.minAmountCents != null && candidate.amountCents < rule.minAmountCents) return false;
  if (rule.maxAmountCents != null && candidate.amountCents > rule.maxAmountCents) return false;

  return true;
}

/** Regras são avaliadas em ordem de prioridade (menor primeiro); a primeira que casar vence. */
export function findMatchingRule(rules: RuleDefinition[], candidate: RuleCandidate): RuleDefinition | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find((rule) => ruleMatches(rule, candidate)) ?? null;
}

export function actionFromRule(rule: RuleDefinition): RuleAction {
  return {
    nature: rule.actionNature ?? undefined,
    categoryId: rule.actionCategoryId ?? undefined,
    subcategoryId: rule.actionSubcategoryId ?? undefined,
    counterparty: rule.actionCounterparty ?? undefined,
    tags: rule.actionTags ?? undefined,
    notes: rule.actionNotes ?? undefined,
    markTransfer: rule.actionMarkTransfer ?? false,
    markRedemption: rule.actionMarkRedemption ?? false,
  };
}
