/**
 * O LEITOR DOS CATÁLOGOS NO NAVEGADOR — cada idioma baixado à parte.
 *
 * ─── Por que existe ────────────────────────────────────────────────────────
 *
 * Um catálogo importado de forma estática vai no pacote de TODO usuário: com o
 * turco, o holandês e o francês seriam 1–1,3 MB para cada pessoa, que lê uma
 * língua só. O `resolveAlias` do `next.config.ts` entrega este arquivo, e não
 * `catalogos.ts`, ao pacote do navegador. Os nomes são os mesmos dos dois lados.
 *
 * ─── O contrato ────────────────────────────────────────────────────────────
 *
 * - `carregarCatalogo` NUNCA rejeita. O mesmo pedido em curso devolve a mesma
 *   promessa (é o que o `use()` do `IdiomaProvider` exige).
 * - `catalogoPronto` quer dizer "não há mais o que esperar": o catálogo chegou,
 *   o idioma não tem catálogo (português, espanhol), ou a última tentativa
 *   falhou. Sem a terceira, uma falha de rede deixaria a tela suspensa para
 *   sempre; com ela, a tela abre em português e o console guarda o motivo.
 * - `catalogoCarregado` quer dizer "o texto está na mão": o idioma não tem
 *   catálogo ou ele chegou. Uma falha NÃO conta: a troca de idioma
 *   (`useTrocaComCatalogo`) só pinta quando `catalogoCarregado` é verdadeiro.
 * - Depois de uma falha, um pedido explícito (trocar o idioma) tenta de novo.
 */
import type { Idioma } from "./idiomas";

type Catalogo = Readonly<Record<string, string>>;

const CARREGADORES: Partial<Record<Idioma, () => Promise<{ default: Catalogo }>>> = {
  tr: () => import("./traducoes/tr.json"),
  nl: () => import("./traducoes/nl.json"),
  fr: () => import("./traducoes/fr.json"),
};

/** Os idiomas cujo texto vem de um catálogo, e não de coluna do dicionário. */
export const IDIOMAS_COM_CATALOGO = Object.keys(CARREGADORES) as Idioma[];

const carregados: Partial<Record<Idioma, Catalogo>> = {};
const emCurso = new Map<Idioma, Promise<void>>();
const falharam = new Set<Idioma>();

/** A frase no catálogo do idioma, ou `undefined` quando ele não a tem (ou ainda não chegou). */
export function entradaDoCatalogo(idioma: Idioma, texto: string): string | undefined {
  return carregados[idioma]?.[texto];
}

/** Não há mais o que esperar por este idioma (ver o contrato no cabeçalho). */
export function catalogoPronto(idioma: Idioma): boolean {
  return CARREGADORES[idioma] === undefined || carregados[idioma] !== undefined || falharam.has(idioma);
}

/** O texto do idioma está na mão (ver o contrato no cabeçalho). */
export function catalogoCarregado(idioma: Idioma): boolean {
  return CARREGADORES[idioma] === undefined || carregados[idioma] !== undefined;
}

/** Baixa o catálogo do idioma uma vez. Nunca rejeita. */
export function carregarCatalogo(idioma: Idioma): Promise<void> {
  const carregador = CARREGADORES[idioma];
  if (carregador === undefined || carregados[idioma] !== undefined) return Promise.resolve();
  const atual = emCurso.get(idioma);
  if (atual) return atual;

  const tentativa = carregador()
    .then(
      (modulo) => {
        carregados[idioma] = modulo.default;
        falharam.delete(idioma);
      },
      (erro: unknown) => {
        console.error("[i18n] catálogo não carregou", idioma, erro);
        falharam.add(idioma);
      },
    )
    .finally(() => {
      emCurso.delete(idioma);
    });
  emCurso.set(idioma, tentativa);
  return tentativa;
}
