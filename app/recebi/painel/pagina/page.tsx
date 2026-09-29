import { Archive, ExternalLink, FilePlus2, Globe, Inbox, Mail, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/recebi/action-button";
import { ActionForm } from "@/components/recebi/action-form";
import { ConfirmAction } from "@/components/recebi/confirm-action";
import { CopyButton } from "@/components/recebi/copy-button";
import { FormField } from "@/components/recebi/fields";
import { PageHeader } from "@/components/recebi/page-header";
import { ServiceDialog } from "@/components/recebi/service-dialog";
import { SlugInput } from "@/components/recebi/slug-input";
import { deleteService, quoteFromRequest, setRequestStatus, updatePublicProfile } from "@/lib/recebi/actions/public-page";
import { requireUser } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { listQuoteRequests, listServices } from "@/lib/recebi/data";
import { formatRelative } from "@/lib/recebi/dates";
import { siteOrigin } from "@/lib/recebi/origin";
import { whatsappNumber } from "@/lib/recebi/phone";
import { servicePriceLabel } from "@/lib/recebi/public-profile";
import { slugify } from "@/lib/recebi/slug";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Minha página" };

export default async function PublicPageSettings() {
  const user = await requireUser();
  const [serviceRows, requests] = await Promise.all([listServices(user.id), listQuoteRequests(user.id)]);
  const origin = await siteOrigin();
  const slug = user.slug ?? slugify(user.businessName || user.name);
  const url = `${origin}${BASE_PATH}/p/${slug}`;
  const open = requests.filter((r) => r.request.status !== "arquivado");
  const archived = requests.filter((r) => r.request.status === "arquivado");
  const fresh = open.filter((r) => r.request.status === "novo").length;

  return (
    <>
      <PageHeader
        title="Minha página"
        description="Uma vitrine com seus serviços e um botão de pedir orçamento. Coloque o link na bio do Instagram e no WhatsApp."
        actions={
          user.publicProfile && user.slug ? (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver minha página
              </a>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-6">
          <section id="pedidos" className="scroll-mt-24 rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 font-bold">
              <Inbox className="size-4" /> Pedidos de orçamento
              {fresh > 0 ? (
                <span className="rounded-full bg-[#c9ff3c] px-2 text-xs font-extrabold text-[#101c34]">{fresh} novos</span>
              ) : null}
            </h2>
            {open.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Quando alguém pedir orçamento pela sua página, o pedido aparece aqui e você recebe um aviso.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3">
                {open.map(({ request, serviceName }) => (
                  <li
                    key={request.id}
                    className={cn("rounded-xl border p-4", request.status === "novo" && "border-[#c9ff3c] bg-[#c9ff3c]/10")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {request.name}
                          {request.status === "respondido" ? (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                              Respondido
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {serviceName ? `${serviceName} · ` : ""}
                          {formatRelative(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-line">{request.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton action={quoteFromRequest} fields={{ id: request.id }} size="sm">
                        <FilePlus2 /> Criar orçamento
                      </ActionButton>
                      {request.phone ? (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`https://wa.me/${whatsappNumber(request.phone)}?text=${encodeURIComponent(
                              `Olá, ${request.name.split(" ")[0]}! Aqui é ${user.businessName || user.name}. Recebi seu pedido de orçamento${serviceName ? ` para ${serviceName}` : ""}.`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle /> WhatsApp
                          </a>
                        </Button>
                      ) : null}
                      {request.email ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`mailto:${request.email}?subject=${encodeURIComponent("Seu pedido de orçamento")}`}>
                            <Mail /> E-mail
                          </a>
                        </Button>
                      ) : null}
                      <ActionButton action={setRequestStatus} fields={{ id: request.id, status: "arquivado" }} variant="ghost" size="sm">
                        <Archive /> Arquivar
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {archived.length > 0 ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Arquivados ({archived.length})</summary>
                <ul className="mt-2 grid gap-1">
                  {archived.map(({ request }) => (
                    <li key={request.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/50">
                      <span className="truncate">
                        {request.name} · <span className="text-muted-foreground">{request.message.slice(0, 60)}</span>
                      </span>
                      <ActionButton action={setRequestStatus} fields={{ id: request.id, status: "novo" }} variant="ghost" size="sm">
                        Restaurar
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Seus serviços</h2>
              <ServiceDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus /> Novo serviço
                  </Button>
                }
              />
            </div>
            {serviceRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Mostre o que você faz e quanto custa. Serviços com preço ajudam o cliente a decidir mais rápido.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {serviceRows.map((service) => (
                  <li key={service.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{servicePriceLabel(service.priceType, service.priceCents)}</p>
                    </div>
                    <ServiceDialog
                      service={service}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar ${service.name}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                    <ConfirmAction
                      action={deleteService}
                      fields={{ id: service.id }}
                      title="Remover este serviço?"
                      description="Ele deixa de aparecer na sua página."
                      confirmLabel="Remover"
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${service.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-2xl bg-[#101c34] p-5 text-white shadow-lg">
            <p className="flex items-center gap-2 text-sm text-white/70">
              <Globe className="size-4" />{" "}
              {user.publicProfile && user.slug ? "Sua página está no ar" : "Sua página ainda não foi publicada"}
            </p>
            <p className="mt-2 font-mono text-sm break-all text-[#c9ff3c]">{url}</p>
            {user.publicProfile && user.slug ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <CopyButton value={url} label="Copiar link" size="sm" className="bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90" />
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`${BASE_PATH}/p/${user.slug}`} target="_blank">
                    <ExternalLink /> Abrir
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-white/60">Preencha os dados abaixo e marque “Publicar minha página”.</p>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h2 className="mb-4 font-bold">Sua apresentação</h2>
            <ActionForm action={updatePublicProfile}>
              <FormField id="slug" label="Endereço da página" hint={`${BASE_PATH}/p/…  (letras, números e hífen)`}>
                <SlugInput id="slug" name="slug" required minLength={3} maxLength={60} defaultValue={slug} autoComplete="off" />
              </FormField>
              <FormField id="headline" label="O que você faz, em uma frase">
                <Input
                  id="headline"
                  name="headline"
                  maxLength={120}
                  defaultValue={user.headline}
                  placeholder="Ex.: Designer de marcas para pequenos negócios"
                />
              </FormField>
              <FormField id="bio" label="Sobre você">
                <Textarea
                  id="bio"
                  name="bio"
                  rows={5}
                  maxLength={1200}
                  defaultValue={user.bio}
                  placeholder="Sua experiência, como você trabalha, clientes que já atendeu…"
                />
              </FormField>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="publicProfile"
                  defaultChecked={user.publicProfile}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="font-medium">Publicar minha página</span>
                  <span className="block text-xs text-muted-foreground">
                    Mostra seu nome, cidade, serviços e WhatsApp. Seus valores recebidos nunca aparecem.
                  </span>
                </span>
              </label>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
