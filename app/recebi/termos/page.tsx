import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { BASE_PATH, whatsappLink } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Termos de uso e privacidade" };

// Texto-base. Revise com um advogado antes de cobrar pelo serviço.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link href={BASE_PATH}>
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight sm:text-4xl">Termos de uso e política de privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026</p>

      <div className="mt-10 grid gap-8 text-[0.95rem] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:grid [&_ul]:gap-1 [&_ul]:text-muted-foreground">
        <section>
          <h2>1. O que é o Recebi</h2>
          <p>
            O Recebi é uma ferramenta online para freelancers e pequenos negócios organizarem receitas, despesas, clientes, projetos e
            cobranças. O Recebi não é banco, não movimenta dinheiro e não emite nota fiscal. Os pagamentos via Pix vão direto para a chave
            cadastrada por você.
          </p>
        </section>
        <section>
          <h2>2. Sua conta</h2>
          <ul>
            <li>Você é responsável pelas informações que cadastra e por manter sua senha em segredo.</li>
            <li>
              É proibido usar o Recebi para cobranças falsas, fraudes ou qualquer atividade ilegal. Contas nessa situação podem ser
              encerradas.
            </li>
            <li>Você pode excluir sua conta a qualquer momento em Configurações. A exclusão apaga todos os seus dados.</li>
          </ul>
        </section>
        <section>
          <h2>3. Planos e pagamentos</h2>
          <ul>
            <li>O plano Grátis tem limites de uso descritos na página de preços.</li>
            <li>
              O plano Pro é mensal, pago antecipadamente e sem fidelidade. Sem renovação, a conta volta ao plano Grátis sem perder dados.
            </li>
            <li>Valores e limites podem mudar com aviso prévio de 30 dias.</li>
          </ul>
        </section>
        <section>
          <h2>4. Estimativas</h2>
          <p>
            Valores como imposto estimado, sobra livre e uso do limite anual são aproximações para ajudar no planejamento e não substituem a
            orientação de um contador.
          </p>
        </section>
        <section>
          <h2>5. Privacidade (LGPD)</h2>
          <ul>
            <li>
              Coletamos apenas o necessário para o serviço funcionar: nome, e-mail, dados profissionais que você informa e os lançamentos
              que você registra.
            </li>
            <li>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</li>
            <li>Senhas são guardadas com criptografia (hash) e nunca em texto puro.</li>
            <li>Os dados dos seus clientes que aparecem em uma cobrança ficam visíveis para quem tiver o link dela.</li>
            <li>Você pode exportar seus lançamentos a qualquer momento e pedir a exclusão definitiva excluindo sua conta.</li>
          </ul>
        </section>
        <section>
          <h2>6. Contato</h2>
          <p>
            Dúvidas ou pedidos sobre seus dados:{" "}
            <a
              href={whatsappLink("Olá! Tenho uma dúvida sobre o Recebi.")}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground underline"
            >
              fale com a gente pelo WhatsApp
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
