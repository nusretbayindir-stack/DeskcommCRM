/**
 * Os avisos de proposta que os crons gravam na Central, no idioma da empresa
 * (S2a Task 5, U14). O cron lê o idioma na hora de gravar
 * (`idiomaDaOrgPeloSupabase`) e monta o texto aqui; em português o texto é o de
 * antes, byte a byte (`tests/unit/avisos-de-proposta-no-idioma`).
 *
 * Os valores entram por substituição com função: um texto de substituição do
 * `replace` com "$" teria sentido especial.
 */
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";

export interface AvisoDaCentral {
  title: string;
  body: string;
}

const preencher = (texto: string, valores: Record<string, string | number>): string =>
  Object.entries(valores).reduce((resto, [nome, valor]) => resto.replace(`{${nome}}`, () => String(valor)), texto);

/** app/api/v1/cron/proposal-acceptance-rate */
export function avisoDeAceiteEmQueda(taxaPct: number, pisoPct: number, idioma: Idioma = IDIOMA_PADRAO): AvisoDaCentral {
  return {
    title: traduzir("A taxa de aceite de propostas caiu", idioma),
    body: preencher(
      traduzir("{taxa}% das propostas decididas nos últimos 30 dias foram aceitas — abaixo do piso de {piso}%.", idioma),
      { taxa: taxaPct, piso: pisoPct },
    ),
  };
}

/** app/api/v1/cron/proposal-expiry */
export function avisoDePropostaVencida(idioma: Idioma = IDIOMA_PADRAO): AvisoDaCentral {
  return {
    title: traduzir("Uma proposta venceu sem decisão do cliente", idioma),
    body: traduzir(
      "O prazo de validade passou e ninguém marcou aceite ou recusa. Reveja a proposta e decida os próximos passos com o cliente.",
      idioma,
    ),
  };
}

/** app/api/v1/cron/proposal-promised-not-created */
export function avisoDePropostaPrometida(idioma: Idioma = IDIOMA_PADRAO): AvisoDaCentral {
  return {
    title: traduzir("Uma proposta prometida não foi criada", idioma),
    body: traduzir("Um compromisso de enviar proposta venceu e nenhuma proposta foi criada para este negócio.", idioma),
  };
}

/** app/api/v1/cron/proposta-travada */
export function avisoDePropostaTravada(n: number, minutos: number, idioma: Idioma = IDIOMA_PADRAO): AvisoDaCentral {
  return {
    title:
      n === 1
        ? traduzir("Uma proposta não confirmou o envio", idioma)
        : preencher(traduzir("{n} propostas não confirmaram o envio", idioma), { n }),
    body: preencher(
      traduzir(
        "Ficaram mais de {minutos} minutos em envio e voltaram a rascunho, com o número mantido. Verifique a conexão do WhatsApp e reenvie manualmente — nada foi reenviado sozinho.",
        idioma,
      ),
      { minutos },
    ),
  };
}
