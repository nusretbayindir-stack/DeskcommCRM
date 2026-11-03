import type { Moeda } from "@/lib/cobranca/vocabulario";

/**
 * O valor de um plano na MOEDA DO PLANO (S4: BRL ou EUR), no idioma de quem lê.
 * Um só formatador para a lista de planos, o painel da empresa e a troca: antes
 * cada tela fixava "BRL" e um plano em euro sairia como reais.
 */
export function formatarDinheiro(cents: number, moeda: Moeda, idioma: string): string {
  return new Intl.NumberFormat(idioma, { style: "currency", currency: moeda }).format(cents / 100);
}
