import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { naTelaDoColdCall } from "@/lib/cold-call/no-idioma";
import { ETAPAS_DO_COLD_CALL, RESULTADOS, linhasDoRoteiro, roteiroPadrao } from "@/lib/cold-call/regras";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O COLD CALL NASCE NO IDIOMA DE QUEM USA (S2a Task 7b, U41).
 *
 * Achado na leitura do turco (PR #40): a ajuda dizia "Kuyrukta" e o quadro
 * mostrava "Na fila"; o roteiro inicial saía em português para quem não fala
 * espanhol nem inglês. O mesmo valia para o neerlandês e o francês.
 *
 * - As etapas nascem no idioma de quem cria o funil, como a descrição (que já
 *   passava por `traduzir`). O slug não muda: a fila anda por ele.
 * - "Follow-up" aqui é "ligar de novo depois", não a mensagem de
 *   acompanhamento do produto ("Takip mesajı", "Opvolgbericht", "Message de
 *   relance"): a tela e a criação usam `Follow-up@@cold-call`. O dado gravado
 *   (`RESULTADOS.rotulo`, motivo de perda, `reason` da timeline) não muda — o
 *   banco valida o motivo contra `lost_reasons`.
 * - O roteiro inicial existe em turco, neerlandês e francês, neutro como os
 *   outros, com lacunas no próprio idioma.
 */
const RAIZ = join(__dirname, "..", "..");
const fonte = (caminho: string) => readFileSync(join(RAIZ, caminho), "utf8");

const nomeNaCriacao = (nome: string, idioma: Parameters<typeof traduzir>[1]) =>
  traduzir(naTelaDoColdCall(nome), idioma);

describe("as etapas do funil de Cold Call", () => {
  it("a rota cria cada etapa no idioma de quem cria, pela chave de tela", () => {
    expect(fonte("app/api/v1/cold-call/route.ts")).toContain(
      "name: traduzir(naTelaDoColdCall(etapa.name), authz.user.idioma)",
    );
  });

  it("português sai como antes, letra por letra", () => {
    for (const e of ETAPAS_DO_COLD_CALL) expect(nomeNaCriacao(e.name, "pt-BR")).toBe(e.name);
  });

  it("turco, neerlandês e francês: nenhuma etapa em português", () => {
    for (const idioma of ["tr", "nl", "fr"] as const) {
      for (const e of ETAPAS_DO_COLD_CALL) {
        expect(nomeNaCriacao(e.name, idioma), `${idioma}: ${e.name}`).not.toBe(e.name);
      }
    }
  });

  it("os nomes esperados nas duas etapas que faltavam", () => {
    expect(nomeNaCriacao("Reunião pedida", "es")).toBe("Reunión solicitada");
    expect(nomeNaCriacao("Reunião pedida", "tr")).toBe("Toplantı istendi");
    expect(nomeNaCriacao("Reunião pedida", "nl")).toBe("Vergadering gevraagd");
    expect(nomeNaCriacao("Reunião pedida", "fr")).toBe("Réunion demandée");
    expect(nomeNaCriacao("Follow-up", "tr")).toBe("Tekrar aranacak");
    expect(nomeNaCriacao("Follow-up", "nl")).toBe("Opvolgen");
    expect(nomeNaCriacao("Follow-up", "fr")).toBe("À relancer");
    expect(nomeNaCriacao("Follow-up", "es")).toBe(traduzir("Follow-up", "es"));
  });

  it("fora do Cold Call, Follow-up segue a mensagem de acompanhamento", () => {
    expect(traduzir("Follow-up", "tr")).toBe("Takip mesajı");
    expect(naTelaDoColdCall("Não atendeu")).toBe("Não atendeu");
  });
});

describe("os botões de resultado da ligação", () => {
  it("toda tradução de rótulo de resultado passa pela chave de tela", () => {
    const tela = fonte("app/app/cold-call/_client.tsx");
    expect(tela).not.toMatch(/\bt\(RESULTADOS\[/);
    expect(tela.match(/\bt\(naTelaDoColdCall\(RESULTADOS\[/g)?.length).toBe(4);
  });

  it("o dado gravado não muda", () => {
    expect(RESULTADOS.follow_up.rotulo).toBe("Follow-up");
    expect(RESULTADOS.sem_interesse.rotulo).toBe("Não tem interesse");
  });
});

describe("o roteiro inicial", () => {
  const dados = { negocio: "Pet Exemplo", quemLiga: "Caio", suaEmpresa: "Clínica Sol" };
  const CABECALHO = { tr: "Açılış", nl: "Goedendag", fr: "Bonjour" } as const;

  for (const idioma of ["tr", "nl", "fr"] as const) {
    it(`${idioma}: no idioma, neutro, e as lacunas se preenchem`, () => {
      const roteiro = roteiroPadrao(idioma);
      expect(roteiro).not.toBe(roteiroPadrao("pt-BR"));
      expect(roteiro).toContain(CABECALHO[idioma]);
      expect(roteiro).not.toMatch(/\bIA\b|\bAI\b|WhatsApp|Google Meet|atendente/i);
      const texto = linhasDoRoteiro(roteiro, dados)
        .map((l) => l.texto)
        .join(" ");
      expect(texto).toContain("Pet Exemplo");
      expect(texto).toContain("Caio");
      expect(texto).toContain("Clínica Sol");
      expect(texto).not.toMatch(/\[(?:müşterinin adı|adınız|şirketiniz|naam van de lead|uw naam|uw bedrijf|nom du prospect|votre nom|votre entreprise)\]/i);
    });
  }

  it("francês com espaço inseparável antes de ? ! : ;", () => {
    const roteiro = roteiroPadrao("fr");
    expect(roteiro).toMatch(/ \?/);
    expect(roteiro).not.toMatch(/ [?!:;]/);
  });

  it("língua sem roteiro próprio segue no português", () => {
    expect(roteiroPadrao("de")).toBe(roteiroPadrao("pt-BR"));
  });
});
