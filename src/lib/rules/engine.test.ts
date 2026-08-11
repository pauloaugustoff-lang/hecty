import { describe, expect, it } from "vitest";
import { actionFromRule, findMatchingRule, ruleMatches, type RuleDefinition } from "./engine";

function makeRule(overrides: Partial<RuleDefinition> = {}): RuleDefinition {
  return {
    id: "rule-1",
    name: "Regra de teste",
    isActive: true,
    priority: 100,
    matchType: "contem",
    matchValue: "SUPERMERCADOS BH",
    actionNature: "despesa",
    actionCategoryId: "cat-alimentacao",
    actionSubcategoryId: "sub-supermercado",
    ...overrides,
  };
}

const candidate = {
  description: "COMPRA SUPERMERCADOS BH LTDA",
  amountCents: 15_000,
  direction: "saida" as const,
  accountId: "acc-1",
  cardId: null,
};

describe("ruleMatches", () => {
  it("casa quando a descrição contém o texto (ignora acento/caixa)", () => {
    expect(ruleMatches(makeRule({ matchValue: "supermercados bh" }), candidate)).toBe(true);
  });

  it("não casa quando a regra está inativa", () => {
    expect(ruleMatches(makeRule({ isActive: false }), candidate)).toBe(false);
  });

  it("respeita comeca_com", () => {
    expect(ruleMatches(makeRule({ matchType: "comeca_com", matchValue: "COMPRA" }), candidate)).toBe(true);
    expect(ruleMatches(makeRule({ matchType: "comeca_com", matchValue: "SUPERMERCADOS" }), candidate)).toBe(false);
  });

  it("respeita termina_com", () => {
    expect(ruleMatches(makeRule({ matchType: "termina_com", matchValue: "LTDA" }), candidate)).toBe(true);
  });

  it("respeita exato", () => {
    expect(ruleMatches(makeRule({ matchType: "exato", matchValue: candidate.description }), candidate)).toBe(true);
    expect(ruleMatches(makeRule({ matchType: "exato", matchValue: "OUTRA COISA" }), candidate)).toBe(false);
  });

  it("suporta regex em modo avançado", () => {
    expect(ruleMatches(makeRule({ matchType: "regex", matchValue: "^COMPRA .*BH" }), candidate)).toBe(true);
  });

  it("regex inválida não derruba a avaliação, apenas não casa", () => {
    expect(ruleMatches(makeRule({ matchType: "regex", matchValue: "(" }), candidate)).toBe(false);
  });

  it("filtra por conta de origem", () => {
    expect(ruleMatches(makeRule({ sourceAccountId: "acc-2" }), candidate)).toBe(false);
    expect(ruleMatches(makeRule({ sourceAccountId: "acc-1" }), candidate)).toBe(true);
  });

  it("filtra por direção", () => {
    expect(ruleMatches(makeRule({ direction: "entrada" }), candidate)).toBe(false);
  });

  it("filtra por faixa de valor", () => {
    expect(ruleMatches(makeRule({ minAmountCents: 20_000 }), candidate)).toBe(false);
    expect(ruleMatches(makeRule({ maxAmountCents: 10_000 }), candidate)).toBe(false);
    expect(ruleMatches(makeRule({ minAmountCents: 10_000, maxAmountCents: 20_000 }), candidate)).toBe(true);
  });
});

describe("findMatchingRule", () => {
  it("escolhe a regra de maior prioridade (menor número) entre as que casam", () => {
    const specific = makeRule({ id: "specific", priority: 1, matchValue: "SUPERMERCADOS BH" });
    const generic = makeRule({ id: "generic", priority: 50, matchValue: "COMPRA" });

    const winner = findMatchingRule([generic, specific], candidate);
    expect(winner?.id).toBe("specific");
  });

  it("retorna null quando nenhuma regra casa", () => {
    const winner = findMatchingRule([makeRule({ matchValue: "ALGO QUE NAO EXISTE" })], candidate);
    expect(winner).toBeNull();
  });
});

describe("actionFromRule", () => {
  it("converte os campos de ação da regra", () => {
    const action = actionFromRule(
      makeRule({ actionTags: ["mercado"], actionMarkTransfer: true }),
    );

    expect(action).toMatchObject({
      nature: "despesa",
      categoryId: "cat-alimentacao",
      subcategoryId: "sub-supermercado",
      tags: ["mercado"],
      markTransfer: true,
      markRedemption: false,
    });
  });
});
