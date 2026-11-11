import { describe, expect, it } from "vitest";

import { formatCents, parseReaisToCents } from "@/lib/money";

/**
 * O EURO SAI COMO NA BÉLGICA.
 *
 * O fork vende na Bélgica (doc S2a §5.1). Antes, a única convenção da zona euro
 * era a de Portugal (`pt-PT`: `1500,00 €`, milhar por espaço e só a partir de
 * cinco dígitos). O cliente belga lê `€ 1.500,00`: símbolo antes, ponto no
 * milhar, vírgula nos centavos — a convenção `nl-BE`, a mesma que o painel em
 * francês mostra (a leitora pode pedir `1 500,00 €`; aí é parâmetro de idioma,
 * outro trabalho).
 *
 * O espaço entre o símbolo e o número é o inseparável do `Intl`; a régua o
 * normaliza para comparar texto.
 */
const semEspacoInseparavel = (texto: string) => texto.replace(/[  ]/g, " ");

describe("o euro na convenção belga", () => {
  it("mil e quinhentos euros: símbolo antes, ponto no milhar, vírgula nos centavos", () => {
    expect(semEspacoInseparavel(formatCents(150000, "EUR"))).toBe("€ 1.500,00");
  });

  it("valor pequeno e valor grande seguem a mesma convenção", () => {
    expect(semEspacoInseparavel(formatCents(4990, "EUR"))).toBe("€ 49,90");
    expect(semEspacoInseparavel(formatCents(123456789, "EUR"))).toBe("€ 1.234.567,89");
  });

  it("o que a tela escreve, a digitação lê de volta (ponto é milhar, vírgula é centavo)", () => {
    expect(parseReaisToCents("1.500,00", "EUR")).toBe(150000);
    expect(parseReaisToCents("49,90", "EUR")).toBe(4990);
  });

  it("as outras moedas não mudam", () => {
    expect(semEspacoInseparavel(formatCents(150000, "BRL"))).toBe("R$ 1.500,00");
    expect(semEspacoInseparavel(formatCents(150000, "USD"))).toBe("$1,500.00");
  });
});
