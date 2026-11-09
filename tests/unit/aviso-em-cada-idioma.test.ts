import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import { emCadaIdioma, noIdiomaDaOrgSql } from "@/lib/i18n/em-cada-idioma";
import { IDIOMA_PADRAO, IDIOMAS } from "@/lib/i18n/idiomas";

/**
 * O AVISO QUE O SQL GRAVA NO MESMO STATEMENT QUE DECIDE GRAVÁ-LO.
 *
 * Alguns avisos da Central nascem dentro de um único statement (o job que morre
 * e o alerta dele, atômicos). Ali não há onde ler o idioma antes: a empresa só é
 * conhecida dentro do SQL. O texto vai então em todo idioma visível, num jsonb,
 * e o SQL escolhe pelo `organizations.locale` da própria linha — o mesmo
 * resultado de `normalizarIdioma` (código exato, senão o padrão).
 */
describe("o texto em cada idioma, para o SQL escolher", () => {
  it("tem todo idioma visível, e cada um é o `traduzir` daquele idioma", () => {
    const textos = emCadaIdioma((idioma) => traduzir("Salvar", idioma));
    expect(Object.keys(textos).sort()).toEqual([...IDIOMAS].sort());
    for (const idioma of IDIOMAS) expect(textos[idioma]).toBe(traduzir("Salvar", idioma));
    expect(textos[IDIOMA_PADRAO]).toBe("Salvar");
  });

  it("o SQL escolhe pelo locale da empresa e cai no padrão quando ele não está lá", () => {
    expect(noIdiomaDaOrgSql("$5", "o.locale")).toBe(`coalesce($5::jsonb ->> o.locale, $5::jsonb ->> '${IDIOMA_PADRAO}')`);
  });
});
