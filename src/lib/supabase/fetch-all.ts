/**
 * O PostgREST corta silenciosamente qualquer resposta no max_rows configurado
 * (1000 no Supabase). Consultas que agregam transações no JS já passaram desse
 * volume em produção — este helper pagina via .range() até esgotar.
 *
 * A consulta passada em `page` DEVE ter um .order() estável (ex.: .order("id")),
 * senão a paginação pode pular ou duplicar linhas entre páginas.
 */

const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

/** Divide uma lista em blocos — usado para não estourar o limite de tamanho
 * de URL do PostgREST em filtros .in() com centenas de ids. */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
