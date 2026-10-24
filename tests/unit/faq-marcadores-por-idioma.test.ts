// @vitest-environment node
/**
 * O FAQ SE ESCREVE NO IDIOMA DA TELA.
 *
 * O leitor só casava `Pergunta`/`Resposta` (e `P`/`R`). Quem usava a tela em
 * turco e escrevia "## Soru: ... ## Cevap: ..." tinha o FAQ recusado, e por isso
 * a tela ensinava português a todo mundo. Agora o leitor aceita os marcadores de
 * TODOS os idiomas (sem detecção), vindos de uma lista só.
 */
import { describe, expect, it } from "vitest";

import { parseFaqMarkdown } from "@/lib/ai/rag/ingest/faq";
import { MARCADORES_DE_FAQ, marcadoresDaTela } from "@/lib/ai/rag/ingest/marcadores-de-faq";
import { exemploDeDocumento, exemploDeFaq } from "@/lib/ai/rag/exemplos-de-material";
import { IDIOMAS } from "@/lib/i18n/idiomas";

const par = (question: string, answer: string) => expect.objectContaining({ question, answer });

describe("parseFaqMarkdown × marcadores de cada idioma", () => {
  it("turco: Soru/Cevap e Yanıt", () => {
    const itens = parseFaqMarkdown(
      "## Soru: Teslimat süresi nedir?\n## Cevap: 2 ila 3 gün.\n\n## Soru: İade var mı?\n## Yanıt: Evet.",
    );
    expect(itens).toEqual([par("Teslimat süresi nedir?", "2 ila 3 gün."), par("İade var mı?", "Evet.")]);
  });

  it("espanhol: Pregunta/Respuesta", () => {
    const itens = parseFaqMarkdown("## Pregunta: ¿Cuál es el plazo?\n## Respuesta: Dos días.");
    expect(itens).toEqual([par("¿Cuál es el plazo?", "Dos días.")]);
  });

  it("turco em maiúsculas e com ı/İ: SORU, YANIT, YANİT, soru, yanıt, CEVAP", () => {
    const md = [
      "## SORU: a?",
      "## YANIT: b",
      "## soru: c?",
      "## yanıt: d",
      "## Soru: e?",
      "## CEVAP: f",
      "## SORU: g?",
      "## YANİT: h",
    ].join("\n");
    expect(parseFaqMarkdown(md).map((i) => [i.question, i.answer])).toEqual([
      ["a?", "b"],
      ["c?", "d"],
      ["e?", "f"],
      ["g?", "h"],
    ]);
  });

  it("dois pontos de largura total também valem", () => {
    expect(parseFaqMarkdown("## Soru： a?\n## Cevap： b")).toHaveLength(1);
  });

  it("texto misturado de idiomas funciona (sem detecção de idioma)", () => {
    const itens = parseFaqMarkdown(
      "## Pergunta: p1\n## Cevap: r1\n\n## Soru: p2\n## Resposta: r2\n\n## Pregunta: p3\n## Respuesta: r3",
    );
    expect(itens.map((i) => [i.question, i.answer])).toEqual([
      ["p1", "r1"],
      ["p2", "r2"],
      ["p3", "r3"],
    ]);
  });

  it("português de hoje segue igual: Pergunta/Resposta, P/R, espaços e resposta de várias linhas", () => {
    const md = [
      "---",
      "locale: pt-BR",
      "tags: [envio]",
      "---",
      "##   Pergunta :   Qual o prazo?  ",
      "## Resposta: Dois dias.",
      "Úteis.",
      "",
      "## p: Troca?",
      "## R:   Sim.  ",
    ].join("\n");
    expect(parseFaqMarkdown(md)).toEqual([
      { question: "Qual o prazo?", answer: "Dois dias.\nÚteis.", tags: ["envio"], locale: "pt-BR" },
      { question: "Troca?", answer: "Sim.", tags: ["envio"], locale: "pt-BR" },
    ]);
  });

  it("outros títulos de nível 2 não viram marcador", () => {
    expect(parseFaqMarkdown("## Pergunta: a?\n## Resposta: b\n## Observações: c\n## Soru")).toHaveLength(1);
    expect(parseFaqMarkdown("## Observações: x\n## Título: y")).toEqual([]);
  });
});

describe("exemplos da tela", () => {
  for (const idioma of IDIOMAS) {
    it(`${idioma}: o exemplo de FAQ passa pelo leitor com pelo menos duas perguntas`, () => {
      const itens = parseFaqMarkdown(exemploDeFaq(idioma));
      expect(itens.length).toBeGreaterThanOrEqual(2);
      expect(exemploDeFaq(idioma)).toContain(marcadoresDaTela(idioma).pergunta);
      expect(exemploDeDocumento(idioma).trim().length).toBeGreaterThan(20);
    });
  }

  it("a primeira palavra de cada lista é a que a tela mostra", () => {
    expect(marcadoresDaTela("tr")).toEqual({ pergunta: "## Soru:", resposta: "## Cevap:" });
    for (const idioma of IDIOMAS) {
      expect(marcadoresDaTela(idioma).pergunta).toBe(`## ${MARCADORES_DE_FAQ[idioma].pergunta[0]}:`);
    }
  });

  it("tr: nem o FAQ nem o documento têm português", () => {
    const texto = `${exemploDeFaq("tr")}\n${exemploDeDocumento("tr")}`;
    expect(texto).not.toMatch(/Pergunta|Resposta|Qual o|Política|Aceitamos|troca|entrega|úteis|Vocês|Sim,/);
    expect(texto).toContain("## Soru:");
    expect(texto).toContain("## Cevap:");
  });

  it("pt-BR: os exemplos são os de sempre, letra por letra", () => {
    expect(exemploDeFaq("pt-BR")).toBe(`## Pergunta: Qual o prazo de entrega?
## Resposta: De 2 a 3 dias úteis após a confirmação do pagamento.

## Pergunta: Vocês fazem troca?
## Resposta: Sim, em até 30 dias, com o produto sem uso.`);
    expect(exemploDeDocumento("pt-BR")).toBe(`# Política de troca

Aceitamos troca em até 30 dias da entrega, com o produto sem uso e na embalagem
original. O frete de devolução é por nossa conta quando o defeito for de fábrica.`);
  });
});
