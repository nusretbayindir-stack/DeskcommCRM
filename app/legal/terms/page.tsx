
import { resolverOperador } from "@/lib/legal/operador";
import { createClient } from "@/lib/supabase/server";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { traduzir } from "@/lib/i18n/dicionario";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";

export const generateMetadata = tituloDaAba((t) => t("Termos de Uso"));

export default async function TermsPage() {
  const op = await resolverOperador();

  // Rota fora da árvore de `app/app/layout.tsx` — sem `IdiomaProvider`, então
  // resolve o idioma direto, como `admin/forbidden/page.tsx`. Página legal
  // pública: pode ser lida sem sessão, por isso `user` é opcional.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = await idiomaDoVisitante(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  const t = (texto: string) => traduzir(texto, idioma);

  // Quem opera o serviço é o prestador do contrato assinado, e não a empresa que
  // usa o sistema. O texto não nomeia o prestador: a marca é da instalação, e o
  // nome, o número e o e-mail dele estão no contrato. A numeração das cláusulas
  // citadas é a do contrato de serviço; mudou lá, muda aqui.
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Termos de Uso")}</h1>
        <p className="text-muted-foreground">{t("As regras de uso deste serviço.")}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("1. Quem é quem")}</h2>
        <p>
          {t(
            "{sistema} é oferecido e operado, pela internet, pelo prestador de serviço indicado no contrato de serviço assinado pela sua empresa. Você usa o serviço em nome da sua empresa, e os administradores dela gerenciam as contas de usuário.",
          ).replace("{sistema}", op.sistema)}
        </p>
        <p>
          {t(
            "Este texto trata das regras de uso do dia a dia e não altera o contrato assinado entre a sua empresa e o prestador de serviço. Em caso de conflito, vale o contrato.",
          )}
        </p>
        <p>
          {t(
            "O serviço se baseia em software de código aberto. Os autores desse software não operam este serviço e não têm acesso ao servidor nem aos dados.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("2. O que o sistema faz")}</h2>
        <p>
          {t(
            "{sistema} organiza atendimento e vendas: recebe e envia mensagens pelos canais que a sua empresa conectar, registra contatos e negócios, e permite que agentes de inteligência artificial atendam junto com pessoas, sob as regras que a sua empresa definir.",
          ).replace("{sistema}", op.sistema)}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("3. Sua conta")}</h2>
        <p>
          {t(
            "O acesso é pessoal. Você é responsável por manter sua senha em segredo e pelo que for feito com a sua conta. A verificação em duas etapas é opcional e pode ser exigida por quem administra a empresa. Se suspeitar de acesso indevido, avise imediatamente o administrador da sua empresa e o prestador de serviço.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("4. Uso aceitável")}</h2>
        <p>{t("Ao usar este sistema, você concorda em não:")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("enviar mensagens não solicitadas em massa, nem burlar pedidos de descadastro;")}</li>
          <li>{t("usar os dados de clientes para finalidade diferente da que os originou;")}</li>
          <li>{t("tentar acessar dados de outra organização hospedada nesta instalação;")}</li>
          <li>
            {t("violar os termos dos serviços conectados, como as regras da plataforma de mensagens.")}
          </li>
        </ul>
        <p>
          {t(
            "O uso da própria conexão por QR, cujos riscos estão descritos no contrato de serviço, não se enquadra na última regra acima.",
          )}
        </p>
        <p>
          {t(
            "O sistema respeita pedidos de parada enviados pelos clientes: quem pedir para não receber mais mensagens é bloqueado automaticamente para envios.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("5. Conteúdo e dados")}</h2>
        <p>
          {t(
            "Os dados inseridos aqui — contatos, conversas, negócios, arquivos — pertencem à sua empresa e às pessoas a que se referem. O tratamento desses dados é descrito na",
          )}{" "}
          <a className="underline underline-offset-2" href="/legal/privacy">
            {t("Política de Privacidade")}
          </a>
          .
        </p>
        <p>
          {t(
            "Respostas geradas por inteligência artificial podem conter erros. Elas não substituem conferência humana em decisões que envolvam preço, prazo, saúde, crédito ou obrigação legal.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("6. Disponibilidade e responsabilidade")}</h2>
        <p>
          {t(
            "A disponibilidade, a manutenção e os limites de responsabilidade do serviço estão nas cláusulas 11 e 12 do contrato de serviço.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("7. Encerramento")}</h2>
        <p>
          {t(
            "O administrador da sua empresa pode suspender o seu acesso; o prestador de serviço pode suspender o serviço nos casos previstos no contrato. Você pode pedir o encerramento da sua conta ao administrador da sua empresa. O que acontece com os dados ao fim do contrato está na cláusula 16.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("8. Mudanças")}</h2>
        <p>
          {t(
            "O prestador de serviço pode atualizar este texto e avisa as mudanças relevantes antes de entrarem em vigor. Mudanças no contrato seguem a cláusula 17.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("9. Contato")}</h2>
        <p>
          {t(
            "Fale com o prestador de serviço pelo e-mail indicado no contrato de serviço. Para assuntos da sua conta de usuário, procure primeiro o administrador da sua empresa.",
          )}
        </p>
      </section>
    </>
  );
}
