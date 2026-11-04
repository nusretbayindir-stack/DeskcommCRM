// @vitest-environment node
import { describe, expect, it } from "vitest";

import { anonymize, padroesDaIngestao, padroesDePii } from "@/lib/ai/anonymize";
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

  describe("máscara", () => {
    const padroes = () => padroesDePii([perfilDoPais("BE")]);

    it("declara os padrões na ordem", () => {
      expect(padroes().map((p) => p.tipo)).toEqual([
        "telefoneInternacionalBE",
        "ibanBE",
        "rijksregister",
        "kbo",
        "telefoneBE",
        "email",
        "phone",
      ]);
    });

    it("cada padrão próprio declara o que não cobre", () => {
      for (const p of perfilDoPais("BE").padroesDePii) {
        expect(p.naoCobre.length, p.tipo).toBeGreaterThan(0);
      }
    });

    it.each([
      ["IBAN BE68 5390 0754 7034", "IBAN [IBAN]"],
      ["IBAN BE68539007547034", "IBAN [IBAN]"],
      ["nr 85.07.30-033.28", "nr [RIJKSREGISTER]"],
      ["nr 85073003328", "nr [RIJKSREGISTER]"],
      ["btw BE0123456749", "btw [KBO]"],
      ["btw BE 0123.456.749", "btw [KBO]"],
      ["kbo 0403.170.701", "kbo [KBO]"],
      ["zap +32 470 12 34 56", "zap [TELEFONE]"],
      ["zap +32470123456", "zap [TELEFONE]"],
      ["zap 0470 12 34 56", "zap [TELEFONE]"],
      ["zap 0470/12.34.56", "zap [TELEFONE]"],
      ["vast 02 123 45 67", "vast [TELEFONE]"],
    ])("mascara %s", (entrada, saida) =>
      expect(anonymize(entrada, padroes()).anonymized).toBe(saida),
    );

    it("data, hora, ano, preço e código postal continuam legíveis", () => {
      for (const t of [
        "Afspraak op 04/11/2026 10:30",
        "op 04.11.2026 14:30",
        "postcode 1000",
        "jaar 2026",
        "prijs 1.250,00",
      ]) {
        expect(anonymize(t, padroes()).anonymized).toBe(t);
      }
    });

    it("o CPF por baixo não perde os dígitos finais", () => {
      const r = anonymize("cpf 012.345.678-90", padroesDaIngestao(perfilDoPais("BE")));
      expect(r.anonymized).toBe("cpf [CPF]");
    });
  });
});
