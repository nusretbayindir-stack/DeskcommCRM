// @vitest-environment node
import { describe, expect, it } from "vitest";

import { mapHeader } from "@/lib/contacts/csv";
import {
  citacaoDaLei,
  isValidKbo,
  paisesOferecidos,
  perfilDoPais,
} from "@/lib/legal/perfil-do-pais";
import {
  feriadosDaBelgicaDoAno,
  HOLIDAYS_BE_ISO,
  ULTIMO_ANO_COBERTO,
} from "@/lib/lgpd/holidays-be";

describe("perfil da Bélgica", () => {
  it("está no registro e no seletor, revisada por IA", () => {
    expect(paisesOferecidos().map((p) => p.codigo)).toContain("BE");
    const p = perfilDoPais("BE");
    expect(p.codigo).toBe("BE");
    expect(p.nome).toBe("Bélgica");
    expect(p.documento.rotulo).toBe("KBO/BCE");
    expect(p.empresa).toEqual({
      rotuloNomeLegal: "Denominação social",
      rotuloNumero: "Número da empresa (KBO/BCE)",
    });
    expect(p.telefoneExemplo).toBe("+32470123456");
    expect(p.idioma).toBe("nl-BE");
    expect(p.fusoDoSugerido).toBe("Europe/Brussels");
    expect(p.lei?.revisadaPorIa).toBe(true);
    expect(citacaoDaLei(p)).toBe("GDPR art. 15 (Regulation (EU) 2016/679)");
    expect(p.papel).toEqual(perfilDoPais("PT").papel);
    expect(p.autoridadeDeSupervisao?.site).toBe("https://www.gegevensbeschermingsautoriteit.be");
  });

  it.each([
    "0123456749",
    "0123.456.749",
    "BE0123456749",
    "be 0123.456.749",
    "0403.170.701",
    "1000000021",
    "0009700097",
  ])("KBO válido: %s", (v) => expect(isValidKbo(v)).toBe(true));

  it.each(["0123456748", "2123456749", "012345674", "52998224725", "0000000000", "", "abc"])(
    "KBO inválido: %s",
    (v) => expect(isValidKbo(v)).toBe(false),
  );

  it("o exemplo passa na própria validação e a normalização guarda só dígitos", () => {
    const d = perfilDoPais("BE").documento;
    expect(d.confereDigito).toBe(true);
    expect(d.valida(d.exemplo)).toBe(true);
    expect(d.normaliza("BE 0123.456.749")).toBe("0123456749");
  });

  it("a planilha reconhece os cabeçalhos da Bélgica", () => {
    const d = perfilDoPais("BE").documento;
    for (const c of ["KBO", "BCE", "Ondernemingsnummer", "BTW-nummer", "TVA", "İşletme numarası"]) {
      expect(mapHeader(["Telefone", c], undefined, d).indices.cpf).toBe(1);
    }
  });

  it("os dez feriados de 2026", () => {
    expect([...feriadosDaBelgicaDoAno(2026)].sort()).toEqual([
      "2026-01-01",
      "2026-04-06",
      "2026-05-01",
      "2026-05-14",
      "2026-05-25",
      "2026-07-21",
      "2026-08-15",
      "2026-11-01",
      "2026-11-11",
      "2026-12-25",
    ]);
    expect(ULTIMO_ANO_COBERTO).toBeGreaterThanOrEqual(new Date().getFullYear() + 2);
    expect(perfilDoPais("BE").calendario.feriados).toBe(HOLIDAYS_BE_ISO);
  });
});
