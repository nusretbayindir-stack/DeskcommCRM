/**
 * O contexto que cada frase leva no lote de tradução (`lotes-para-traduzir.ts`).
 *
 * O espanhol e o inglês vêm de sempre. O turco entra para quem traduz qualquer
 * outro idioma: o catálogo turco foi lido frase a frase, e é o contexto mais
 * próximo do uso real que o fork tem (doc S2a, Task 4). Quem traduz o turco não
 * o recebe — seria a resposta, não o contexto.
 *
 * O que falta numa fonte fica `undefined` e some no `JSON.stringify` do lote.
 */
export interface ContextoDaFrase {
  es?: string;
  en?: string;
  tr?: string;
}

export interface FontesDoContexto {
  readonly dicionario: Readonly<Record<string, { readonly es?: string } | undefined>>;
  readonly ingles: Readonly<Record<string, string>>;
  readonly turco: Readonly<Record<string, string>>;
}

export function contextoDaFrase(chave: string, idioma: string, fontes: FontesDoContexto): ContextoDaFrase {
  const contexto: ContextoDaFrase = { es: fontes.dicionario[chave]?.es, en: fontes.ingles[chave] };
  if (idioma !== "tr") contexto.tr = fontes.turco[chave];
  return contexto;
}
