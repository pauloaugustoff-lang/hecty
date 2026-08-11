/**
 * Calcula o ciclo de fatura (período de compras) de um cartão a partir
 * do dia de fechamento. Uma compra feita depois do fechamento deste mês
 * entra na fatura que vence no mês seguinte.
 */
export interface StatementPeriod {
  start: Date;
  end: Date;
  dueDate: Date;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function getStatementPeriod(
  closingDay: number,
  dueDay: number,
  referenceDate: Date,
): StatementPeriod {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  const closingThisMonth = clampDay(year, month, closingDay);

  // Se a referência já passou do fechamento deste mês, o período atual
  // vai do fechamento deste mês (exclusive) até o do próximo mês.
  const isAfterClosing = day > closingThisMonth;

  const endMonth = isAfterClosing ? month + 1 : month;
  const startMonth = endMonth - 1;

  const end = new Date(year, endMonth, clampDay(year, endMonth, closingDay));
  const start = new Date(year, startMonth, clampDay(year, startMonth, closingDay) + 1);

  const dueMonth = endMonth + (dueDay < closingDay ? 1 : 0);
  const dueDate = new Date(year, dueMonth, clampDay(year, dueMonth, dueDay));

  return { start, end, dueDate };
}
