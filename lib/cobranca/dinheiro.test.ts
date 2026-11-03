import { describe, expect, it } from "vitest";

import { formatarDinheiro } from "./dinheiro";

/** O Intl usa espaço inseparável entre símbolo e valor: compara-se com espaço comum. */
const limpo = (s: string) => s.replace(/\s/g, " ");

describe("formatarDinheiro: o valor na moeda do plano", () => {
  it("euro em nl-BE", () => expect(limpo(formatarDinheiro(7900, "EUR", "nl-BE"))).toBe("€ 79,00"));
  it("real em pt-BR (o de hoje)", () => expect(limpo(formatarDinheiro(4990, "BRL", "pt-BR"))).toBe("R$ 49,90"));
  it("euro na tela em português", () => expect(limpo(formatarDinheiro(29900, "EUR", "pt-BR"))).toBe("€ 299,00"));
});
