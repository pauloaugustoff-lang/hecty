import { describe, expect, it } from "vitest";
import { classificationStatusFor } from "./classification";

describe("classificationStatusFor", () => {
  it("mantém pendente o que ainda exige ação do usuário", () => {
    expect(classificationStatusFor("nao_classificado", true)).toBe("nao_classificado");
  });

  it("naturezas com categoria opcional ficam classificadas só pela natureza", () => {
    expect(classificationStatusFor("transferencia_entre_contas", false)).toBe("classificado");
    expect(classificationStatusFor("pagamento_cartao", false)).toBe("classificado");
    expect(classificationStatusFor("reembolso", false)).toBe("classificado");
    expect(classificationStatusFor("estorno", false)).toBe("classificado");
    expect(classificationStatusFor("repasse", false)).toBe("classificado");
    expect(classificationStatusFor("ajuste", false)).toBe("classificado");
    expect(classificationStatusFor("emprestimo", false)).toBe("classificado");
    // Resgate a decompor: a decomposição pendente é acompanhada pelo aviso
    // próprio de resgates, não pela fila de classificação.
    expect(classificationStatusFor("resgate_a_decompor", false)).toBe("classificado");
  });

  it("despesas e receitas exigem categoria para sair da fila de revisão", () => {
    expect(classificationStatusFor("despesa", false)).toBe("nao_classificado");
    expect(classificationStatusFor("despesa", true)).toBe("classificado");
    expect(classificationStatusFor("receita_trabalho", false)).toBe("nao_classificado");
    expect(classificationStatusFor("outras_receitas", true)).toBe("classificado");
  });
});
