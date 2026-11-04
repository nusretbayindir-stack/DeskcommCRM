/**
 * Feriados legais da Bélgica — CALCULADOS, não listados à mão.
 * Usados pelo cálculo do prazo do GDPR para saltar dias não úteis.
 *
 * São os dez dias da lista da FOD Werkgelegenheid (conferida em 2026-11-04 em
 * https://werk.belgie.be/nl/themas/feestdagen-en-verloven/feestdagen): sete
 * fixos e três que dependem da Páscoa (Paasmaandag, Hemelvaartsdag e
 * Pinkstermaandag). Mesmo desenho de `holidays-pt.ts` (#2346): a cobertura é uma
 * CONSTANTE vigiada por teste, e a Páscoa vem do módulo comum.
 *
 * Os dias que um setor concede além destes (ou a troca de um feriado que cai no
 * domingo por outro dia) NÃO entram: dependem da empresa e não são nacionais.
 */

import { diaEmTornoDaPascoa } from "./pascoa";

/** Primeiro ano coberto pelo calendário gerado. */
export const PRIMEIRO_ANO_COBERTO = 2000;

/**
 * Último ano coberto. O teste `perfil-belgica` exige que ele alcance o ano
 * atual + 2; quando a data chegar perto, o vermelho é o pedido de estender.
 */
export const ULTIMO_ANO_COBERTO = 2100;

/** Feriados fixos — mesma data em todo ano (`MM-DD`). */
const FIXED_DATES = [
  "01-01", // Nieuwjaar
  "05-01", // Feest van de arbeid
  "07-21", // Nationale feestdag
  "08-15", // Tenhemelopneming
  "11-01", // Allerheiligen
  "11-11", // Wapenstilstand
  "12-25", // Kerstmis
];

/**
 * Os dez feriados de um ano: os sete fixos, a Paasmaandag (Páscoa + 1), a
 * Hemelvaartsdag (Páscoa + 39) e a Pinkstermaandag (Páscoa + 50).
 *
 * A lista pode repetir uma data (Hemelvaartsdag em 1 de maio, por exemplo); quem
 * consome usa `Set`, então a repetição não muda a contagem de dias úteis.
 */
export function feriadosDaBelgicaDoAno(ano: number): string[] {
  return [
    ...FIXED_DATES.map((md) => `${ano}-${md}`),
    diaEmTornoDaPascoa(ano, 1), // Paasmaandag
    diaEmTornoDaPascoa(ano, 39), // Hemelvaartsdag
    diaEmTornoDaPascoa(ano, 50), // Pinkstermaandag
  ];
}

export const HOLIDAYS_BE_ISO: string[] = (() => {
  const lista: string[] = [];
  for (let ano = PRIMEIRO_ANO_COBERTO; ano <= ULTIMO_ANO_COBERTO; ano++) {
    lista.push(...feriadosDaBelgicaDoAno(ano));
  }
  return lista;
})();
