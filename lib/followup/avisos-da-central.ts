import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";

/**
 * OS AVISOS QUE O ACOMPANHAMENTO ABRE NA CENTRAL, NO IDIOMA DA EMPRESA
 * (S2a Task 5, U14).
 *
 * A Central mostra `title`/`body` como foram gravados, então quem grava
 * escolhe o idioma. Os textos moram aqui, numa tabela de literais, para que a
 * guarda `i18n-espanhol-cobre-a-tela` cobre espanhol e turco de cada um; o
 * português é o texto de sempre, byte a byte.
 *
 * Os valores de fora (nome do fluxo, id, motivo do erro) entram crus por
 * `preencher`: o motivo é texto técnico do motor, e nunca foi traduzido.
 */
const TEXTOS_DO_AVISO = {
  fluxoParadoTitulo: "Um fluxo de follow-up parou de tentar",
  fluxoParadoCorpo: 'O fluxo "{nome}" (enrollment {id}) foi marcado como "dead": {motivo}',
  retornoTitulo: "Um retorno programado não pôde ser enviado",
  retornoSemVagaCorpo:
    'O fluxo "{nome}" esperou 7 dias o outro acompanhamento deste contato terminar, e o envio foi cancelado (enrollment {id}). Fale com o contato por outro caminho se ainda fizer sentido.',
  retornoCanceladoCorpo:
    'O fluxo "{nome}" esperava a data do retorno, mas {causa} no meio da espera, e o envio foi cancelado (enrollment {id}). Fale com o contato por outro caminho se ainda fizer sentido.',
  causaFronteira: "o atendimento que o originou foi encerrado ou substituído",
  causaAgenda: "a agenda do acompanhamento deixou de valer",
  recuperacaoTitulo: "Cliente faltou e não respondeu à recuperação",
  recuperacaoCorpo:
    "As mensagens de reengajamento pós-falta foram enviadas e o cliente não respondeu. Decida o próximo passo e mova o card no funil.",
} as const;

export interface AvisoDoAcompanhamento {
  title: string;
  body: string;
}

/** Qual guarda recusou o retorno no meio da espera (ver `processEnrollment`). */
export type CausaDoRetornoCancelado = "fronteira" | "agenda";

/** O fluxo que parou de tentar (`markDead`). */
export function avisoDeFluxoParado(
  valores: { nome: string; id: string; motivo: string },
  idioma: Idioma,
): AvisoDoAcompanhamento {
  return {
    title: traduzir(TEXTOS_DO_AVISO.fluxoParadoTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_AVISO.fluxoParadoCorpo, idioma), valores),
  };
}

/** O retorno que esperou 7 dias a vaga do contato e desistiu. */
export function avisoDeRetornoSemVaga(
  valores: { nome: string; id: string },
  idioma: Idioma,
): AvisoDoAcompanhamento {
  return {
    title: traduzir(TEXTOS_DO_AVISO.retornoTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_AVISO.retornoSemVagaCorpo, idioma), valores),
  };
}

/**
 * O retorno cancelado porque o atendimento ou a agenda venceu no meio da
 * espera. A frase da causa é escolhida pela MESMA guarda que escolhe o motivo
 * gravado (`MOTIVO_DA_*` em `engine.ts`): as duas causas não podem contar a
 * mesma história (#2709).
 */
export function avisoDeRetornoCancelado(
  valores: { nome: string; id: string; causa: CausaDoRetornoCancelado },
  idioma: Idioma,
): AvisoDoAcompanhamento {
  const causa =
    valores.causa === "agenda"
      ? traduzir(TEXTOS_DO_AVISO.causaAgenda, idioma)
      : traduzir(TEXTOS_DO_AVISO.causaFronteira, idioma);
  return {
    title: traduzir(TEXTOS_DO_AVISO.retornoTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_AVISO.retornoCanceladoCorpo, idioma), {
      nome: valores.nome,
      id: valores.id,
      causa,
    }),
  };
}

/** O cliente que faltou e não respondeu à recuperação (as portas Supabase e pg). */
export function textoDaRecuperacaoEsgotada(idioma: Idioma): AvisoDoAcompanhamento {
  return {
    title: traduzir(TEXTOS_DO_AVISO.recuperacaoTitulo, idioma),
    body: traduzir(TEXTOS_DO_AVISO.recuperacaoCorpo, idioma),
  };
}
