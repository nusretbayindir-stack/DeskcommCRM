/**
 * OS COMANDOS DA EQUIPE NO IDIOMA DE QUEM ATENDE (S2a, decisão do dono de
 * 2026-11-12, opção B).
 *
 * `RESPONDER` e `PERGUNTAR` continuam valendo em toda organização. Cada idioma
 * da Bélgica ganha as suas palavras — ANTWOORD/VRAAG, RÉPONDRE/DEMANDER,
 * YANITLA/SOR — e TODAS valem em toda organização: a equipe belga mistura
 * línguas, e a tela de cada pessoa ensina a palavra da língua dela. Quem
 * decide o caso continua sendo o ID de 36 caracteres logo depois.
 *
 * O aviso que vai ao WhatsApp da equipe ensina a palavra do idioma da
 * EMPRESA, com a explicação entre `< >` traduzida — antes ela saía em
 * português ("<resposta ou decisão>") para toda organização.
 */
import { describe, expect, it } from "vitest";

import { comecaComPalavraDeComando, palavrasDoComando } from "@/lib/escalacao/palavras-do-comando";
import { parseComandoDeRespostaDoSuporte } from "@/lib/escalacao/resposta-whatsapp-ao-caso";
import { montarAvisoDeCaso } from "@/lib/escalacao/texto-do-aviso";

const CASO = "02920000-5555-4000-8000-000000000001";

const RESOLVE = ["RESPONDER", "responder", "ANTWOORD", "Antwoord", "RÉPONDRE", "Répondre", "REPONDRE", "repondre", "YANITLA", "Yanıtla", "yanıtla", "yanitla"];
const PERGUNTA = ["PERGUNTAR", "perguntar", "VRAAG", "vraag", "DEMANDER", "Demander", "SOR", "Sor", "sor"];

describe("as palavras do comando, em qualquer idioma e em qualquer organização", () => {
  for (const palavra of RESOLVE) {
    it(`${palavra} resolve o caso`, () => {
      expect(parseComandoDeRespostaDoSuporte(`${palavra} ${CASO} De klant krijgt 10%.`)).toEqual({
        caseId: CASO,
        action: "resolved",
        body: "De klant krijgt 10%.",
      });
    });
  }
  for (const palavra of PERGUNTA) {
    it(`${palavra} pede à IA que pergunte ao cliente`, () => {
      expect(parseComandoDeRespostaDoSuporte(`${palavra} ${CASO} Welke maat?`)).toEqual({
        caseId: CASO,
        action: "need_lead_info",
        body: "Welke maat?",
      });
    });
  }
  it("palavra parecida não é comando", () => {
    for (const texto of [`ANTWOORDEN ${CASO} ja`, `Sorun ${CASO} var`, `VRAAGJE ${CASO} hoi`, `DEMANDE ${CASO} oui`, `RESPONDA ${CASO} sim`]) {
      expect(parseComandoDeRespostaDoSuporte(texto)).toBeNull();
    }
  });
  it("sem o ID do caso não há comando", () => {
    expect(parseComandoDeRespostaDoSuporte("VRAAG welke maat?")).toBeNull();
  });
});

describe("começa com a palavra do comando (o formato errado ganha a ajuda)", () => {
  it("a palavra sozinha ou seguida de texto", () => {
    for (const texto of ["VRAAG", "vraag welke maat", "Répondre", "yanıtla tamam", "SOR", "PERGUNTAR"]) {
      expect(comecaComPalavraDeComando(texto)).toBe(true);
    }
  });
  it("palavra que só começa igual, ou nenhuma", () => {
    for (const texto of ["Sorun var", "Vraagje", "Demande", "bom dia", "", null, undefined]) {
      expect(comecaComPalavraDeComando(texto)).toBe(false);
    }
  });
  // Revisão do PR: tirar TODO acento fazia "Sör", "Şor" e "Vráag" virarem
  // comando (e ganharem a ajuda do formato). Vale só a grafia da palavra —
  // com o acento dela ou sem acento nenhum —, e o acento decomposto do
  // teclado conta como o composto.
  it("só a grafia da palavra, com o acento dela ou sem acento", () => {
    for (const texto of ["Sör bunu sonra konuşalım", "Şor", "Vráag", "RÈPONDRE", "Dêmander"]) {
      expect(comecaComPalavraDeComando(texto)).toBe(false);
    }
    for (const texto of ["Répondre", "RÉPONDRE", "REPONDRE", "repondre", "YANITLA", "yanitla"]) {
      expect(comecaComPalavraDeComando(texto)).toBe(true);
    }
  });
});

const BASE = {
  marca: "Acme",
  idioma: "pt-BR" as const,
  kind: "financeiro",
  source: "agent" as const,
  title: "Desconto acima da política",
  summary: "15% de desconto no plano anual",
  blocker: "a política permite até 10%",
  caseId: CASO,
  nomeDoCliente: "Maria Silva",
  link: "https://example.com/app/ai/cases?caso=1",
  respostaWhatsappHabilitada: true,
};

describe("o aviso ensina a palavra do idioma da empresa", () => {
  it("palavrasDoComando: português e espanhol seguem com as de sempre", () => {
    expect(palavrasDoComando("pt-BR")).toEqual({ responder: "RESPONDER", perguntar: "PERGUNTAR" });
    expect(palavrasDoComando("es")).toEqual({ responder: "RESPONDER", perguntar: "PERGUNTAR" });
  });

  const CASOS = [
    ["nl", "ANTWOORD", "antwoord of beslissing", "VRAAG", "vraag aan de klant"],
    ["fr", "RÉPONDRE", "réponse ou décision", "DEMANDER", "question au client"],
    ["tr", "YANITLA", "yanıt veya karar", "SOR", "müşteriye soru"],
    ["es", "RESPONDER", "respuesta o decisión", "PERGUNTAR", "pregunta al cliente"],
  ] as const;
  for (const [idioma, responder, oQue, perguntar, aPergunta] of CASOS) {
    it(`${idioma}: ${responder} / ${perguntar}, com a explicação traduzida`, () => {
      const texto = montarAvisoDeCaso({ ...BASE, idioma } as Parameters<typeof montarAvisoDeCaso>[0]);
      expect(texto).toContain(`${responder} ${CASO} <${oQue}>`);
      expect(texto).toContain(`${perguntar} ${CASO} <${aPergunta}>`);
      expect(texto).not.toContain("<resposta ou decisão>");
      expect(texto).not.toContain("<pergunta ao cliente>");
    });
  }
});
