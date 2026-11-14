/**
 * U50 — alguns Linux e Firefox informam o fuso da Turquia pelo nome antigo,
 * `Asia/Istanbul` (alias do IANA para `Europe/Istanbul`). A tabela do cadastro
 * aberto só conhecia `Europe/Istanbul` e a lista de fusos oferecidos também:
 * o fuso era descartado e a empresa turca nascia sem fuso nem lira.
 *
 * Agora o alias é traduzido para o nome canônico ANTES de qualquer régua: a
 * empresa nasce com `Europe/Istanbul` (o que Configurações sabe mostrar) e TRY.
 * O país TR segue sem ser gravado, como com `Europe/Istanbul` (sem perfil legal
 * revisado, ver U48).
 */
import { describe, expect, it } from "vitest";

import { perfilDaEmpresaNova } from "@/lib/auth/perfil-da-empresa-nova";

const TURCA = { locale: "tr", timezone: "Europe/Istanbul", currency: "TRY" };

describe("U50 — Asia/Istanbul é a Turquia", () => {
  it.each(["Europe/Istanbul", "Asia/Istanbul", " Asia/Istanbul "])("turco + %s: TRY e Europe/Istanbul", (fuso) => {
    expect(perfilDaEmpresaNova({ idioma: "tr", fuso })).toEqual(TURCA);
  });

  it("o fuso guardado é o canônico, nunca o alias", () => {
    expect(perfilDaEmpresaNova({ idioma: "tr", fuso: "Asia/Istanbul" }).timezone).toBe("Europe/Istanbul");
  });

  it("o fuso vence a região do cabeçalho, como com o nome canônico", () => {
    expect(perfilDaEmpresaNova({ idioma: "tr", fuso: "Asia/Istanbul", acceptLanguage: "tr-DE,tr;q=0.9" })).toEqual(TURCA);
  });

  it("holandês num navegador com Asia/Istanbul: a Turquia do fuso, como com Europe/Istanbul", () => {
    expect(perfilDaEmpresaNova({ idioma: "nl", fuso: "Asia/Istanbul" })).toEqual(
      perfilDaEmpresaNova({ idioma: "nl", fuso: "Europe/Istanbul" }),
    );
  });
});

describe("U50 — os outros países não mudam", () => {
  it("Brasil (pt-BR): só o idioma, byte a byte", () => {
    const perfil = perfilDaEmpresaNova({ idioma: "pt-BR", fuso: "Asia/Istanbul", acceptLanguage: "pt-BR" });
    expect(JSON.stringify(perfil)).toBe(JSON.stringify({ locale: "pt-BR" }));
    expect(JSON.stringify(perfilDaEmpresaNova({ idioma: "pt-BR", fuso: "America/Sao_Paulo" }))).toBe(
      JSON.stringify({ locale: "pt-BR" }),
    );
  });

  it("Portugal: o que já era", () => {
    expect(perfilDaEmpresaNova({ idioma: "es", fuso: "Europe/Lisbon" })).toEqual({
      locale: "es",
      timezone: "Europe/Lisbon",
      currency: "EUR",
      country: "PT",
    });
  });

  it.each(["nl", "fr"])("Bélgica (%s): o que já era", (idioma) => {
    expect(perfilDaEmpresaNova({ idioma, fuso: "Europe/Brussels" })).toEqual({
      locale: idioma,
      timezone: "Europe/Brussels",
      currency: "EUR",
      country: "BE",
    });
  });
});
