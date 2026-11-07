import { describe, expect, it } from "vitest";
import { traduzirErrosDeCampo } from "@/lib/api/erros-de-campo";

describe("traduzirErrosDeCampo — o erro de campo da API segue o idioma do usuário", () => {
  const details = { fieldErrors: { cpf: ["Número KBO/BCE inválido"], email: ["texto que o catálogo não conhece"] } };

  it("traduz a mensagem do documento para o turco", () => {
    const out = traduzirErrosDeCampo(details, "tr") as { fieldErrors: Record<string, string[]> };
    expect(out.fieldErrors.cpf).toEqual(["Geçersiz KBO/BCE numarası"]);
  });

  it("o que o catálogo não conhece degrada para o texto original", () => {
    const out = traduzirErrosDeCampo(details, "tr") as { fieldErrors: Record<string, string[]> };
    expect(out.fieldErrors.email).toEqual(["texto que o catálogo não conhece"]);
  });

  it("em português devolve igual, e detalhes sem fieldErrors passam intactos", () => {
    expect(traduzirErrosDeCampo(details, "pt-BR")).toEqual(details);
    expect(traduzirErrosDeCampo(undefined, "tr")).toBeUndefined();
    expect(traduzirErrosDeCampo({ outro: 1 }, "tr")).toEqual({ outro: 1 });
  });
});
