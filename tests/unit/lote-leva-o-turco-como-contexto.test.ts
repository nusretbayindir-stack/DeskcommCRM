import { describe, expect, it } from "vitest";

import { contextoDaFrase } from "../../scripts/i18n/contexto-do-lote";

/**
 * O LOTE DE TRADUÇÃO LEVA O TURCO COMO CONTEXTO, menos para quem traduz o turco.
 *
 * O catálogo turco foi lido frase a frase pelo dono (glossário, ajustes da
 * revisão). Quem traduz o neerlandês e o francês ganha esse trabalho como
 * contexto ao lado do espanhol e do inglês — a frase portuguesa sozinha é
 * ambígua mais vezes do que parece ("Ligar": ligar o quê?).
 */
const fontes = {
  dicionario: { Salvar: { es: "Guardar" }, Ligar: { es: "Activar" } },
  ingles: { Salvar: "Save" },
  turco: { Salvar: "Kaydet", Ligar: "Aç" },
};

describe("o contexto de cada frase do lote", () => {
  it("quem traduz o neerlandês recebe o espanhol, o inglês e o turco", () => {
    expect(contextoDaFrase("Salvar", "nl", fontes)).toEqual({ es: "Guardar", en: "Save", tr: "Kaydet" });
  });

  it("quem traduz o turco não recebe o turco", () => {
    expect(contextoDaFrase("Salvar", "tr", fontes)).not.toHaveProperty("tr");
    expect(contextoDaFrase("Salvar", "tr", fontes)).toEqual({ es: "Guardar", en: "Save" });
  });

  it("o que falta numa fonte some do lote, e não vira campo vazio", () => {
    expect(JSON.stringify(contextoDaFrase("Ligar", "fr", fontes))).toBe('{"es":"Activar","tr":"Aç"}');
    expect(JSON.stringify(contextoDaFrase("Só em português", "fr", fontes))).toBe("{}");
  });
});
