// Configurações gerais do Recebi. Altere aqui nome, preços e contato.
export const APP_NAME = "Recebi";
export const BASE_PATH = "/recebi";
export const APP_PATH = `${BASE_PATH}/painel`;

/** WhatsApp (com DDI e DDD) usado para vender o plano Pro e dar suporte. */
export const SUPPORT_WHATSAPP = "5511989735670";

export const PRO_PRICE_CENTS = 1990;
/** Plano anual: 12 meses pelo preço de 10. */
export const PRO_YEARLY_PRICE_CENTS = 19900;

export const FREE_LIMITS = {
  /** Clientes ativos (não arquivados). */
  clients: 5,
  /** Cobranças criadas por mês. */
  invoicesPerMonth: 5,
  /** Orçamentos criados por mês. */
  quotesPerMonth: 5,
} as const;

export const SESSION_COOKIE = "recebi_session";
export const SESSION_DAYS = 30;

export function whatsappLink(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
