import { describe, expect, it } from "vitest";

import {
  ondeEstaCadaCatalogo,
  sentinelasDosCatalogos,
  violacoesDoPacote,
} from "../../scripts/i18n/pacote";

/**
 * O CATÁLOGO DE CADA IDIOMA VIAJA SOZINHO PARA O NAVEGADOR.
 *
 * A régua mede o pacote de produção (`.next/static/chunks`) pela SENTINELA de
 * cada catálogo — a tradução de "Plano atual" — e pela do dicionário
 * (o espanhol da mesma frase). Catálogo junto do dicionário é catálogo no
 * pacote de TODO usuário, que é o que o carregamento por idioma existe para
 * impedir.
 */
const SENTINELAS = { tr: "Mevcut plan", nl: "Huidig abonnement" };
const DICIONARIO = "Plan actual";
const parte = (nome: string, ...trechos: string[]) => ({ nome, conteudo: trechos.join(";") });

describe("o catálogo de cada idioma no pacote do navegador", () => {
  it("a sentinela é a tradução de \"Plano atual\", e o idioma sem ela fica de fora", () => {
    expect(
      sentinelasDosCatalogos({ tr: { "Plano atual": "Mevcut plan" }, en: { Outro: "Other" } }),
    ).toEqual({ tr: "Mevcut plan" });
  });

  it("acha em que parte cada catálogo foi parar", () => {
    expect(
      ondeEstaCadaCatalogo([parte("a.js", "Mevcut plan"), parte("b.js", "x")], SENTINELAS),
    ).toEqual({ tr: ["a.js"], nl: [] });
  });

  it("pacote limpo: cada catálogo na sua parte, longe do dicionário", () => {
    const pacote = [
      parte("main.js", DICIONARIO),
      parte("tr.js", "Mevcut plan"),
      parte("nl.js", "Huidig abonnement"),
    ];
    expect(violacoesDoPacote(pacote, SENTINELAS, DICIONARIO)).toEqual([]);
  });

  it("reprova o catálogo repetido em duas partes", () => {
    const pacote = [parte("main.js", DICIONARIO), parte("a.js", "Mevcut plan"), parte("b.js", "Mevcut plan")];
    const violacoes = violacoesDoPacote(pacote, SENTINELAS, DICIONARIO);
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]).toContain("tr");
  });

  it("reprova o catálogo na mesma parte do dicionário", () => {
    const pacote = [parte("main.js", DICIONARIO, "Mevcut plan")];
    const violacoes = violacoesDoPacote(pacote, SENTINELAS, DICIONARIO);
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]).toContain("main.js");
  });

  it("reprova dois catálogos na mesma parte", () => {
    const pacote = [parte("main.js", DICIONARIO), parte("juntos.js", "Mevcut plan", "Huidig abonnement")];
    const violacoes = violacoesDoPacote(pacote, SENTINELAS, DICIONARIO);
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]).toContain("juntos.js");
  });
});
