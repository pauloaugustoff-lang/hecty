/** Ordena por nome em ordem alfabética pt-BR (acentos/maiúsculas tratados corretamente). */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

/** Ordena entradas [chave, rótulo] (ex.: Object.entries de um Record de labels) pelo rótulo, em pt-BR. */
export function sortEntriesByLabel<K extends string>(entries: [K, string][]): [K, string][] {
  return [...entries].sort(([, a], [, b]) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}
