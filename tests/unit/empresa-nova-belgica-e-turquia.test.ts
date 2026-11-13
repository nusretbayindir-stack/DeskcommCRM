/**
 * U48 — a empresa que se cadastra sozinha na Bélgica ou na Turquia nascia com a
 * moeda, o fuso e o país errados: as tabelas de `perfil-da-empresa-nova.ts`
 * não tinham Bruxelas nem Istambul, e a empresa belga nascia em BRL e sem país.
 *
 * O país só é GRAVADO com perfil legal revisado (`paisesOferecidos`): a Bélgica
 * tem; a Turquia ainda não (decisão do dono, M1: "só Bélgica por enquanto").
 * Então a empresa turca nasce com o fuso e a lira, e sem país — como o México.
 */
import { describe, expect, it } from "vitest";

import { perfilDaEmpresaNova } from "@/lib/auth/perfil-da-empresa-nova";
import { paisesOferecidos } from "@/lib/legal/perfil-do-pais";

describe("Bélgica", () => {
  it.each(["nl", "fr"])("%s + fuso de Bruxelas: BE, EUR, Europe/Brussels", (idioma) => {
    expect(perfilDaEmpresaNova({ idioma, fuso: "Europe/Brussels" })).toEqual({
      locale: idioma,
      timezone: "Europe/Brussels",
      currency: "EUR",
      country: "BE",
    });
  });

  it.each([
    ["nl", "nl-BE,nl;q=0.9,en;q=0.8"],
    ["fr", "fr-BE,fr;q=0.9"],
  ])("sem fuso do navegador, %s com %s: Bélgica pela região do cabeçalho", (idioma, acceptLanguage) => {
    expect(perfilDaEmpresaNova({ idioma, acceptLanguage })).toEqual({
      locale: idioma,
      timezone: "Europe/Brussels",
      currency: "EUR",
      country: "BE",
    });
  });

  it("holandês sem região (Países Baixos) e francês sem região (França) NÃO viram Bélgica", () => {
    expect(perfilDaEmpresaNova({ idioma: "nl", acceptLanguage: "nl" })).toEqual({ locale: "nl" });
    expect(perfilDaEmpresaNova({ idioma: "fr", acceptLanguage: "fr,en;q=0.5" })).toEqual({ locale: "fr" });
    expect(perfilDaEmpresaNova({ idioma: "nl", fuso: "Europe/Amsterdam" })).not.toHaveProperty("country", "BE");
    expect(perfilDaEmpresaNova({ idioma: "fr", fuso: "Europe/Paris" })).not.toHaveProperty("country", "BE");
  });
});

describe("Turquia", () => {
  it("turco + fuso de Istambul: TRY e Europe/Istanbul", () => {
    expect(perfilDaEmpresaNova({ idioma: "tr", fuso: "Europe/Istanbul" })).toEqual({
      locale: "tr",
      timezone: "Europe/Istanbul",
      currency: "TRY",
    });
  });

  it("sem fuso do navegador, tr-TR: o mesmo", () => {
    expect(perfilDaEmpresaNova({ idioma: "tr", acceptLanguage: "tr-TR,tr;q=0.9" })).toEqual({
      locale: "tr",
      timezone: "Europe/Istanbul",
      currency: "TRY",
    });
  });

  it("o país TR não é gravado enquanto não houver perfil legal turco revisado", () => {
    expect(paisesOferecidos().map((p) => p.codigo)).not.toContain("TR");
    expect(perfilDaEmpresaNova({ idioma: "tr", fuso: "Europe/Istanbul" })).not.toHaveProperty("country");
  });
});

describe("Brasil e Portugal não mudam", () => {
  it("pt-BR nasce só com o idioma, mesmo com fuso de Bruxelas ou Istambul", () => {
    expect(perfilDaEmpresaNova({ idioma: "pt-BR", fuso: "Europe/Brussels" })).toEqual({ locale: "pt-BR" });
    expect(perfilDaEmpresaNova({ idioma: "pt-BR", fuso: "Europe/Istanbul" })).toEqual({ locale: "pt-BR" });
  });

  it("Lisboa segue PT/EUR", () => {
    expect(perfilDaEmpresaNova({ idioma: "es", fuso: "Europe/Lisbon" })).toEqual({
      locale: "es",
      timezone: "Europe/Lisbon",
      currency: "EUR",
      country: "PT",
    });
  });
});
