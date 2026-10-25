// @vitest-environment node
/**
 * O TRECHO DE FAQ MOSTRA OS ROTULOS NO IDIOMA DA TELA.
 *
 * `workers/rag-indexer.ts` grava "Pergunta: X\nResposta: Y" no trecho (texto
 * que o modelo le). A tela "Ver o que ele aprendeu" o mostra ao operador; so a
 * exibicao muda, o trecho guardado e o embedding ficam como estao.
 */
import { describe, expect, it } from "vitest";

import { rotulosDoTrechoNoIdioma } from "@/lib/ai/rag/ingest/rotulos-de-trecho";

const TRECHO = "Pergunta: Qual o prazo?\nResposta: Dois dias.";

describe("rotulosDoTrechoNoIdioma", () => {
  it("tr: Soru/Cevap", () => {
    expect(rotulosDoTrechoNoIdioma(TRECHO, "tr", "faq")).toBe("Soru: Qual o prazo?\nCevap: Dois dias.");
  });
  it("es: Pregunta/Respuesta", () => {
    expect(rotulosDoTrechoNoIdioma(TRECHO, "es", "faq")).toBe("Pregunta: Qual o prazo?\nRespuesta: Dois dias.");
  });
  it("pt-BR: byte a byte igual", () => {
    expect(rotulosDoTrechoNoIdioma(TRECHO, "pt-BR", "faq")).toBe(TRECHO);
  });
  it("palavra no meio da linha, na resposta do usuario, nao muda", () => {
    const t = "Pergunta: Voce diz Pergunta: ou Resposta: ?\nResposta: Use a Resposta: certa\nPergunta: de novo";
    expect(rotulosDoTrechoNoIdioma(t, "tr", "faq")).toBe(
      "Soru: Voce diz Pergunta: ou Resposta: ?\nCevap: Use a Resposta: certa\nPergunta: de novo",
    );
  });
  it("trecho que nao e de FAQ nao muda", () => {
    expect(rotulosDoTrechoNoIdioma(TRECHO, "tr", "documento")).toBe(TRECHO);
    expect(rotulosDoTrechoNoIdioma(TRECHO, "tr", undefined)).toBe(TRECHO);
  });
  it("continuacao de trecho longo (sem rotulo no inicio) nao muda", () => {
    expect(rotulosDoTrechoNoIdioma("mais texto da resposta", "tr", "faq")).toBe("mais texto da resposta");
  });

  describe("trecho de conversa (Cliente:/Atendente:)", () => {
    const CONVERSA = "Cliente: oi\nAtendente: ola, Cliente: voce?\nCliente: sim";
    it("tr: todo comeco de linha, inclusive continuacao", () => {
      expect(rotulosDoTrechoNoIdioma(CONVERSA, "tr", "conversas")).toBe(
        "Müşteri: oi\nTemsilci: ola, Cliente: voce?\nMüşteri: sim",
      );
    });
    it("pt-BR: byte a byte igual", () => {
      expect(rotulosDoTrechoNoIdioma(CONVERSA, "pt-BR", "conversas")).toBe(CONVERSA);
    });
    it("FAQ e outros trechos nao ganham essa troca", () => {
      expect(rotulosDoTrechoNoIdioma(CONVERSA, "tr", "faq")).toBe(CONVERSA);
      expect(rotulosDoTrechoNoIdioma(CONVERSA, "tr", "documento")).toBe(CONVERSA);
    });
  });
});
