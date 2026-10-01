export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Muda a cada envio bem-sucedido, para o formulário saber que deve reagir. */
  at?: number;
  /** Códigos de recuperação da verificação em duas etapas, mostrados uma única vez. */
  codes?: string[];
};

export const initialActionState: ActionState = {};

export function fail(error: string): ActionState {
  return { ok: false, error };
}

export function success(message?: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

export function text(formData: FormData, name: string, max = 500): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
