/**
 * OS RÓTULOS DE SISTEMA DE UM TRECHO, NO IDIOMA DE QUEM OLHA (só na exibição).
 *
 * Moveu-se de `marcadores-de-faq.ts` para que aquele arquivo guarde uma coisa
 * só: a lista de marcadores que o leitor aceita. Aqui fica a tradução, na tela,
 * do que o indexador grava em português para o modelo ler.
 */
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

import { MARCADORES_DE_FAQ } from "./marcadores-de-faq";

/**
 * Os rótulos de sistema de um trecho de FAQ (`Pergunta: X\nResposta: Y`, gravado
 * por `workers/rag-indexer.ts` para o modelo ler) no idioma de quem olha.
 *
 * SÓ na exibição: o trecho guardado e o embedding não mudam. Troca apenas o
 * `Pergunta: ` do começo do trecho e o primeiro `Resposta: ` que abre linha; o
 * que a pessoa escreveu dentro da pergunta ou da resposta fica como está. Só
 * vale para trecho de FAQ (`source_type: "faq"` no metadata do trecho) e, para
 * trecho de conversa, os rótulos `Cliente: `/`Atendente: ` de TODO começo de
 * linha (`buildTranscript` os escreve a cada fala), via o dicionário.
 */
export function rotulosDoTrechoNoIdioma(
  conteudo: string,
  idioma: Idioma,
  tipoDeFonte: unknown,
): string {
  if (idioma === "pt-BR") return conteudo;
  if (tipoDeFonte === "conversas") return rotulosDaConversa(conteudo, idioma);
  if (tipoDeFonte !== "faq") return conteudo;
  const m = MARCADORES_DE_FAQ[idioma];
  if (!conteudo.startsWith("Pergunta: ")) return conteudo;
  return `${m.pergunta[0]}: ${conteudo.slice("Pergunta: ".length)}`.replace(
    "\nResposta: ",
    `\n${m.resposta[0]}: `,
  );
}

export function rotulosDaConversa(conteudo: string, idioma: Idioma): string {
  return conteudo.replace(/^(Cliente|Atendente): /gm, (_, quem: string) => `${quem === "Cliente" ? traduzir("Cliente", idioma) : traduzir("Atendente", idioma)}: `);
}
