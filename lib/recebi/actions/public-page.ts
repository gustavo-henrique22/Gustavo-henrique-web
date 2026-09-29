"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients, quoteRequests, services, users } from "@/db/schema";
import { fail, success, text, type ActionState } from "../action-state";
import { notify, requestIp } from "../activity";
import { hasPro, requireUser } from "../auth";
import { APP_PATH, BASE_PATH, FREE_LIMITS } from "../config";
import { countActiveClients } from "../data";
import { emailEnabled, emailLayout, escapeHtml, sendEmail } from "../email";
import { parseMoney } from "../money";
import { siteOrigin } from "../origin";
import { takeRateLimit } from "../rate-limit";
import { isValidSlug, slugify } from "../slug";

const MAX_SERVICES = 12;
const PRICE_TYPES = ["fixo", "a-partir", "hora", "consulta"] as const;
type PriceType = (typeof PRICE_TYPES)[number];

function refresh(slug?: string | null) {
  revalidatePath(APP_PATH, "layout");
  if (slug) revalidatePath(`${BASE_PATH}/p/${slug}`);
}

export async function updatePublicProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const slug = slugify(text(formData, "slug", 60));
  const headline = text(formData, "headline", 120);
  const bio = text(formData, "bio", 1200);
  const publicProfile = text(formData, "publicProfile") === "on";

  if (!isValidSlug(slug)) return fail("Escolha um endereço com 3 a 40 letras ou números. Ex.: marina-design");
  const db = getDb();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.slug, slug), ne(users.id, user.id)))
    .limit(1);
  if (taken) return fail("Esse endereço já está em uso. Tente outro.");
  if (publicProfile && !headline) return fail("Escreva uma frase curta sobre o que você faz antes de publicar.");

  await db.update(users).set({ slug, headline, bio, publicProfile }).where(eq(users.id, user.id));
  refresh(user.slug);
  refresh(slug);
  return success(publicProfile ? "Página publicada! Já pode divulgar o link." : "Alterações salvas. A página ainda não está publicada.");
}

export async function saveService(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = text(formData, "id", 64);
  const name = text(formData, "name", 80);
  const description = text(formData, "description", 400);
  const priceTypeInput = text(formData, "priceType");
  const priceType: PriceType = (PRICE_TYPES as readonly string[]).includes(priceTypeInput) ? (priceTypeInput as PriceType) : "a-partir";
  const priceInput = text(formData, "price", 30);
  const priceCents = priceType === "consulta" || !priceInput ? 0 : parseMoney(priceInput);

  if (!name) return fail("Dê um nome ao serviço. Ex.: Identidade visual");
  if (priceCents === null || priceCents < 0) return fail("Preço inválido.");
  if (priceType !== "consulta" && priceCents === 0) return fail("Informe o preço ou escolha “Sob consulta”.");

  const db = getDb();
  const values = { name, description, priceCents, priceType };
  if (id) {
    await db
      .update(services)
      .set(values)
      .where(and(eq(services.id, id), eq(services.userId, user.id)));
  } else {
    const [{ total }] = await db.select({ total: count() }).from(services).where(eq(services.userId, user.id));
    if (total >= MAX_SERVICES) return fail(`Você pode mostrar até ${MAX_SERVICES} serviços.`);
    await db.insert(services).values({ id: crypto.randomUUID(), userId: user.id, ...values, position: total });
  }
  refresh(user.slug);
  return success(id ? "Serviço atualizado." : "Serviço adicionado à sua página.");
}

export async function deleteService(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await getDb()
    .delete(services)
    .where(and(eq(services.id, text(formData, "id", 64)), eq(services.userId, user.id)));
  refresh(user.slug);
  return success("Serviço removido.");
}

export async function setRequestStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const status = text(formData, "status");
  if (status !== "novo" && status !== "respondido" && status !== "arquivado") return fail("Situação inválida.");
  await getDb()
    .update(quoteRequests)
    .set({ status })
    .where(and(eq(quoteRequests.id, text(formData, "id", 64)), eq(quoteRequests.userId, user.id)));
  refresh();
  return success(status === "arquivado" ? "Pedido arquivado." : "Pedido atualizado.");
}

/** Abre o editor de orçamento com o cliente do pedido (cadastrando-o, se preciso). */
export async function quoteFromRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const db = getDb();
  const [request] = await db
    .select()
    .from(quoteRequests)
    .where(and(eq(quoteRequests.id, text(formData, "id", 64)), eq(quoteRequests.userId, user.id)))
    .limit(1);
  if (!request) return fail("Pedido não encontrado.");
  let clientId = request.clientId;
  if (!clientId) {
    if (!hasPro(user) && (await countActiveClients(user.id)) >= FREE_LIMITS.clients) {
      return fail(`O plano Grátis permite ${FREE_LIMITS.clients} clientes. Arquive um cliente ou conheça o Pro.`);
    }
    clientId = crypto.randomUUID();
    await db.insert(clients).values({
      id: clientId,
      userId: user.id,
      name: request.name,
      email: request.email,
      phone: request.phone,
      notes: "Veio pela sua página pública.",
    });
    await db.update(quoteRequests).set({ clientId }).where(eq(quoteRequests.id, request.id));
  }
  redirect(`${APP_PATH}/orcamentos/novo?pedido=${request.id}`);
}

/** Formulário "Pedir orçamento" da página pública. Não exige login. */
export async function requestQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  // Campo escondido: só robôs preenchem.
  if (text(formData, "website")) return success("Obrigado! Resposta em breve.");
  const slug = text(formData, "slug", 60);
  const name = text(formData, "name", 120);
  const email = text(formData, "email", 160).toLowerCase();
  const phone = text(formData, "phone", 40);
  const message = text(formData, "message", 2000);
  if (name.length < 2) return fail("Diga seu nome.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Confira o e-mail.");
  if (!email && phone.replace(/\D/g, "").length < 10) return fail("Deixe um e-mail ou WhatsApp para receber a resposta.");
  if (message.length < 10) return fail("Conte um pouco sobre o que você precisa.");

  const db = getDb();
  const [owner] = await db
    .select()
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.publicProfile, true)))
    .limit(1);
  if (!owner) return fail("Esta página não está mais disponível.");

  const ip = (await requestIp()) || "local";
  if (!(await takeRateLimit(`pedido:${ip}`, 5, 3_600_000))) return fail("Muitos pedidos seguidos. Tente de novo em uma hora.");
  if (!(await takeRateLimit(`pedidos:${owner.id}`, 60, 86_400_000))) return fail("Não foi possível enviar agora. Tente mais tarde.");

  const serviceInput = text(formData, "serviceId", 64);
  const [service] = serviceInput
    ? await db
        .select({ id: services.id, name: services.name })
        .from(services)
        .where(and(eq(services.id, serviceInput), eq(services.userId, owner.id)))
        .limit(1)
    : [];

  // Cliente que já existe (mesmo e-mail) fica vinculado ao pedido.
  const [existing] = email
    ? await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.userId, owner.id), sql`lower(${clients.email}) = ${email}`))
        .limit(1)
    : [];

  await db.insert(quoteRequests).values({
    id: crypto.randomUUID(),
    userId: owner.id,
    serviceId: service?.id ?? null,
    clientId: existing?.id ?? null,
    name,
    email,
    phone,
    message,
  });
  await notify(owner.id, {
    type: "pedido",
    title: `Novo pedido de orçamento: ${name}`,
    body: `${service ? `${service.name} · ` : ""}${message.slice(0, 120)}`,
    href: `${APP_PATH}/pagina#pedidos`,
  });

  if (emailEnabled() && !owner.isDemo) {
    const origin = await siteOrigin();
    await sendEmail({
      to: owner.email,
      replyTo: email || undefined,
      subject: `Novo pedido de orçamento de ${name}`,
      html: emailLayout({
        preheader: message.slice(0, 90),
        title: "Chegou um pedido de orçamento 🎉",
        paragraphs: [
          `<strong>${escapeHtml(name)}</strong> pediu um orçamento pela sua página${service ? ` para <strong>${escapeHtml(service.name)}</strong>` : ""}.`,
          `“${escapeHtml(message)}”`,
          [email ? `E-mail: ${escapeHtml(email)}` : "", phone ? `WhatsApp: ${escapeHtml(phone)}` : ""].filter(Boolean).join("<br>"),
          "Responder rápido aumenta muito a chance de fechar. Monte o orçamento no Recebi em poucos minutos.",
        ],
        cta: { label: "Ver pedido e criar orçamento", url: `${origin}${APP_PATH}/pagina#pedidos` },
      }),
    });
  }
  const ownerName = owner.businessName || owner.name;
  return success(`${ownerName} vai responder em breve${email ? " no seu e-mail" : " pelo WhatsApp"}.`);
}
