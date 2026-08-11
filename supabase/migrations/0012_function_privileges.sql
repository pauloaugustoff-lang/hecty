-- Funções de uso interno (gatilhos) não devem ser chamáveis diretamente
-- via RPC por usuários autenticados — apenas os gatilhos as executam,
-- o que não depende de privilégio de EXECUTE do papel da sessão.

revoke execute on function seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function handle_new_space() from public, anon, authenticated;
revoke execute on function record_audit_event() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;
revoke execute on function check_category_hierarchy() from public, anon, authenticated;
revoke execute on function check_transaction_category() from public, anon, authenticated;
