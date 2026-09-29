// Datas de competência são guardadas como "YYYY-MM-DD" e comparadas como
// texto. "Hoje" é sempre calculado no fuso de São Paulo.
const TIME_ZONE = "America/Sao_Paulo";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidMonth(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Soma meses a "YYYY-MM". */
export function addMonths(month: string, amount: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + amount;
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${year}-${String(mon).padStart(2, "0")}`;
}

/** Soma dias a "YYYY-MM-DD". */
export function addDays(date: string, amount: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + amount));
  return result.toISOString().slice(0, 10);
}

/** Soma meses a uma data, ajustando o dia para o fim do mês quando preciso (31/01 → 28/02). */
export function addMonthsToDate(date: string, amount: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const month = addMonths(`${y}-${String(m).padStart(2, "0")}`, amount);
  const [ny, nm] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${month}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** Dia `day` do mês "YYYY-MM", limitado ao último dia (dia 31 em fevereiro → 28/29). */
export function dateInMonth(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(Math.max(day, 1), lastDay)).padStart(2, "0")}`;
}

/** Primeira data com esse dia do mês a partir de `from` (inclusive). */
export function firstMonthlyDate(from: string, day: number): string {
  const candidate = dateInMonth(from.slice(0, 7), day);
  return candidate >= from ? candidate : dateInMonth(addMonths(from.slice(0, 7), 1), day);
}

/** A mesma data de cobrança no mês seguinte. */
export function nextMonthlyDate(date: string, day: number): string {
  return dateInMonth(addMonths(date.slice(0, 7), 1), day);
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "setembro de 2026" → "Setembro de 2026". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthShortLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** "2026-09-28" → "28/09/2026". */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09-28" → "28 de setembro de 2026". */
export function formatDateLong(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** "2026-09-28" → "28 set". */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Aceita "2026-09-28T14:20:00.000Z" ou o formato do SQLite "2026-09-28 14:20:00" (UTC). */
export function parseTimestamp(value: string): Date {
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  return new Date(iso);
}

/** "28/09/2026 às 14:20" no horário de São Paulo. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseTimestamp(value);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} às ${get("hour")}:${get("minute")}`;
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function formatRelative(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const diff = Math.max(0, now.getTime() - parseTimestamp(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return formatDateTime(value).split(" às ")[0];
}
