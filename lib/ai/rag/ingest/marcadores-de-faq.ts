/**
 * OS MARCADORES DE PERGUNTA E RESPOSTA, POR IDIOMA — a única lista.
 *
 * O leitor (`faq.ts`), os exemplos da tela, o editor de FAQ e as mensagens de
 * erro leem daqui. Antes, o leitor casava só `Pergunta`/`Resposta` por regex, e
 * quem escrevia "## Soru:" ou "## Pregunta:" tinha o FAQ recusado; por isso a
 * tela ensinava português a todo mundo.
 *
 * - A PRIMEIRA palavra de cada lista é a que a tela mostra a quem usa aquele
 *   idioma. As demais são sinônimos que o leitor também aceita.
 * - `Idioma` só tem os idiomas que a tela serve; ao promover um idioma no
 *   registro, o compilador cobra a linha dele aqui.
 * - O leitor aceita as palavras de TODOS os idiomas, sempre: não há detecção
 *   de idioma, então um texto misturado também funciona.
 * - Cliente-seguro de propósito (sem import de servidor): o editor, um
 *   componente cliente, importa `faq.ts`, que importa este arquivo.
 */
import type { Idioma } from "@/lib/i18n/idiomas";

export interface MarcadoresDeFaq {
  pergunta: readonly string[];
  resposta: readonly string[];
}

export const MARCADORES_DE_FAQ: Record<Idioma, MarcadoresDeFaq> = {
  // `P`/`R` são as formas curtas que o leitor sempre aceitou (e cobrem o
  // espanhol `P`/`R`).
  "pt-BR": { pergunta: ["Pergunta", "P"], resposta: ["Resposta", "R"] },
  es: { pergunta: ["Pregunta"], resposta: ["Respuesta"] },
  tr: { pergunta: ["Soru"], resposta: ["Cevap", "Yanıt"] },
};

/**
 * Dobra maiúscula/minúscula sem errar o turco: `/i` e `toLowerCase()` não
 * casam `I`/`ı`/`İ` entre si ("YANIT" ≠ "yanıt"). Minúscula pelo turco e depois
 * `ı` → `i`, dos dois lados da comparação.
 */
function dobrar(palavra: string): string {
  return palavra.toLocaleLowerCase("tr").replace(/ı/g, "i");
}

function conjunto(escolher: (m: MarcadoresDeFaq) => readonly string[]): ReadonlySet<string> {
  const todas = new Set<string>();
  for (const marcadores of Object.values(MARCADORES_DE_FAQ)) {
    for (const palavra of escolher(marcadores)) todas.add(dobrar(palavra));
  }
  return todas;
}

const PALAVRAS_DE_PERGUNTA = conjunto((m) => m.pergunta);
const PALAVRAS_DE_RESPOSTA = conjunto((m) => m.resposta);

/** `Soru` → "pergunta"; `YANIT` → "resposta"; qualquer outra coisa → `null`. */
export function tipoDeMarcador(palavra: string): "pergunta" | "resposta" | null {
  const d = dobrar(palavra);
  if (PALAVRAS_DE_PERGUNTA.has(d)) return "pergunta";
  if (PALAVRAS_DE_RESPOSTA.has(d)) return "resposta";
  return null;
}

/** Os marcadores como a tela os escreve no idioma: `## Soru:` / `## Cevap:`. */
export function marcadoresDaTela(idioma: Idioma): { pergunta: string; resposta: string } {
  const m = MARCADORES_DE_FAQ[idioma];
  return { pergunta: `## ${m.pergunta[0]}:`, resposta: `## ${m.resposta[0]}:` };
}

/**
 * Preenche `{pergunta}`/`{resposta}` de uma frase já traduzida com os marcadores
 * do idioma. A frase leva o marcador por placeholder para cada tradução
 * escolher o lugar dele, em vez de ter um marcador cravado em cada língua.
 */
export function preencherMarcadores(frase: string, idioma: Idioma): string {
  const { pergunta, resposta } = marcadoresDaTela(idioma);
  return frase.replaceAll("{pergunta}", pergunta).replaceAll("{resposta}", resposta);
}

/**
 * Os rótulos de sistema de um trecho de FAQ (`Pergunta: X\nResposta: Y`, gravado
 * por `workers/rag-indexer.ts` para o modelo ler) no idioma de quem olha.
 *
 * SÓ na exibição: o trecho guardado e o embedding não mudam. Troca apenas o
 * `Pergunta: ` do começo do trecho e o primeiro `Resposta: ` que abre linha; o
 * que a pessoa escreveu dentro da pergunta ou da resposta fica como está. Só
 * vale para trecho de FAQ (`source_type: "faq"` no metadata do trecho).
 */
export function rotulosDoTrechoNoIdioma(
  conteudo: string,
  idioma: Idioma,
  tipoDeFonte: unknown,
): string {
  if (tipoDeFonte !== "faq" || idioma === "pt-BR") return conteudo;
  const m = MARCADORES_DE_FAQ[idioma];
  if (!conteudo.startsWith("Pergunta: ")) return conteudo;
  return `${m.pergunta[0]}: ${conteudo.slice("Pergunta: ".length)}`.replace(
    "\nResposta: ",
    `\n${m.resposta[0]}: `,
  );
}
