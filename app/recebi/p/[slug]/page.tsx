import { BadgeCheck, FileSignature, MapPin, MessageCircle, QrCode, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/recebi/logo";
import { QuoteRequestForm } from "@/components/recebi/quote-request-form";
import { hasPro } from "@/lib/recebi/auth";
import { BASE_PATH } from "@/lib/recebi/config";
import { getPublicProfile } from "@/lib/recebi/data";
import { logoUrlFor } from "@/lib/recebi/files";
import { whatsappNumber } from "@/lib/recebi/phone";
import { servicePriceLabel } from "@/lib/recebi/public-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicProfile(slug);
  if (!data) return { title: "Página não encontrada", robots: { index: false } };
  const name = data.owner.businessName || data.owner.name;
  const description = (data.owner.bio || data.owner.headline).slice(0, 160);
  return {
    title: { absolute: `${name} — ${data.owner.headline}` },
    description,
    openGraph: { title: `${name} — ${data.owner.headline}`, description, type: "profile" },
    alternates: { canonical: `${BASE_PATH}/p/${slug}` },
  };
}

const TRUST = [
  { icon: FileSignature, title: "Orçamento online", text: "Você aprova com um clique, com aceite eletrônico." },
  { icon: QrCode, title: "Pagamento por Pix", text: "Cobrança com QR Code e copia e cola." },
  { icon: ReceiptText, title: "Recibo na hora", text: "Comprovante disponível assim que o pagamento cai." },
];

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servico?: string }>;
}) {
  const { slug } = await params;
  const { servico } = await searchParams;
  const data = await getPublicProfile(slug);
  if (!data) notFound();
  const { owner, services } = data;
  const name = owner.businessName || owner.name;
  const firstName = owner.name.split(" ")[0];
  const logoUrl = logoUrlFor(owner);
  const whatsapp = owner.phone
    ? `https://wa.me/${whatsappNumber(owner.phone)}?text=${encodeURIComponent(`Olá, ${firstName}! Vi sua página e gostaria de um orçamento.`)}`
    : null;

  return (
    <div className="min-h-dvh bg-background">
      <header className="relative overflow-hidden bg-[#101c34] text-white">
        <div aria-hidden className="absolute -top-32 -right-24 size-96 rounded-full bg-[#c9ff3c]/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-20 size-80 rounded-full bg-[#3c7bff]/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-16 sm:pt-16 sm:pb-20">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`Logo de ${name}`} className="h-16 w-auto max-w-48 rounded-xl bg-white object-contain p-2" />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-[#c9ff3c] text-3xl font-black text-[#101c34]">
              {name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl">{name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/80 sm:text-xl">{owner.headline}</p>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
            {owner.city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {owner.city}
              </span>
            ) : null}
            {hasPro(owner) ? (
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-[#c9ff3c]" /> Profissional verificado no Recebi
              </span>
            ) : null}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-[#c9ff3c] text-[#101c34] hover:bg-[#c9ff3c]/90">
              <a href="#pedido">Pedir orçamento</a>
            </Button>
            {whatsapp ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-12 px-4 py-12 sm:py-16">
        {owner.bio ? (
          <section aria-labelledby="sobre">
            <h2 id="sobre" className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
              Sobre
            </h2>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed whitespace-pre-line">{owner.bio}</p>
          </section>
        ) : null}

        {services.length > 0 ? (
          <section aria-labelledby="servicos">
            <h2 id="servicos" className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
              Serviços
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="group flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-lg font-bold">{service.name}</p>
                  {service.description ? (
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">{service.description}</p>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="font-extrabold whitespace-nowrap">{servicePriceLabel(service.priceType, service.priceCents)}</p>
                    <Link
                      href={`?servico=${service.id}#pedido`}
                      scroll={false}
                      className="text-sm font-semibold whitespace-nowrap underline-offset-4 group-hover:underline"
                    >
                      Pedir orçamento →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Como funciona" className="grid gap-3 sm:grid-cols-3">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-muted/60 p-4">
              <Icon className="size-5" />
              <p className="mt-2 text-sm font-bold">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section
          id="pedido"
          aria-labelledby="pedido-title"
          className="scroll-mt-6 rounded-3xl border-2 border-[#101c34] bg-card p-6 shadow-[8px_8px_0_#c9ff3c] sm:p-8 dark:border-[#c9ff3c]"
        >
          <h2 id="pedido-title" className="text-2xl font-extrabold">
            Pedir orçamento
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Conte o que você precisa. {firstName} responde com um orçamento detalhado, que você aprova online.
          </p>
          <QuoteRequestForm
            key={servico ?? "none"}
            slug={owner.slug ?? slug}
            services={services.map((s) => ({ id: s.id, name: s.name }))}
            defaultServiceId={services.some((s) => s.id === servico) ? servico : undefined}
            ownerFirstName={firstName}
          />
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <Link href={BASE_PATH} className="inline-flex items-center gap-1.5 hover:text-foreground">
          Página criada com <Logo className="text-xs" markClassName="size-4" /> — crie a sua de graça
        </Link>
      </footer>
    </div>
  );
}
