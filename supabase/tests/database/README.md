# Testes de banco (pgTAP)

Estes testes exercitam as políticas de RLS e os gatilhos diretamente no
Postgres. Eles **exigem um stack Supabase local (Docker)** e não foram
executados no ambiente onde este projeto foi inicialmente desenvolvido
(sem Docker disponível) — foram escritos e revisados cuidadosamente, mas
ainda precisam rodar ao menos uma vez antes de confiar neles em CI.

## Como rodar

```bash
supabase start
supabase test db
```

## Convenção

Cada arquivo é uma transação pgTAP (`begin; select plan(n); ...; select finish(); rollback;`).
Simulamos usuários autenticados definindo `request.jwt.claims` e trocando
para o papel `authenticated`, que é como o PostgREST expõe `auth.uid()`
de verdade em produção:

```sql
select set_config('request.jwt.claims', json_build_object('sub', :'user_id')::text, true);
set local role authenticated;
```

Para voltar a operar com privilégios totais (ex.: para inserir dados de
fixture antes de simular um usuário), use `reset role;`.
