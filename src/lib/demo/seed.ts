import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TransactionNature } from "@/lib/supabase/types";
import { computeDedupHash } from "@/lib/import/dedup";
import { normalizeDescription } from "@/lib/import/normalize";
import { format, subMonths } from "date-fns";

type Client = SupabaseClient<Database>;

function dateInMonth(monthsAgo: number, day: number): string {
  const d = subMonths(new Date(), monthsAgo);
  return format(new Date(d.getFullYear(), d.getMonth(), day), "yyyy-MM-dd");
}

export async function seedDemoData(supabase: Client, userId: string): Promise<string> {
  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .insert({ name: "Dados de demonstração", type: "individual", owner_id: userId, is_demo: true })
    .select("id")
    .single();

  if (spaceError || !space) throw spaceError ?? new Error("Falha ao criar espaço de demonstração");
  const spaceId = space.id;

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .insert([
      {
        space_id: spaceId,
        name: "Conta corrente Itaú",
        institution: "Itaú",
        type: "corrente",
        initial_balance_cents: 8_450_00,
        initial_balance_date: dateInMonth(3, 1),
        color: "#f97316",
      },
      {
        space_id: spaceId,
        name: "Corretora XP",
        institution: "XP Investimentos",
        type: "corretora",
        initial_balance_cents: 42_300_00,
        initial_balance_date: dateInMonth(3, 1),
        color: "#0369a1",
      },
    ])
    .select("id, name");

  if (accountsError || !accounts) throw accountsError ?? new Error("Falha ao criar contas de demonstração");
  const contaCorrente = accounts.find((a) => a.name.includes("Itaú"))!;
  const corretora = accounts.find((a) => a.name.includes("XP"))!;

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .insert([
      {
        space_id: spaceId,
        name: "Cartão Nubank",
        institution: "Nubank",
        brand: "mastercard",
        limit_cents: 8_000_00,
        closing_day: 20,
        due_day: 27,
        payment_account_id: contaCorrente.id,
      },
    ])
    .select("id, name");

  if (cardsError || !cards) throw cardsError ?? new Error("Falha ao criar cartão de demonstração");
  const cartao = cards[0];

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("space_id", spaceId);

  if (categoriesError || !categories) throw categoriesError ?? new Error("Falha ao carregar categorias");
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

  interface TxSeed {
    accountId?: string;
    cardId?: string;
    date: string;
    description: string;
    amountCents: number;
    direction: "entrada" | "saida";
    nature: TransactionNature;
    categoryId?: string | null;
    subcategoryId?: string | null;
    counterparty?: string;
    classified?: boolean;
  }

  const txs: TxSeed[] = [];

  for (const m of [2, 1, 0]) {
    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 5),
      description: "SALARIO EMPRESA ACME LTDA",
      amountCents: 9_200_00,
      direction: "entrada",
      nature: "receita_trabalho",
      categoryId: cat("Receita do trabalho"),
      subcategoryId: cat("Salário"),
      counterparty: "Empresa Acme Ltda",
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 6),
      description: "ALUGUEL APTO CENTRO",
      amountCents: 2_400_00,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Moradia"),
      subcategoryId: cat("Aluguel"),
      counterparty: "Imobiliária Central",
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 8),
      description: "CONDOMINIO EDIFICIO SOLAR",
      amountCents: 620_00,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Moradia"),
      subcategoryId: cat("Condomínio"),
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 12),
      description: "CEMIG DISTRIBUICAO SA",
      amountCents: 187_32,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Moradia"),
      subcategoryId: cat("Energia elétrica"),
      counterparty: "CEMIG",
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 14),
      description: "COPASA MG",
      amountCents: 96_40,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Moradia"),
      subcategoryId: cat("Água"),
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 10),
      description: "NET VIRTUA INTERNET",
      amountCents: 129_90,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Moradia"),
      subcategoryId: cat("Internet"),
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 9),
      description: "POLLYANA DIARISTA",
      amountCents: 200_00,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Casa"),
      subcategoryId: cat("Faxineira"),
      counterparty: "Pollyana",
    });

    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 15),
      description: "UNIMED BH PLANO SAUDE",
      amountCents: 890_00,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Saúde"),
      subcategoryId: cat("Plano de saúde"),
    });

    // Cartão de crédito: compras do mês
    txs.push({
      cardId: cartao.id,
      date: dateInMonth(m, 3),
      description: "SUPERMERCADOS BH LTDA",
      amountCents: 542_17,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Alimentação"),
      subcategoryId: cat("Supermercado"),
    });

    txs.push({
      cardId: cartao.id,
      date: dateInMonth(m, 7),
      description: "IFOOD *IFOOD",
      amountCents: 68_50,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Alimentação"),
      subcategoryId: cat("Delivery"),
    });

    txs.push({
      cardId: cartao.id,
      date: dateInMonth(m, 11),
      description: "UBER *TRIP",
      amountCents: 34_90,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Transporte"),
      subcategoryId: cat("Aplicativos de transporte"),
    });

    txs.push({
      cardId: cartao.id,
      date: dateInMonth(m, 13),
      description: "NETFLIX.COM",
      amountCents: 44_90,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Lazer"),
      subcategoryId: cat("Assinaturas e streaming"),
    });

    txs.push({
      cardId: cartao.id,
      date: dateInMonth(m, 18),
      description: "POSTO SHELL BR 040",
      amountCents: 220_00,
      direction: "saida",
      nature: "despesa",
      categoryId: cat("Transporte"),
      subcategoryId: cat("Combustível"),
    });

    // Pagamento da fatura do cartão (não duplica as compras acima)
    txs.push({
      accountId: contaCorrente.id,
      date: dateInMonth(m, 27),
      description: "Pagamento fatura Cartão Nubank",
      amountCents: 910_47,
      direction: "saida",
      nature: "pagamento_cartao",
      classified: true,
    });
  }

  // Transferência entre contas próprias (aplicação na corretora)
  txs.push({
    accountId: contaCorrente.id,
    date: dateInMonth(1, 20),
    description: "Transferência para corretora XP",
    amountCents: 3_000_00,
    direction: "saida",
    nature: "transferencia_entre_contas",
    classified: true,
  });
  txs.push({
    accountId: corretora.id,
    date: dateInMonth(1, 20),
    description: "Transferência recebida de conta corrente",
    amountCents: 3_000_00,
    direction: "entrada",
    nature: "transferencia_entre_contas",
    classified: true,
  });

  // Aplicação financeira
  txs.push({
    accountId: corretora.id,
    date: dateInMonth(1, 21),
    description: "APLICACAO CDB 118% CDI",
    amountCents: 3_000_00,
    direction: "saida",
    nature: "aplicacao_financeira",
    classified: true,
  });

  // Rendimento de FII (receita de investimento simples)
  txs.push({
    accountId: corretora.id,
    date: dateInMonth(0, 15),
    description: "RENDIMENTO FII HGLG11",
    amountCents: 187_40,
    direction: "entrada",
    nature: "rendimento_investimento",
    categoryId: cat("Rendimentos de investimentos"),
    subcategoryId: cat("Rendimentos de FIIs"),
  });

  const results = txs.map((t) => {
    const dedupHash = computeDedupHash({
      spaceId,
      accountId: t.accountId ?? null,
      cardId: t.cardId ?? null,
      movementDate: t.date,
      amountCents: t.amountCents,
      direction: t.direction,
      description: t.description,
    });

    return {
      space_id: spaceId,
      account_id: t.accountId ?? null,
      card_id: t.cardId ?? null,
      movement_date: t.date,
      competence_date: t.date,
      original_description: t.description,
      normalized_description: normalizeDescription(t.description),
      amount_cents: t.amountCents,
      direction: t.direction,
      nature: t.nature,
      category_id: t.categoryId ?? null,
      subcategory_id: t.subcategoryId ?? null,
      counterparty: t.counterparty ?? "",
      origin: "manual" as const,
      classification_status: t.classified || t.categoryId ? ("classificado" as const) : ("nao_classificado" as const),
      dedup_hash: dedupHash,
    };
  });

  const { error: txError } = await supabase.from("transactions").insert(results);
  if (txError) throw txError;

  // Resgate de renda fixa decomposto — exatamente o exemplo do produto:
  // R$ 105.000 no extrato = R$ 100.000 de principal + R$ 5.000 de receita.
  const { data: resgateTx, error: resgateError } = await supabase
    .from("transactions")
    .insert({
      space_id: spaceId,
      account_id: corretora.id,
      movement_date: dateInMonth(0, 22),
      competence_date: dateInMonth(0, 22),
      original_description: "RESGATE CDB BANCO INTER",
      normalized_description: normalizeDescription("RESGATE CDB BANCO INTER"),
      amount_cents: 105_000_00,
      direction: "entrada",
      nature: "resgate_investimento",
      classification_status: "classificado",
      dedup_hash: computeDedupHash({
        spaceId,
        accountId: corretora.id,
        cardId: null,
        movementDate: dateInMonth(0, 22),
        amountCents: 105_000_00,
        direction: "entrada",
        description: "RESGATE CDB BANCO INTER",
      }),
    })
    .select("id")
    .single();

  if (resgateError || !resgateTx) throw resgateError ?? new Error("Falha ao criar resgate de demonstração");

  await supabase.from("redemption_details").insert({
    transaction_id: resgateTx.id,
    space_id: spaceId,
    total_amount_cents: 105_000_00,
    principal_cents: 100_000_00,
    net_yield_cents: 5_000_00,
    institution: "Banco Inter",
    product: "CDB 115% CDI",
    application_date: dateInMonth(8, 22),
    redemption_date: dateInMonth(0, 22),
  });

  // Resgate a decompor — extrato só trouxe o valor total.
  const decomporDate = dateInMonth(0, 24);
  const decomporDescription = "RESGATE APLICACAO AUTOMATICA";
  const { data: decomporTx, error: decomporError } = await supabase
    .from("transactions")
    .insert({
      space_id: spaceId,
      account_id: contaCorrente.id,
      movement_date: decomporDate,
      competence_date: decomporDate,
      original_description: decomporDescription,
      normalized_description: normalizeDescription(decomporDescription),
      amount_cents: 1_240_18,
      direction: "entrada",
      nature: "resgate_a_decompor",
      classification_status: "nao_classificado",
      dedup_hash: computeDedupHash({
        spaceId,
        accountId: contaCorrente.id,
        cardId: null,
        movementDate: decomporDate,
        amountCents: 1_240_18,
        direction: "entrada",
        description: decomporDescription,
      }),
    })
    .select("id")
    .single();

  if (decomporError || !decomporTx) throw decomporError ?? new Error("Falha ao criar resgate a decompor de demonstração");

  await supabase.from("redemption_details").insert({
    transaction_id: decomporTx.id,
    space_id: spaceId,
    total_amount_cents: 1_240_18,
    institution: "Banco Inter",
    product: "Poupança programada",
  });

  // Uma regra de exemplo, já demonstrando a automação.
  await supabase.from("rules").insert({
    space_id: spaceId,
    name: "Supermercados BH",
    match_type: "contem",
    match_value: "SUPERMERCADOS BH",
    action_nature: "despesa",
    action_category_id: cat("Alimentação"),
    action_subcategory_id: cat("Supermercado"),
    created_by: userId,
  });

  return spaceId;
}
