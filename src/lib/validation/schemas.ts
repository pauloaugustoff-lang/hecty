import { z } from "zod";

export const accountTypeSchema = z.enum(["corrente", "pagamento", "dinheiro", "corretora", "investimento", "outra"]);
export const cardBrandSchema = z.enum(["visa", "mastercard", "elo", "amex", "hipercard", "outra"]);
export const categoryKindSchema = z.enum(["despesa", "receita", "investimento", "transferencia", "outro"]);
export const transactionDirectionSchema = z.enum(["entrada", "saida"]);
export const transactionNatureSchema = z.enum([
  "receita_trabalho",
  "rendimento_investimento",
  "outras_receitas",
  "despesa",
  "transferencia_entre_contas",
  "aplicacao_financeira",
  "resgate_investimento",
  "resgate_a_decompor",
  "pagamento_cartao",
  "estorno",
  "reembolso",
  "repasse",
  "emprestimo",
  "ajuste",
  "nao_classificado",
]);
export const ruleMatchTypeSchema = z.enum(["contem", "comeca_com", "termina_com", "exato", "regex"]);
export const memberRoleSchema = z.enum(["proprietario", "administrador", "editor", "visualizador"]);

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a conta.").max(80),
  institution: z.string().trim().max(80).default(""),
  type: accountTypeSchema,
  initialBalanceCents: z.number().int("O saldo deve ser um valor em centavos inteiro."),
  initialBalanceDate: z.string().date(),
  currency: z.string().length(3).default("BRL"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});
export type AccountFormInput = z.infer<typeof accountFormSchema>;

export const cardFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para o cartão.").max(80),
  institution: z.string().trim().max(80).default(""),
  brand: cardBrandSchema,
  limitCents: z.number().int().nonnegative(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  paymentAccountId: z.string().uuid().nullable().optional(),
});
export type CardFormInput = z.infer<typeof cardFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a categoria.").max(60),
  kind: categoryKindSchema,
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});
export type CategoryFormInput = z.infer<typeof categoryFormSchema>;

export const tagFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para a tag.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});
export type TagFormInput = z.infer<typeof tagFormSchema>;

export const redemptionBreakdownSchema = z
  .object({
    totalAmountCents: z.number().int().positive(),
    principalCents: z.number().int().nonnegative().nullable().optional(),
    grossYieldCents: z.number().int().nullable().optional(),
    taxCents: z.number().int().nonnegative().nullable().optional(),
    feesCents: z.number().int().nonnegative().nullable().optional(),
    netYieldCents: z.number().int().nullable().optional(),
    institution: z.string().trim().max(80).default(""),
    product: z.string().trim().max(120).default(""),
    applicationDate: z.string().date().nullable().optional(),
    redemptionDate: z.string().date().nullable().optional(),
  })
  .strict();
export type RedemptionBreakdownInput = z.infer<typeof redemptionBreakdownSchema>;

export const transactionFormSchema = z
  .object({
    movementDate: z.string().date(),
    competenceDate: z.string().date(),
    originalDescription: z.string().trim().min(1).max(200),
    amountCents: z.number().int().positive("O valor deve ser maior que zero."),
    direction: transactionDirectionSchema,
    nature: transactionNatureSchema,
    accountId: z.string().uuid().nullable().optional(),
    cardId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    subcategoryId: z.string().uuid().nullable().optional(),
    counterparty: z.string().trim().max(120).default(""),
    notes: z.string().trim().max(1000).default(""),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
    /** Só relevante quando nature é "reembolso" ou "estorno": quais despesas isso cobre. */
    linkedExpenseIds: z.array(z.string().uuid()).max(50).optional().default([]),
  })
  .refine((data) => Boolean(data.accountId) !== Boolean(data.cardId), {
    message: "Informe uma conta OU um cartão, nunca os dois.",
    path: ["accountId"],
  });
export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

export const ruleFormSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome para a regra.").max(80),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(1000).default(100),
  matchType: ruleMatchTypeSchema,
  matchValues: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "Informe ao menos uma palavra-chave."),
  sourceAccountId: z.string().uuid().nullable().optional(),
  sourceCardId: z.string().uuid().nullable().optional(),
  minAmountCents: z.number().int().nonnegative().nullable().optional(),
  maxAmountCents: z.number().int().nonnegative().nullable().optional(),
  direction: transactionDirectionSchema.nullable().optional(),
  actionNature: transactionNatureSchema.nullable().optional(),
  actionCategoryId: z.string().uuid().nullable().optional(),
  actionSubcategoryId: z.string().uuid().nullable().optional(),
  actionCounterparty: z.string().trim().max(120).nullable().optional(),
  actionTags: z.array(z.string().trim().min(1).max(30)).max(10).nullable().optional(),
  actionNotes: z.string().trim().max(500).nullable().optional(),
  actionMarkTransfer: z.boolean().default(false),
  actionMarkRedemption: z.boolean().default(false),
});
export type RuleFormInput = z.infer<typeof ruleFormSchema>;

export const assetClassSchema = z.enum([
  "acao",
  "fii",
  "etf",
  "bdr",
  "stock",
  "reit",
  "fundo",
  "tesouro_direto",
  "cdb",
  "lci_lca",
  "cri_cra",
  "debenture",
  "poupanca",
  "previdencia",
  "cripto",
  "outro",
]);
export const assetPricingModeSchema = z.enum(["cotacao", "indexado", "manual"]);
export const investmentIndexSchema = z.enum(["prefixado", "cdi", "ipca", "selic", "poupanca"]);
export const investmentMovementTypeSchema = z.enum([
  "aporte",
  "resgate",
  "provento",
  "bonificacao",
  "desdobramento",
  "taxa",
  "imposto",
  "ajuste",
]);

export const investmentAssetFormSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome para o ativo.").max(120),
    assetClass: assetClassSchema,
    pricingMode: assetPricingModeSchema,
    currency: z.string().length(3).default("BRL"),
    ticker: z.string().trim().max(20).nullable().optional(),
    quoteSymbol: z.string().trim().max(30).nullable().optional(),
    rateIndex: investmentIndexSchema.nullable().optional(),
    ratePercent: z.number().nonnegative().max(1000).nullable().optional(),
    rateSpread: z.number().min(-100).max(1000).nullable().optional(),
    issueDate: z.string().date().nullable().optional(),
    maturityDate: z.string().date().nullable().optional(),
    isTaxExempt: z.boolean().default(false),
    manualValueCents: z.number().int().nonnegative().nullable().optional(),
    manualValueDate: z.string().date().nullable().optional(),
    accountId: z.string().uuid().nullable().optional(),
    institution: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(1000).default(""),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),

    // Aporte inicial informado junto com o cadastro. Quem cadastra um CDB já
    // sabe quanto aplicou; obrigar um segundo passo só para lançar isso é
    // burocracia. Só é aceito enquanto o ativo não tem nenhum movimento, o que
    // torna impossível duplicar o aporte ao editar.
    initialAmountCents: z.number().int().nonnegative().nullable().optional(),
    initialQuantity: z.number().nonnegative().nullable().optional(),
    initialUnitPriceCents: z.number().int().nonnegative().nullable().optional(),
    initialDate: z.string().date().nullable().optional(),
  })
  // Espelham os CHECK do banco: melhor recusar no formulário, com uma frase
  // que explica o que falta, do que devolver o erro cru do Postgres.
  .refine((data) => data.pricingMode !== "cotacao" || Boolean(data.quoteSymbol || data.ticker), {
    message: "Informe o ticker do ativo para buscar a cotação.",
    path: ["ticker"],
  })
  .refine((data) => data.pricingMode !== "indexado" || Boolean(data.rateIndex), {
    message: "Escolha o índice que remunera o papel.",
    path: ["rateIndex"],
  })
  .refine(
    (data) =>
      data.pricingMode !== "indexado" ||
      data.rateIndex !== "prefixado" ||
      (data.rateSpread !== null && data.rateSpread !== undefined),
    { message: "Informe a taxa anual do papel prefixado.", path: ["rateSpread"] },
  );
export type InvestmentAssetFormInput = z.infer<typeof investmentAssetFormSchema>;

export const investmentMovementFormSchema = z
  .object({
    assetId: z.string().uuid(),
    movementType: investmentMovementTypeSchema,
    movementDate: z.string().date(),
    quantity: z.number().nonnegative().default(0),
    unitPriceCents: z.number().int().nonnegative().nullable().optional(),
    amountCents: z.number().int().nonnegative().default(0),
    feesCents: z.number().int().nonnegative().default(0),
    taxCents: z.number().int().nonnegative().default(0),
    splitFactor: z.number().positive().nullable().optional(),
    transactionId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(500).default(""),
    /** Cria também o lançamento na conta indicada, para o movimento aparecer no extrato. */
    createTransactionAccountId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.movementType !== "desdobramento" || Boolean(data.splitFactor), {
    message: "Informe o fator do desdobramento (10 para um split 1:10).",
    path: ["splitFactor"],
  })
  .refine((data) => data.movementType === "desdobramento" || data.amountCents > 0 || data.quantity > 0, {
    message: "Informe o valor ou a quantidade do movimento.",
    path: ["amountCents"],
  });
export type InvestmentMovementFormInput = z.infer<typeof investmentMovementFormSchema>;

export const spaceFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome para o espaço.").max(80),
  type: z.enum(["individual", "compartilhado"]),
});
export type SpaceFormInput = z.infer<typeof spaceFormSchema>;

export const inviteFormSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  role: memberRoleSchema,
});
export type InviteFormInput = z.infer<typeof inviteFormSchema>;

export const signUpFormSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});
export type SignUpFormInput = z.infer<typeof signUpFormSchema>;

export const signInFormSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});
export type SignInFormInput = z.infer<typeof signInFormSchema>;

export const resetPasswordRequestSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
});
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
