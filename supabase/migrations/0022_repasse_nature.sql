-- Natureza "repasse": saída de dinheiro que nunca foi seu (ex.: alvará de
-- R$1000 em que R$500 são do sócio — o repasse dos R$500 vincula-se à receita
-- e a abate nos painéis, sobrando como receita só a parte própria). Espelho
-- do mecanismo de reembolso/estorno, reutilizando transaction_reimbursement_links
-- (lado "reimbursement" = o repasse, lado "expense" = a receita abatida).
--
-- IMPORTANTE: rodar este comando SOZINHO (sem outros comandos juntos) —
-- ALTER TYPE ... ADD VALUE não pode ser combinado com uso do novo valor na
-- mesma transação.

alter type transaction_nature add value if not exists 'repasse';
