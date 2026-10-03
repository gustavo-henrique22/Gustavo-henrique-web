// Regras de senha: tamanho, senhas óbvias e senhas que já vazaram na internet (Have I Been Pwned).
//
// A consulta de vazamentos usa "k-anonimato": só os 5 primeiros caracteres do hash SHA-1 da senha saem do
// servidor; a senha nunca é enviada. Se o serviço estiver fora do ar, a senha é aceita (não trava o cadastro).

const COMMON = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "12345678910",
  "87654321",
  "11111111",
  "00000000",
  "password",
  "password1",
  "password123",
  "senha123",
  "senha1234",
  "senha12345",
  "minhasenha",
  "mudar123",
  "qwerty123",
  "qwertyuiop",
  "asdfghjkl",
  "abc12345",
  "abcd1234",
  "iloveyou",
  "brasil123",
  "flamengo",
  "flamengo123",
  "corinthians",
  "palmeiras",
  "saopaulo",
  "vasco123",
  "gremio123",
  "botafogo",
  "admin123",
  "recebi123",
  "freelancer",
  "teste123",
  "102030405060",
  "q1w2e3r4",
  "1q2w3e4r",
  "a1b2c3d4",
]);

const SEQUENCES = ["0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl"];

/** Motivo para recusar a senha sem consultar a internet, ou null. */
export function weakPasswordReason(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 200) return "A senha é longa demais.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "Essa senha é muito comum. Escolha outra (uma frase fácil de lembrar é ótima).";
  if (new Set(lower).size <= 2) return "Use uma senha com mais variedade de caracteres.";
  if (SEQUENCES.some((sequence) => sequence.includes(lower))) return "Evite sequências como 12345678 ou abcdefgh.";
  const local = (context.email ?? "").toLowerCase().split("@")[0];
  if (local.length >= 4 && lower.includes(local)) return "A senha não pode conter o seu e-mail.";
  const name = (context.name ?? "").toLowerCase().replace(/\s+/g, "");
  if (name.length >= 4 && lower.replace(/\s+/g, "") === name) return "A senha não pode ser o seu nome.";
  return null;
}

/** Lê a resposta da API de faixas do HIBP ("SUFIXO:CONTAGEM" por linha) e devolve quantas vezes vazou. */
export function countInRange(body: string, suffix: string): number {
  const target = suffix.toUpperCase();
  for (const line of body.split(/\r?\n/)) {
    const [hashSuffix, count] = line.trim().split(":");
    if (hashSuffix === target) return Number(count) || 0;
  }
  return 0;
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Quantas vezes a senha aparece em vazamentos conhecidos (0 se não aparece ou se a consulta falhar). */
export async function breachCount(password: string, fetcher: typeof fetch = fetch): Promise<number> {
  try {
    const hash = await sha1Hex(password);
    const response = await fetcher(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Recebi" },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return 0;
    return countInRange(await response.text(), hash.slice(5));
  } catch {
    return 0;
  }
}

/** Confere tudo. Devolve a mensagem de erro para mostrar, ou null se a senha pode ser usada. */
export async function passwordProblem(
  password: string,
  context: { email?: string; name?: string } = {},
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const weak = weakPasswordReason(password, context);
  if (weak) return weak;
  if ((await breachCount(password, fetcher)) > 0) {
    return "Essa senha já apareceu em vazamentos de dados na internet. Escolha outra (uma frase fácil de lembrar é ótima).";
  }
  return null;
}
