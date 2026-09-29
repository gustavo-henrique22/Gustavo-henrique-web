/** Número no formato do wa.me: só dígitos e com DDI 55 quando faltar. */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 11 ? `55${digits}` : digits;
}
