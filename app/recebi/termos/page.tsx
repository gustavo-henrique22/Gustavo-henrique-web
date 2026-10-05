import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/recebi/logo";
import { BASE_PATH, whatsappLink } from "@/lib/recebi/config";

export const metadata: Metadata = { title: "Termos de uso" };

// Texto-base. Revise com um advogado antes de cobrar pelo serviço.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link href={BASE_PATH}>
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-extrabold tracking-tight sm:text-4xl">Termos de uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: outubro de 2026</p>

      <div className="mt-10 grid gap-8 text-[0.95rem] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_ul]:grid [&_ul]:gap-1 [&_ul]:text-muted-foreground">
        <section>
          <h2>1. O que é o Recebi</h2>
          <p>
            O Recebi é uma ferramenta online para freelancers e pequenos negócios organizarem receitas, despesas, clientes, projetos e
            cobranças. O Recebi não é banco e não movimenta dinheiro: os pagamentos via Pix vão direto para a chave cadastrada por você. A
            emissão de nota fiscal, quando ativada, é feita pela sua conta na Focus NFe, e você continua responsável pelas informações
            fiscais.
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
            <li>Ative a verificação em duas etapas para proteger melhor sua conta.</li>
          </ul>
        </section>
        <section>
          <h2>3. Planos e pagamentos</h2>
          <ul>
            <li>O plano Grátis tem limites de uso descritos na página de preços.</li>
            <li>
              O plano Pro é mensal ou anual, pago antecipadamente e sem fidelidade. Sem renovação, a conta volta ao plano Grátis sem perder
              dados.
            </li>
            <li>
              O pagamento é feito em uma plataforma parceira (como Kiwify ou Shopify), que segue as próprias regras de cobrança e reembolso.
              Use o mesmo e-mail da sua conta para o Pro ser liberado automaticamente.
            </li>
            <li>
              Você pode desistir da compra em até 7 dias e receber o valor de volta (direito de arrependimento, art. 49 do Código de Defesa
              do Consumidor). Peça pela plataforma onde pagou ou fale com a gente.
            </li>
            <li>
              Contas novas ganham um teste grátis do Pro por tempo limitado, sem cobrança automática: ao final, a conta volta ao plano
              Grátis se você não assinar.
            </li>
            <li>Cupons têm as regras e a validade informadas na oferta, são pessoais e podem ser usados uma vez por conta.</li>
            <li>Meses de Pro ganhos no “Indique e ganhe” não têm valor em dinheiro e podem ser cancelados em caso de fraude.</li>
            <li>Valores e limites podem mudar com aviso prévio de 30 dias.</li>
          </ul>
        </section>
        <section>
          <h2>4. Estimativas e assistente com IA</h2>
          <ul>
            <li>
              Valores como imposto estimado, sobra livre e uso do limite anual são aproximações para ajudar no planejamento e não substituem
              a orientação de um contador.
            </li>
            <li>
              As respostas do assistente com IA, as sugestões de orçamento e os campos preenchidos pela foto do comprovante podem conter
              erros. Confira antes de usar; elas não são consultoria financeira, contábil ou jurídica.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Orçamentos, cobranças e páginas públicas</h2>
          <ul>
            <li>
              O que você oferece e cobra dos seus clientes é combinado entre você e eles. O Recebi não faz parte desse acordo e não garante
              que o cliente vai pagar.
            </li>
            <li>
              No aceite de um orçamento, o Recebi registra o nome digitado, a data, a hora e o IP como comprovante, que fica disponível para
              você.
            </li>
            <li>
              Contratos anexados aos orçamentos são escritos por você. O Recebi apenas guarda o texto e o registro do aceite eletrônico; não
              revisa o conteúdo nem presta assessoria jurídica. Para contratos de valor alto, consulte um advogado.
            </li>
            <li>
              O link do portal do cliente dá acesso às cobranças e orçamentos daquele cliente. Envie só para ele; se o link vazar, troque-o
              na página do cliente.
            </li>
            <li>Confira no seu banco se o Pix caiu antes de marcar uma cobrança como paga.</li>
            <li>Você é responsável pelo conteúdo da sua página pública (serviços, preços, textos e logo).</li>
            <li>
              Ao convidar pessoas para a sua equipe, você autoriza que elas vejam (e, como Editor, alterem) os dados da sua conta e responde
              pelo que fizerem nela. Você pode remover o acesso a qualquer momento.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Disponibilidade</h2>
          <p>
            Trabalhamos para o Recebi ficar no ar o tempo todo, com cópias de segurança automáticas, mas podem acontecer interrupções para
            manutenção ou por falhas de fornecedores. Recomendamos baixar seus dados de vez em quando, em Configurações → Privacidade.
          </p>
        </section>
        <section>
          <h2>7. Privacidade (LGPD)</h2>
          <p>
            Como coletamos, usamos, protegemos e apagamos seus dados está explicado na{" "}
            <Link href={`${BASE_PATH}/privacidade`} className="font-semibold text-foreground underline">
              Política de privacidade
            </Link>
            . Os dados dos seus clientes que aparecem em uma cobrança ou orçamento ficam visíveis para quem tiver o link; você pode
            desativar ou trocar o link a qualquer momento.
          </p>
        </section>
        <section>
          <h2>8. Mudanças nestes termos</h2>
          <p>
            Se mudarmos algo importante, avisamos por e-mail ou no painel com pelo menos 30 dias de antecedência. Continuar usando o Recebi
            depois disso significa concordar com a nova versão; se não concordar, você pode excluir sua conta.
          </p>
        </section>

        <section>
          <h2>9. Lei aplicável</h2>
          <p>
            Estes termos seguem as leis brasileiras, incluindo o Código de Defesa do Consumidor e a LGPD. Eventuais disputas podem ser
            levadas ao foro do seu domicílio.
          </p>
        </section>

        <section>
          <h2>10. Contato</h2>
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
