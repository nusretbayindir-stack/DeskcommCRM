import { describe, expect, it } from "vitest";

import { novoPlanoSchema } from "./cobranca-plano";

/**
 * O plano em euro (S4): IVA, implantação e cota de respostas só existem no
 * plano em EUR; o plano em BRL segue com o corpo de hoje (moeda default BRL).
 */
describe("novoPlanoSchema: moeda, IVA, implantação e cota", () => {
  const base = { nome: "Start", preco_cents: 7900, intervalo: "mes", trial_dias: 0 };

  it("moeda ausente vira BRL e iva 0", () =>
    expect(novoPlanoSchema.parse(base)).toMatchObject({ moeda: "BRL", iva_percentual: 0 }));

  it("⭐ plano em euro com IVA, implantação e cota", () =>
    expect(
      novoPlanoSchema.safeParse({ ...base, moeda: "EUR", iva_percentual: 21, implantacao_cents: 29900, respostas_mes: 300 })
        .success,
    ).toBe(true));

  it.each([
    ["IVA em BRL", { ...base, iva_percentual: 21 }],
    ["implantação em BRL", { ...base, implantacao_cents: 29900 }],
    ["moeda USD", { ...base, moeda: "USD" }],
    ["IVA acima de 100", { ...base, moeda: "EUR", iva_percentual: 101 }],
    ["IVA com 3 casas", { ...base, moeda: "EUR", iva_percentual: 21.005 }],
    ["implantação abaixo de 500", { ...base, moeda: "EUR", implantacao_cents: 499 }],
    ["cota zero", { ...base, moeda: "EUR", respostas_mes: 0 }],
  ])("recusa %s", (_n, corpo) => expect(novoPlanoSchema.safeParse(corpo).success).toBe(false));
});
