import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { nomeDoOperador, resolverOperador } from "@/lib/legal/operador";
import { PAIS_PADRAO, perfilDoPais } from "@/lib/legal/perfil-do-pais";
import {
  AUTORIDADE_EM_FRANCES,
  IDIOMAS_DA_POLITICA_BELGA,
  lerEscolhaDeIdioma,
} from "@/lib/legal/politica-belga";
import { createClient } from "@/lib/supabase/server";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { traduzir } from "@/lib/i18n/dicionario";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";

interface PropsDaPagina {
  searchParams?: Promise<{ lang?: string | string[] }>;
}

const tituloNoIdiomaDoProduto = tituloDaAba((t) => t("Política de Privacidade"));

export async function generateMetadata({ searchParams }: PropsDaPagina = {}): Promise<Metadata> {
  // A aba acompanha a página: com `?lang=` vale a escolha, com sessão ou sem.
  const escolha = lerEscolhaDeIdioma((await searchParams)?.lang);
  return escolha ? { title: traduzir("Política de Privacidade", escolha) } : tituloNoIdiomaDoProduto();
}

/**
 * O número da empresa vem entre parênteses ("Empresa (CNPJ 00.000…)"). Quando o
 * próprio rótulo já traz parênteses ("Número da empresa (KBO/BCE)"), eles
 * ficariam aninhados — então o número entra depois de uma vírgula.
 */
function complementoDoNumero(rotulo: string, numero: string): string {
  return rotulo.includes("(") ? `, ${rotulo} ${numero}` : ` (${rotulo} ${numero})`;
}

export default async function PrivacyPage({ searchParams }: PropsDaPagina = {}) {
  const op = await resolverOperador();

  // O operador publicou a política dele: é a dele que vale. Sem isto, o campo
  // `privacy_policy_url` da tela de Organização continuaria sendo um controle
  // que o produto oferece e o código ignora. A URL já vem checada — valor cru
  // do banco nunca chega a um redirect.
  if (op.politicaPropria) redirect(op.politicaPropria);

  // Rota fora da árvore de `app/app/layout.tsx` — sem `IdiomaProvider`, então
  // resolve o idioma direto, como `admin/forbidden/page.tsx`. Página legal
  // pública: pode ser lida sem sessão, por isso `user` é opcional.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A língua é a escolhida no link (`?lang=`), senão a do visitante: a mesma
  // regra com sessão e sem, e o mesmo texto, do catálogo (S2a Task 15). O texto
  // belga que só o visitante sem sessão lia mora hoje no catálogo, byte a byte.
  const escolha = lerEscolhaDeIdioma((await searchParams)?.lang);
  const idioma =
    escolha ?? (await idiomaDoVisitante((user?.user_metadata?.locale as string | undefined) ?? null));
  const t = (texto: string) => traduzir(texto, idioma);

  // O vocabulário legal desta política é o do PAÍS da organização ativa
  // (issue #2344): no Brasil "controlador", "CNPJ" e "LGPD"; fora dele
  // "responsável pelo tratamento" (RGPD art. 4.º, n.º 7) e o RGPD, com a etiqueta
  // do número e a autoridade que o perfil do país declara.
  // Sem sessão vale o país da instalação (`resolverOperador`); com a coluna vazia,
  // o Brasil — o mesmo "vazio" de `organizations.country`. Cada ramo é um literal
  // em `t()`: chave de dicionário nas duas direções, nunca frase montada em runtime.
  //
  // Há dois papéis, e o texto os separa: nas conversas com os clientes dela, a
  // empresa responde pelos dados e o prestador de serviço os trata em nome dela;
  // nos dados da conta, quem responde é o prestador. O prestador não é nomeado
  // aqui: o nome dele está no contrato de serviço.
  const perfil = perfilDoPais(op.pais);
  const foraDoBrasil = perfil.codigo !== PAIS_PADRAO;
  const naBelgica = perfil.codigo === "BE";
  const autoridade = naBelgica && idioma === "fr" ? AUTORIDADE_EM_FRANCES : perfil.autoridadeDeSupervisao;
  const linguaDaPagina = idioma;

  return (
    <div lang={linguaDaPagina} className="space-y-6">
      {naBelgica && (
        <nav aria-label="Language" className="flex flex-wrap gap-3 text-xs">
          {IDIOMAS_DA_POLITICA_BELGA.map(({ codigo, nome }) => (
            <a
              key={codigo}
              href={`?lang=${codigo}`}
              lang={codigo}
              aria-current={codigo === linguaDaPagina ? "true" : undefined}
              className={codigo === linguaDaPagina ? "font-semibold" : "underline underline-offset-2"}
            >
              {nome}
            </a>
          ))}
        </nav>
      )}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Política de Privacidade")}</h1>
        <p className="text-muted-foreground">
          {t("Como este serviço trata dados pessoais.")}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          {foraDoBrasil ? t("1. Quem é o responsável pelo tratamento") : t("1. Quem é o controlador")}
        </h2>
        <p>
          {foraDoBrasil
            ? t(
                "Nos dados tratados nas conversas de uma empresa com os clientes dela (contatos, mensagens, arquivos, agendamentos), o responsável pelo tratamento é essa empresa:",
              )
            : t(
                "Nos dados tratados nas conversas de uma empresa com os clientes dela (contatos, mensagens, arquivos, agendamentos), o controlador é essa empresa:",
              )}{" "}
          <strong>{nomeDoOperador(op, t("a empresa que fala com você"))}</strong>
          {op.cnpj ? complementoDoNumero(t(perfil.empresa.rotuloNumero), op.cnpj) : ""}.{" "}
          {foraDoBrasil
            ? t("O prestador de serviço trata esses dados em nome dela, como subcontratante.")
            : t("O prestador de serviço trata esses dados em nome dela, como operador.")}
        </p>
        <p>
          {foraDoBrasil
            ? t(
                "Nos dados da conta da empresa, dos contatos dela e de quem usa o sistema, o responsável pelo tratamento é o prestador de serviço indicado no contrato de serviço assinado com a empresa.",
              )
            : t(
                "Nos dados da conta da empresa, dos contatos dela e de quem usa o sistema, o controlador é o prestador de serviço indicado no contrato de serviço assinado com a empresa.",
              )}
        </p>
        <p>
          {t(
            "Os autores do software de código aberto não operam o serviço e não têm acesso ao servidor nem aos dados.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("2. Que dados são tratados")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>{t("De quem é atendido:")}</strong>{" "}
            {t(
              "nome, telefone, e-mail quando informado, conteúdo das conversas, arquivos enviados (imagens, áudios, documentos) e o histórico de negócios.",
            )}
          </li>
          <li>
            <strong>{t("De quem usa o sistema:")}</strong>{" "}
            {t("nome, e-mail, papel de acesso e registro das ações realizadas.")}
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("3. Para que são usados")}</h2>
        <p>
          {t(
            "Para atender, responder, registrar o andamento do atendimento e organizar a relação comercial — inclusive por agentes de inteligência artificial que atuam sob as regras definidas pela empresa. Registros de ação são mantidos para auditoria e segurança.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("4. Com quem são compartilhados")}</h2>
        <p>
          {t(
            "Os dados ficam nos servidores do serviço. Para funcionar, o prestador de serviço usa os fornecedores abaixo; a lista atualizada está no Anexo 2 do contrato de serviço:",
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("a plataforma de mensagens usada para conversar com o cliente;")}</li>
          <li>
            {t(
              "o provedor de inteligência artificial usado pelo serviço, que recebe o trecho da conversa necessário para gerar a resposta ou avaliar a conversa;",
            )}
          </li>
          <li>
            {t(
              "quando o Jev é ligado (desligado por padrão), a TypeSafe AI, nos Estados Unidos, que recebe cada mensagem do cliente, sozinha e já sem CPF, telefone e e-mail, para avaliar se ele está irritado, se a mensagem tenta manipular o atendimento automático, a qual área da empresa ela se destina, se ela pede para falar com uma pessoa ou para parar de receber mensagens e, quando ela responde a um follow-up, em qual das saídas do fluxo ela se encaixa;",
            )}
          </li>
          <li>
            {t(
              "quando uma chave de Mapas é cadastrada (desligado por padrão), o Google, que recebe as coordenadas da localização que o cliente compartilhou, para devolver a rua e a cidade aproximadas;",
            )}
          </li>
          <li>{t("o provedor de infraestrutura onde o servidor está hospedado.")}</li>
        </ul>
        <p>{t("Os dados não são vendidos nem cedidos para publicidade de terceiros.")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("5. Por quanto tempo")}</h2>
        <p>
          {t(
            "Conversas e registros de negócio são mantidos enquanto houver relação com o cliente ou obrigação legal de guarda. Arquivos de mídia têm prazo próprio, configurado pela empresa. Registros de auditoria são mantidos por período mais longo, por serem prova de quem fez o quê. Ao fim do contrato de serviço, a empresa pode exportar os dados por 30 dias; depois disso, eles são apagados, salvo se a lei exigir guarda mais longa.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("6. Seus direitos")}</h2>
        <p>
          {foraDoBrasil
            ? t(
                "O RGPD garante-lhe confirmar se há tratamento, aceder aos seus dados, corrigir dados incompletos ou desatualizados, pedir anonimização ou eliminação, saber com quem foram partilhados e retirar o consentimento.",
              )
            : t(
                "A LGPD garante a você confirmar se há tratamento, acessar seus dados, corrigir dados incompletos ou desatualizados, pedir anonimização ou eliminação, saber com quem foram compartilhados e revogar consentimento.",
              )}
        </p>
        <p>
          {t(
            "Envie o seu pedido à empresa que trata os seus dados; o prestador de serviço a ajuda a atendê-lo. Para os dados da sua conta, você pode escrever diretamente ao prestador de serviço.",
          )}
        </p>
        {autoridade && (
          <p>
            {t("Você também pode apresentar reclamação à autoridade de proteção de dados: {autoridade} ({site}).")
              .replace("{autoridade}", autoridade.nome)
              .replace("{site}", autoridade.site)}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("7. Segurança")}</h2>
        <p>
          {t(
            "O acesso é controlado por conta, senha e papel. A verificação em duas etapas é opcional para todos e só pode ser exigida de quem administra. Cada organização hospedada só enxerga os próprios dados, e as chaves de integração são guardadas cifradas.",
          )}
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          {foraDoBrasil ? t("8. Encarregado da proteção de dados e contato") : t("8. Encarregado e contato")}
        </h2>
        <p>
          {op.dpoEmail ? (
            <>
              {foraDoBrasil
                ? t(
                    "Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o encarregado da proteção de dados:",
                  )
                : t("Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o encarregado de dados:")}{" "}
              <a className="underline underline-offset-2" href={`mailto:${op.dpoEmail}`}>
                {op.dpoEmail}
              </a>
              .
            </>
          ) : (
            <>
              {foraDoBrasil
                ? t(
                    "A empresa ainda não publicou um endereço de contato do encarregado da proteção de dados. Os pedidos devem ser feitos pelos canais de atendimento dela.",
                  )
                : t(
                    "A empresa ainda não publicou um endereço de contato do encarregado de dados. Os pedidos devem ser feitos pelos canais de atendimento dela.",
                  )}
            </>
          )}
        </p>
        <p>
          {t("Para os dados da sua conta, fale com o prestador de serviço pelo e-mail indicado no contrato de serviço.")}
        </p>
      </section>

      {/* A seção que o Google exige de todo app que pede acesso a dados de conta
          Google: o que é lido, para quê, que não se vende nem treina modelo, o
          selo de Uso Limitado e como desfazer. Cada frase aqui descreve o que o
          código faz (escopos em `lib/agenda/google/oauth.ts` e
          `lib/plataformas-de-anuncio/google/oauth.ts`) — acrescentar acesso novo
          ao Google sem acrescentar a frase correspondente é descumprir a política
          de dados de usuário do Google. */}
      <section className="space-y-2" id="dados-do-google">
        <h2 className="text-base font-semibold">{t("9. Dados do Google (Agenda, Meet e Google Ads)")}</h2>
        <p>
          {t(
            "Quando uma pessoa autorizada da organização conecta uma conta Google a este sistema, os dados recebidos do Google são usados somente para a função que ela pediu:",
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>{t("Google Agenda:")}</strong>{" "}
            {t(
              "mostrar a ocupação da agenda, criar, alterar e cancelar os agendamentos feitos pelo próprio usuário e evitar choque de horários. O sistema guarda no servidor do serviço o título e o horário dos eventos para calcular a ocupação, e o cálculo de horários livres usa apenas o início, o fim e a situação deles. O sistema não lê e-mails.",
            )}
          </li>
          <li>
            <strong>{t("Google Meet:")}</strong>{" "}
            {t(
              "criar espaços de reunião do Google Meet quando a organização liga o Meet com acesso aberto; só o link gerado é devolvido pelo Google e guardado no servidor do serviço para o convite.",
            )}
          </li>
          <li>
            <strong>{t("Google Ads:")}</strong>{" "}
            {t(
              "enviar ao Google Ads as vendas que um anúncio trouxe, para que ele aprenda com elas, criar e listar ações de conversão e ler as métricas das campanhas da própria conta de anúncios.",
            )}
          </li>
        </ul>
        <p>
          {t(
            "Os dados do Google ficam no servidor do serviço, não são vendidos, não são usados para publicidade e não são usados para treinar modelos de inteligência artificial. O uso e a transferência das informações recebidas das APIs do Google seguem a Política de Dados de Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.",
          )}
        </p>
        <p>
          {t(
            "A conexão com a Agenda pode ser desfeita a qualquer momento em Agenda → Desconectar, e a do Google Ads é retirada pelo prestador de serviço, a pedido. Em qualquer caso, a pessoa também pode revogar o acesso diretamente em",
          )}{" "}
          <a
            className="underline underline-offset-2"
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>
    </div>
  );
}
