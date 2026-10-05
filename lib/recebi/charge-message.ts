// Mensagens prontas para cobrar pelo WhatsApp, no tom certo para cada momento. Código puro (testável).
import { daysBetween, formatDate } from "./dates";
import { formatMoney } from "./money";
import { whatsappNumber } from "./phone";

export type ChargeMessageInput = {
  clientName: string | null;
  number: number;
  totalCents: number;
  dueDate: string;
  link: string;
  ownerName: string;
  today: string;
};

export function chargeMessage({ clientName, number, totalCents, dueDate, link, ownerName, today }: ChargeMessageInput): string {
  const first = clientName?.trim().split(/\s+/)[0] ?? "";
  const hello = `Olá${first ? `, ${first}` : ""}!`;
  const ref = `a cobrança #${String(number).padStart(4, "0")} de ${formatMoney(totalCents)}`;
  const late = daysBetween(dueDate, today);
  let body: string;
  if (late > 0) {
    body =
      `${hello} Tudo bem? Passando para lembrar que ${ref} venceu em ${formatDate(dueDate)}` +
      ` (${late} ${late === 1 ? "dia" : "dias"} atrás). Se já pagou, pode desconsiderar e me avisar. 🙏`;
  } else if (late === 0) {
    body = `${hello} Lembrete rápido: ${ref} vence hoje.`;
  } else {
    body = `${hello} Segue ${ref}, com vencimento em ${formatDate(dueDate)}.`;
  }
  return `${body}\n\nPague por Pix pelo link: ${link}\n\nObrigado! ${ownerName}`;
}

/** Link do WhatsApp com a mensagem. Sem telefone, abre o WhatsApp para escolher o contato. */
export function whatsappLink(phone: string | null | undefined, message: string): string {
  const to = phone ? whatsappNumber(phone) : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}
