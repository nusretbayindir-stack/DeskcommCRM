/**
 * O LEITOR DOS CATÁLOGOS NO SERVIDOR — `lib/i18n/traducoes/<codigo>.json` na memória.
 *
 * ─── Dois leitores, um contrato ────────────────────────────────────────────
 *
 * O servidor e o worker mandam mensagem para clientes de idiomas diferentes,
 * então leem TODOS os catálogos visíveis, aqui, de forma estática. O pacote do
 * navegador NÃO recebe este arquivo: o `resolveAlias` do `next.config.ts` o
 * troca por `catalogos.navegador.ts`, que baixa só o catálogo de quem lê. Os
 * dois expõem os mesmos nomes (`tests/unit/catalogo-do-navegador-tem-o-mesmo-contrato`),
 * e quem importa escreve `@/lib/i18n/catalogos` — é por esse nome que o alias
 * casa.
 *
 * ─── Só entra aqui o catálogo de um idioma que aparece ─────────────────────
 *
 * O de um idioma `em_construcao` não é servido a ninguém. A guarda está em
 * `tests/unit/catalogo-de-idioma-tem-forma`: só os dois leitores importam
 * catálogo, e só o de um idioma visível.
 *
 * ─── O dicionário vem antes ────────────────────────────────────────────────
 *
 * `traduzir` consulta a coluna do dicionário e só depois o catálogo; os dois
 * caem no português. A leitura é síncrona; o que é assíncrono é só a chegada
 * do catálogo no navegador, e quem espera por ela é o `IdiomaProvider`.
 */
import type { Idioma } from "./idiomas";
import tr from "./traducoes/tr.json";

const CATALOGOS: Partial<Record<Idioma, Readonly<Record<string, string>>>> = { tr };

/** Os idiomas cujo texto vem de um catálogo, e não de coluna do dicionário. */
export const IDIOMAS_COM_CATALOGO = Object.keys(CATALOGOS) as Idioma[];

/** A frase no catálogo do idioma, ou `undefined` quando ele não a tem. */
export function entradaDoCatalogo(idioma: Idioma, texto: string): string | undefined {
  return CATALOGOS[idioma]?.[texto];
}

/** No servidor todo catálogo já está na memória: não há o que esperar. */
export function catalogoPronto(_idioma: Idioma): boolean {
  return true;
}

/** No servidor não há o que baixar. Mesmo nome e forma do leitor do navegador. */
export function carregarCatalogo(_idioma: Idioma): Promise<void> {
  return Promise.resolve();
}
