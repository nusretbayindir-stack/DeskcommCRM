/**
 * A LIRA TURCA (`TRY`) é servida, para quem vende na Turquia.
 *
 * O formato vem da MOEDA, e não do idioma da tela: uma empresa que opera em
 * espanhol e cobra em lira vê `₺12.345,50`, igual a quem opera em turco.
 */
import { describe, expect, it } from "vitest";

import { formatCents, MOEDA_PADRAO, MOEDAS_SERVIDAS, moedaServidaOu } from "@/lib/money";

describe("lira turca", () => {
  it("está entre as moedas servidas", () => {
    expect(MOEDAS_SERVIDAS).toContain("TRY");
  });

  it("uma organização em TRY continua em TRY", () => {
    expect(moedaServidaOu("TRY")).toBe("TRY");
  });

  it("formata como na Turquia, com o símbolo ₺", () => {
    expect(formatCents(1234550, "TRY")).toBe("₺12.345,50");
  });

  it("não muda o padrão de quem não escolheu", () => {
    expect(MOEDA_PADRAO).toBe("BRL");
  });
});
