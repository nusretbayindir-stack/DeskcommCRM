/**
 * As palavras com que um funil NOVO nasce, no idioma da empresa.
 *
 * `crm_pipelines.vocabulary` tem default no banco (`baseline.sql`), e ele é
 * português. Desde a migration 9080 (doc 249, resposta B) é o vocabulário
 * NEUTRO: «Contato», «Negócio», «Ganho», «Perdido», «Etapa». Antes era o de
 * loja: «Cliente», «Pedido», «Pago», «Cancelado». Funil criado pela API ou pela
 * tela de Configurações não escrevia a coluna, então uma empresa turca abria o
 * editor do funil e via essas palavras.
 *
 * O português é EXATAMENTE o default do banco: mudar uma palavra aqui muda o
 * que o funil de uma empresa em português passa a dizer. As chaves são as oito
 * do default; quem lê hoje usa as quatro do singular, e o plural fica porque o
 * banco já o grava.
 *
 * `Record<Idioma, …>`: idioma novo promovido no registro obriga a escolher as
 * palavras aqui. Mesma forma de `palavras-de-passagem.ts`.
 *
 * `won` e `lost` nomeiam o DESFECHO do negócio (a etapa de ganho e a de perda).
 * O turco usa as palavras que a tela já usa para os mesmos termos (`tr.json`):
 * «Kişi / Fırsat», «Kazanıldı» e «Kaybedildi».
 */
import type { Idioma } from "@/lib/i18n/idiomas";

export type VocabularioDoFunil = {
  lead: string;
  lead_plural: string;
  deal: string;
  deal_plural: string;
  won: string;
  lost: string;
  stage: string;
  stage_plural: string;
};

const VOCABULARIO_DO_FUNIL_PADRAO: Record<Idioma, VocabularioDoFunil> = {
  "pt-BR": {
    lead: "Contato",
    lead_plural: "Contatos",
    deal: "Negócio",
    deal_plural: "Negócios",
    won: "Ganho",
    lost: "Perdido",
    stage: "Etapa",
    stage_plural: "Etapas",
  },
  es: {
    lead: "Contacto",
    lead_plural: "Contactos",
    deal: "Negocio",
    deal_plural: "Negocios",
    won: "Ganado",
    lost: "Perdido",
    stage: "Etapa",
    stage_plural: "Etapas",
  },
  tr: {
    lead: "Kişi",
    lead_plural: "Kişiler",
    deal: "Fırsat",
    deal_plural: "Fırsatlar",
    won: "Kazanıldı",
    lost: "Kaybedildi",
    stage: "Aşama",
    stage_plural: "Aşamalar",
  },
  // As palavras dos glossários aprovados (doc S2a): negócio = verkoopkans /
  // opportunité, etapa = fase / étape.
  nl: {
    lead: "Contact",
    lead_plural: "Contacten",
    deal: "Verkoopkans",
    deal_plural: "Verkoopkansen",
    won: "Gewonnen",
    lost: "Verloren",
    stage: "Fase",
    stage_plural: "Fasen",
  },
  fr: {
    lead: "Contact",
    lead_plural: "Contacts",
    deal: "Opportunité",
    deal_plural: "Opportunités",
    won: "Gagné",
    lost: "Perdu",
    stage: "Étape",
    stage_plural: "Étapes",
  },
};

/**
 * O default do banco ANTES da migration 9080 — o vocabulário de loja. Funil
 * criado antes dela ainda o tem gravado, e continua sendo "intocado".
 */
const DEFAULT_DO_BANCO_ANTES_DA_9080: VocabularioDoFunil = {
  lead: "Cliente",
  lead_plural: "Clientes",
  deal: "Pedido",
  deal_plural: "Pedidos",
  won: "Pago",
  lost: "Cancelado",
  stage: "Etapa",
  stage_plural: "Etapas",
};

export function vocabularioDoFunilPadrao(idioma: Idioma): VocabularioDoFunil {
  return { ...VOCABULARIO_DO_FUNIL_PADRAO[idioma] };
}

/**
 * O vocabulário gravado ainda é um default do banco (o de hoje ou o de antes da
 * 9080), ou nem existe: ninguém o escolheu, e ele pode ir para o idioma da
 * empresa. Chave ausente conta como intocada; uma palavra trocada, não.
 */
export function vocabularioIntocadoDoBanco(atual: Record<string, unknown> | null | undefined): boolean {
  if (!atual) return true;
  return [VOCABULARIO_DO_FUNIL_PADRAO["pt-BR"], DEFAULT_DO_BANCO_ANTES_DA_9080].some((padrao) =>
    (Object.keys(padrao) as (keyof VocabularioDoFunil)[]).every(
      (k) => atual[k] === undefined || atual[k] === padrao[k],
    ),
  );
}
