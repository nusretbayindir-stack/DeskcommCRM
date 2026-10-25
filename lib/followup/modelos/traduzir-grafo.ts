/**
 * O GRAFO DO MODELO NO IDIOMA DE QUEM INSTALA.
 *
 * O catálogo é escrito em português (é código nosso, e o grafo é montado uma vez
 * na carga do módulo). Mas o que a rota grava em `draft_graph` é o que o
 * operador lê no construtor: nome do nó, nome do ramo, nota do fim. Gravar em
 * português para quem opera em turco ou espanhol deixa o canvas misturado — e o
 * dado já gravado não muda quando a pessoa troca de idioma depois.
 *
 * Traduz-se na hora de gravar, como `etapasIniciais` faz com o funil. O que
 * NÃO se traduz, de propósito:
 *   • `config.body` — o texto que o paciente lê é conteúdo da clínica, e a
 *     decisão de escrevê-lo em outra língua é de conteúdo, não de interface;
 *   • ids, arestas, prazos, padrões de casamento — são estrutura e dado.
 *
 * As chaves são dinâmicas (`traduzir(rotulo)`), então nenhum varredor de AST as
 * enxerga: `modelos.test.ts` e `traduzir-grafo.test.ts` cobram o espanhol e o
 * turco de cada rótulo do catálogo.
 */
import type { FlowGraph, FlowNode } from "@/lib/followup/graph-schema";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

import { rotuloDaEspera } from "./escada";

export function traduzirGrafoDoModelo(grafo: FlowGraph, idioma: Idioma): FlowGraph {
  if (idioma === "pt-BR") return grafo;
  const t = (texto: string) => traduzir(texto, idioma);

  const nodes = grafo.nodes.map((no): FlowNode => {
    if (no.type === "wait" && no.config.mode === "fixed") {
      // O prazo mora no config; o rótulo é montado de novo com o número no molde.
      return { ...no, label: rotuloDaEspera(no.config.duration_ms, t) };
    }
    if (no.type === "match_reply") {
      return {
        ...no,
        label: t(no.label),
        config: { ...no.config, branches: no.config.branches.map((b) => ({ ...b, label: t(b.label) })) },
      };
    }
    if (no.type === "end") {
      return {
        ...no,
        label: t(no.label),
        config: no.config.note ? { ...no.config, note: t(no.config.note) } : no.config,
      };
    }
    return { ...no, label: t(no.label) };
  });

  return { ...grafo, nodes };
}
