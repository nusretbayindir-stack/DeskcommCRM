/**
 * As palavras com que um funil NOVO nasce, no idioma da empresa.
 *
 * `crm_pipelines.vocabulary` tem default no banco (`baseline.sql`), e ele é
 * português: «Cliente», «Pedido», «Pago», «Cancelado», «Etapa». Funil criado
 * pela API ou pela tela de Configurações não escrevia a coluna, então uma
 * empresa turca abria o editor do funil e via essas palavras (e, com o campo
 * vazio, «Lead», «Deal», «Ganho» e «Perdido» em duro).
 *
 * O português é EXATAMENTE o default do banco: mudar uma palavra aqui muda o
 * que o funil de uma empresa em português passa a dizer. As chaves são as oito
 * do default; quem lê hoje usa as quatro do singular, e o plural fica porque o
 * banco já o grava.
 *
 * `Record<Idioma, …>`: idioma novo promovido no registro obriga a escolher as
 * palavras aqui. Mesma forma de `palavras-de-passagem.ts`.
 *
 * `won` e `lost` nomeiam o DESFECHO do negócio (a etapa de ganho e a de perda),
 * não um verbo: «Pago» e «Cancelado» seguem o par «Cliente / Pedido». O turco
 * mantém o mesmo par: «Müşteri / Sipariş», «Ödendi» e «İptal edildi».
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
    lead: "Cliente",
    lead_plural: "Clientes",
    deal: "Pedido",
    deal_plural: "Pedidos",
    won: "Pago",
    lost: "Cancelado",
    stage: "Etapa",
    stage_plural: "Etapas",
  },
  es: {
    lead: "Cliente",
    lead_plural: "Clientes",
    deal: "Pedido",
    deal_plural: "Pedidos",
    won: "Pagado",
    lost: "Cancelado",
    stage: "Etapa",
    stage_plural: "Etapas",
  },
  tr: {
    lead: "Müşteri",
    lead_plural: "Müşteriler",
    deal: "Sipariş",
    deal_plural: "Siparişler",
    won: "Ödendi",
    lost: "İptal edildi",
    stage: "Aşama",
    stage_plural: "Aşamalar",
  },
};

export function vocabularioDoFunilPadrao(idioma: Idioma): VocabularioDoFunil {
  return { ...VOCABULARIO_DO_FUNIL_PADRAO[idioma] };
}
