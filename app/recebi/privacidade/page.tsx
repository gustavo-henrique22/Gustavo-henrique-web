import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { APP_PATH, BASE_PATH, whatsappLink } from "@/lib/recebi/config";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Recebi coleta, usa, protege e apaga os seus dados, de acordo com a LGPD.",
};

const PROCESSORS: [string, string][] = [
  ["Cloudflare", "Hospedagem do site, banco de dados e arquivos (comprovantes e logos)."],
  ["Resend", "Envio dos e-mails do Recebi (boas-vindas, cobranças, lembretes, recibos e avisos de segurança)."],
  ["Kiwify, Shopify ou Mercado Pago", "Pagamento do plano Pro. Os dados do cartão ficam só com a plataforma de pagamento."],
  ["Google", "Login com Google, apenas se você escolher entrar assim."],
  [
    "Anthropic (Claude)",
    "Assistente com IA: quando você faz uma pergunta, enviamos o texto dela e um resumo numérico das suas finanças. Esses dados não são usados para treinar a IA.",
  ],
  ["Focus NFe", "Emissão de nota fiscal de serviço, apenas se você ativar e conectar a sua conta."],
  [
    "Have I Been Pwned",
    "Quando você cria ou troca a senha, conferimos se ela já vazou na internet. Só os 5 primeiros caracteres de um código (hash) da senha são enviados; a senha nunca sai do Recebi.",
  ],
];

const COOKIES: [string, string][] = [
  ["recebi_session", "Mantém você conectado. Essencial."],
  ["recebi_device", "Reconhece o aparelho para avisar sobre logins em aparelhos novos. Essencial (segurança)."],
  ["recebi_2fa", "Guarda por alguns minutos o login que aguarda o código da verificação em duas etapas. Essencial."],
  ["recebi_pk", "Guarda por alguns minutos o desafio de segurança de uma chave de acesso (digital ou rosto). Essencial."],
  ["recebi_google_state", "Protege o login com Google contra fraudes. Essencial, dura minutos."],
  ["recebi_ref", "Lembra o código de indicação de quem convidou você, por 30 dias."],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link href={BASE_PATH}>
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight sm:text-4xl">Política de privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização: outubro de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)
      </p>

      <div className="mt-10 grid gap-8 text-[0.95rem] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:grid [&_ul]:gap-1 [&_ul]:text-muted-foreground">
        <section>
          <h2>1. Resumo</h2>
          <ul>
            <li>Usamos seus dados só para o Recebi funcionar. Não vendemos dados e não mostramos anúncios.</li>
            <li>
              Senhas, CPF/CNPJ, chave Pix, telefones, observações e mensagens de clientes ficam protegidos com criptografia no banco de
              dados.
            </li>
            <li>
              Você pode baixar todos os seus dados ou excluir sua conta quando quiser, em{" "}
              <Link href={`${APP_PATH}/configuracoes/privacidade`} className="font-semibold text-foreground underline">
                Configurações → Privacidade
              </Link>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2>2. Quem cuida dos seus dados</h2>
          <p>
            O Recebi é operado por Gustavo Henrique, que é o controlador dos dados da sua conta. Quando você cadastra seus próprios
            clientes, você é o controlador dos dados deles e o Recebi atua como operador, tratando esses dados só para prestar o serviço a
            você.
          </p>
        </section>

        <section>
          <h2>3. Quais dados coletamos</h2>
          <ul>
            <li>
              <strong className="text-foreground">Conta:</strong> nome, e-mail, senha (guardada como hash, nunca em texto) e, se você
              informar, nome do negócio, CPF/CNPJ, telefone, cidade, chave Pix e logo.
            </li>
            <li>
              <strong className="text-foreground">O que você registra:</strong> lançamentos, clientes, projetos, orçamentos, cobranças,
              horas, serviços e comprovantes anexados.
            </li>
            <li>
              <strong className="text-foreground">Segurança:</strong> data, endereço de rede (IP) e navegador dos logins e de ações
              sensíveis, para proteger sua conta.
            </li>
            <li>
              <strong className="text-foreground">Seus clientes:</strong> quando um cliente abre um link, registramos que ele abriu. No
              aceite de um orçamento, guardamos o nome digitado, a data, a hora e o IP como comprovante. Quem pede orçamento pela sua página
              pública informa nome, e-mail, WhatsApp e uma mensagem.
            </li>
            <li>
              <strong className="text-foreground">Pagamento do Pro:</strong> recebemos da plataforma de pagamento o e-mail, o valor e a
              situação do pagamento. Não recebemos dados de cartão.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Para que usamos e com qual base legal</h2>
          <ul>
            <li>Prestar o serviço que você contratou: execução de contrato (art. 7º, V).</li>
            <li>Proteger sua conta, prevenir fraudes e guardar o comprovante de aceite: legítimo interesse (art. 7º, IX).</li>
            <li>Guardar registros de pagamento pelo prazo da lei: cumprimento de obrigação legal (art. 7º, II).</li>
            <li>E-mails de resumo do mês e novidades: só com a sua opção ligada, e você pode desligar quando quiser.</li>
          </ul>
        </section>

        <section>
          <h2>5. Com quem compartilhamos</h2>
          <p className="mb-3">Só com os parceiros necessários para o Recebi funcionar, e só o mínimo de dados:</p>
          <ul>
            {PROCESSORS.map(([name, use]) => (
              <li key={name}>
                <strong className="text-foreground">{name}:</strong> {use}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Alguns desses parceiros guardam dados fora do Brasil, com garantias de proteção compatíveis com a LGPD (art. 33). Também podemos
            compartilhar dados se uma autoridade exigir por lei.
          </p>
        </section>

        <section>
          <h2>6. Cookies</h2>
          <p className="mb-3">Usamos apenas cookies necessários. Não usamos cookies de anúncio nem de rastreamento.</p>
          <ul>
            {COOKIES.map(([name, use]) => (
              <li key={name}>
                <code className="text-foreground">{name}</code>: {use}
              </li>
            ))}
          </ul>
          <p className="mt-3">O tema claro ou escuro fica salvo só no seu navegador.</p>
        </section>

        <section>
          <h2>7. Por quanto tempo guardamos</h2>
          <ul>
            <li>Enquanto sua conta existir. Ao excluir a conta, apagamos seus dados e arquivos na hora.</li>
            <li>
              As cópias de segurança do banco de dados são criptografadas e guardadas por 7 dias; as cópias automáticas da hospedagem se
              renovam em até 30 dias.
            </li>
            <li>O registro de atividades de segurança é guardado por até 1 ano.</li>
            <li>
              Os avisos de pagamento do plano Pro enviados pela Kiwify ou pela Shopify (e-mail, valor e situação) ficam guardados por até 5
              anos, por obrigação fiscal, mesmo depois de excluir a conta. As plataformas de pagamento guardam os próprios comprovantes.
            </li>
            <li>Contas de demonstração são apagadas automaticamente em 24 horas.</li>
          </ul>
        </section>

        <section>
          <h2>8. Como protegemos</h2>
          <ul>
            <li>Conexão sempre criptografada (HTTPS).</li>
            <li>
              Senhas com hash PBKDF2 e dados sensíveis (CPF/CNPJ, chave Pix, telefones, observações, mensagens, token da nota fiscal e
              segredo da verificação em duas etapas) com criptografia AES-256 no banco de dados.
            </li>
            <li>Senhas que já vazaram na internet não são aceitas.</li>
            <li>Verificação em duas etapas opcional, aviso de login em aparelho novo e lista de aparelhos conectados.</li>
            <li>Bloqueio após tentativas erradas de senha e limites contra robôs.</li>
            <li>Cada conta só acessa os próprios dados.</li>
            <li>
              Se acontecer um incidente de segurança que possa trazer risco a você, avisamos você e a ANPD, como manda a LGPD (art. 48).
            </li>
          </ul>
        </section>

        <section>
          <h2>9. Seus direitos</h2>
          <p className="mb-3">Pela LGPD (art. 18), você pode, a qualquer momento:</p>
          <ul>
            <li>Confirmar que tratamos seus dados e acessar todos eles: botão “Baixar meus dados”.</li>
            <li>Corrigir dados: direto no painel, em Configurações.</li>
            <li>Levar seus dados para outro serviço (portabilidade): o arquivo baixado é em formato aberto (JSON).</li>
            <li>Excluir seus dados: botão “Excluir minha conta”.</li>
            <li>Revogar consentimentos, como o resumo do mês por e-mail.</li>
            <li>Pedir informações sobre com quem compartilhamos seus dados (lista acima).</li>
          </ul>
          <p className="mt-3">
            O Recebi não toma decisões automáticas que afetem você: o assistente com IA só responde às suas perguntas e sugere textos.
          </p>
        </section>

        <section>
          <h2>10. Menores de idade</h2>
          <p>O Recebi é feito para profissionais e não deve ser usado por menores de 18 anos.</p>
        </section>

        <section>
          <h2>11. Mudanças nesta política</h2>
          <p>Se mudarmos algo importante, avisamos por e-mail ou no painel antes de a mudança valer.</p>
        </section>

        <section>
          <h2>12. Fale com a gente</h2>
          <p>
            O encarregado pelo tratamento de dados (art. 41 da LGPD) é Gustavo Henrique. Pedidos sobre seus dados ou dúvidas sobre
            privacidade:{" "}
            <a
              href={whatsappLink("Olá! Tenho um pedido sobre meus dados no Recebi (LGPD).")}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-foreground underline"
            >
              fale com a gente pelo WhatsApp
            </a>
            . Respondemos em até 15 dias. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
          <p className="mt-3">
            Veja também os{" "}
            <Link href={`${BASE_PATH}/termos`} className="font-semibold text-foreground underline">
              Termos de uso
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
