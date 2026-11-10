import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";

/**
 * OS AVISOS QUE O TURNO DE ATENDIMENTO ABRE NA CENTRAL, NO IDIOMA DA EMPRESA
 * (S2a Task 5, revisão final I1).
 *
 * Moram fora de `inbound-turn.ts` para que o arquivo do upstream mude só nas
 * chamadas. Tabela de literais: a guarda de espanhol cobra es e tr de cada
 * texto; o português é o de sempre. Os valores (motivo técnico, código do veto,
 * instante ISO) entram crus por `preencher`.
 */
const TEXTOS_DO_TURNO = {
  capacidadesTitulo: "O agente atendeu sem as capacidades que você ligou",
  capacidadesCorpo:
    "As ferramentas configuradas na tela do agente não puderam ser carregadas neste atendimento, e ele respondeu ao cliente sem elas. A conversa não foi interrompida. Motivo técnico: {detalhe}",
  promessaTitulo: "Um retorno prometido a um cliente ficou sem dono",
  promessaCorpo:
    "O assistente prometeu algo a esta pessoa nesta conversa e o passo que registra o cumprimento não chegou a ser agendado. Abra a conversa, veja o que foi combinado e cumpra você mesmo.",
  urgenciaTitulo: "Lead com sinal de urgência represado pelo cap de envio do número",
  urgenciaCorpo:
    "Mensagem do lead parece relatar risco/urgência, mas o número está em warm-up/bateu o cap diário ({codigo}) — a resposta automática só sai em {quando}. Considere responder manualmente pelo WhatsApp enquanto o número aquece.",
  riscoPercebidoTitulo: "Lead com risco percebido pelo modelo de decisão represado pelo cap de envio",
  riscoPercebidoCorpo:
    "A regra de urgência de hoje não reconheceu o risco, mas o modelo de decisão percebeu, numa mensagem represada, risco à segurança ou à saúde (origem: percebido pelo modelo de decisão, visível só para a equipe). O número está em warm-up/bateu o cap diário ({codigo}) — a resposta automática só sai em {quando}. Considere responder manualmente pelo WhatsApp enquanto o número aquece.",
} as const;

export interface AvisoDoTurno {
  title: string;
  body: string;
}

/** As ferramentas do agente não carregaram e ele respondeu sem elas. */
export function avisoDeCapacidadesAusentes(detalhe: string, idioma: Idioma): AvisoDoTurno {
  return {
    title: traduzir(TEXTOS_DO_TURNO.capacidadesTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_TURNO.capacidadesCorpo, idioma), { detalhe }),
  };
}

/** O assistente prometeu um retorno e o passo que o cumpre não foi agendado. */
export function avisoDePromessaSemDono(idioma: Idioma): AvisoDoTurno {
  return {
    title: traduzir(TEXTOS_DO_TURNO.promessaTitulo, idioma),
    body: traduzir(TEXTOS_DO_TURNO.promessaCorpo, idioma),
  };
}

/** Urgência (pela regra) numa mensagem represada pelo cap de envio do número. */
export function avisoDeUrgenciaRepresada(
  valores: { codigo: string; quando: string },
  idioma: Idioma,
): AvisoDoTurno {
  return {
    title: traduzir(TEXTOS_DO_TURNO.urgenciaTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_TURNO.urgenciaCorpo, idioma), valores),
  };
}

/** Risco que só o modelo de decisão percebeu, numa mensagem represada pelo cap. */
export function avisoDeRiscoPercebidoRepresado(
  valores: { codigo: string; quando: string },
  idioma: Idioma,
): AvisoDoTurno {
  return {
    title: traduzir(TEXTOS_DO_TURNO.riscoPercebidoTitulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_TURNO.riscoPercebidoCorpo, idioma), valores),
  };
}
