/**
 * O que sobrou do texto fixo belga das páginas legais: a escolha de língua.
 *
 * Até a S2a Task 15 este arquivo guardava a política de privacidade em holandês
 * e francês, só para o visitante sem sessão numa instalação da Bélgica, porque o
 * produto não tinha essas línguas. Desde a Task 7 holandês e francês são idiomas
 * do produto, e na Task 15 o texto publicado foi para o catálogo
 * (`lib/i18n/traducoes/{nl,fr}.json`, byte a byte; a cópia congelada do que
 * estava no ar mora em `tests/fixtures/politica-belga/publicada.json` e
 * `tests/unit/politica-belga-mora-no-catalogo.test.ts` a confere). Quem tem
 * sessão e quem não tem leem o mesmo texto.
 *
 * O vocabulário é o do contrato de serviço (Bijlage 2 e 3 / annexes 2 et 3):
 * verwerkingsverantwoordelijke, verwerker, leverancier; responsable du traitement,
 * sous-traitant, prestataire. Tradução revista por IA; não é parecer de advogado.
 */

export type IdiomaBelga = "nl" | "fr";
export type EscolhaDeIdioma = IdiomaBelga | "tr";

/** Os links no topo da página. Cada nome está na própria língua, para quem procura a sua. */
export const IDIOMAS_DA_POLITICA_BELGA: readonly { codigo: EscolhaDeIdioma; nome: string }[] = [
  { codigo: "nl", nome: "Nederlands" },
  { codigo: "fr", nome: "Français" },
  { codigo: "tr", nome: "Türkçe" },
];

/**
 * O perfil do país traz o nome holandês da autoridade; a página em francês usa este.
 * Mora em `autoridade-belga.ts` porque o relatório de acesso em francês também o usa
 * (S2a Task 13).
 */
export { AUTORIDADE_EM_FRANCES } from "@/lib/legal/autoridade-belga";

/** O `?lang=` da página. Valor estranho vale como nenhuma escolha. */
export function lerEscolhaDeIdioma(bruto: string | string[] | undefined): EscolhaDeIdioma | null {
  return bruto === "nl" || bruto === "fr" || bruto === "tr" ? bruto : null;
}
