-- Categorias padrão criadas automaticamente para todo novo espaço
-- financeiro. O espaço pode depois criar, editar, arquivar e reorganizar
-- livremente as suas próprias categorias.

create or replace function seed_default_categories(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cat_id uuid;
begin
  -- Despesas -------------------------------------------------------------
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Alimentação', '#f97316', 10, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Supermercado', 1, true),
    (p_space_id, cat_id, 'despesa', 'Restaurante', 2, true),
    (p_space_id, cat_id, 'despesa', 'Delivery', 3, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Moradia', '#0ea5e9', 20, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Aluguel', 1, true),
    (p_space_id, cat_id, 'despesa', 'Condomínio', 2, true),
    (p_space_id, cat_id, 'despesa', 'Energia elétrica', 3, true),
    (p_space_id, cat_id, 'despesa', 'Água', 4, true),
    (p_space_id, cat_id, 'despesa', 'Gás', 5, true),
    (p_space_id, cat_id, 'despesa', 'Internet', 6, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Transporte', '#8b5cf6', 30, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Combustível', 1, true),
    (p_space_id, cat_id, 'despesa', 'Aplicativos de transporte', 2, true),
    (p_space_id, cat_id, 'despesa', 'Transporte público', 3, true),
    (p_space_id, cat_id, 'despesa', 'Estacionamento', 4, true),
    (p_space_id, cat_id, 'despesa', 'Manutenção veicular', 5, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Saúde', '#22c55e', 40, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Plano de saúde', 1, true),
    (p_space_id, cat_id, 'despesa', 'Farmácia', 2, true),
    (p_space_id, cat_id, 'despesa', 'Consultas e exames', 3, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Casa', '#14b8a6', 50, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Faxineira', 1, true),
    (p_space_id, cat_id, 'despesa', 'Manutenção', 2, true),
    (p_space_id, cat_id, 'despesa', 'Móveis e utensílios', 3, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Lazer', '#ec4899', 60, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Assinaturas e streaming', 1, true),
    (p_space_id, cat_id, 'despesa', 'Viagens', 2, true),
    (p_space_id, cat_id, 'despesa', 'Bares e baladas', 3, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Educação', '#6366f1', 70, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Cursos', 1, true),
    (p_space_id, cat_id, 'despesa', 'Material didático', 2, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Compras pessoais', '#f43f5e', 80, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Vestuário', 1, true),
    (p_space_id, cat_id, 'despesa', 'Eletrônicos', 2, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Pets', '#a855f7', 90, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'Veterinário', 1, true),
    (p_space_id, cat_id, 'despesa', 'Petshop', 2, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Impostos e taxas', '#78716c', 100, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'despesa', 'IPTU', 1, true),
    (p_space_id, cat_id, 'despesa', 'IPVA', 2, true),
    (p_space_id, cat_id, 'despesa', 'Tarifas bancárias', 3, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'despesa', 'Outras despesas', '#94a3b8', 110, true);

  -- Receitas ---------------------------------------------------------------
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'receita', 'Receita do trabalho', '#16a34a', 10, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'receita', 'Salário', 1, true),
    (p_space_id, cat_id, 'receita', 'Pró-labore', 2, true),
    (p_space_id, cat_id, 'receita', 'Freelance', 3, true),
    (p_space_id, cat_id, 'receita', '13º salário', 4, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'receita', 'Rendimentos de investimentos', '#0d9488', 20, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'receita', 'Juros de renda fixa', 1, true),
    (p_space_id, cat_id, 'receita', 'Dividendos', 2, true),
    (p_space_id, cat_id, 'receita', 'Rendimentos de FIIs', 3, true),
    (p_space_id, cat_id, 'receita', 'Juros sobre capital próprio', 4, true),
    (p_space_id, cat_id, 'receita', 'Cupons', 5, true),
    (p_space_id, cat_id, 'receita', 'Ganho de capital', 6, true),
    (p_space_id, cat_id, 'receita', 'Outros rendimentos', 7, true);

  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'receita', 'Outras receitas', '#65a30d', 30, true) returning id into cat_id;
  insert into categories (space_id, parent_id, kind, name, sort_order, is_system) values
    (p_space_id, cat_id, 'receita', 'Reembolsos', 1, true),
    (p_space_id, cat_id, 'receita', 'Presentes recebidos', 2, true),
    (p_space_id, cat_id, 'receita', 'Outras', 3, true);

  -- Investimentos ------------------------------------------------------------
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'investimento', 'Aplicações financeiras', '#0369a1', 10, true);
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'investimento', 'Resgates de investimentos', '#0284c7', 20, true);

  -- Transferências -----------------------------------------------------------
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'transferencia', 'Entre contas próprias', '#64748b', 10, true);
  insert into categories (space_id, kind, name, color, sort_order, is_system)
    values (p_space_id, 'transferencia', 'Pagamento de cartão', '#64748b', 20, true);
end;
$$;
