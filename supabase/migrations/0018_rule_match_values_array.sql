-- Permite múltiplas palavras-chave por regra (ex.: "contém Alice OU Matheus"),
-- em vez de exigir uma regra separada por palavra-chave. match_type continua
-- valendo para todos os valores da lista; a regra casa se QUALQUER um bater.

alter table rules add column match_values text[];
update rules set match_values = array[match_value];
alter table rules alter column match_values set not null;
alter table rules add constraint rules_match_values_not_empty check (array_length(match_values, 1) > 0);
alter table rules drop column match_value;
