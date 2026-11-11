import { format } from "date-fns";
import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import { localeDeData, tagDeIdioma } from "@/lib/i18n/datas";
import { IDIOMAS, normalizarIdioma, parseAcceptLanguage, type Idioma } from "@/lib/i18n/idiomas";

/**
 * O NEERLANDÊS E O FRANCÊS DA BÉLGICA SÃO SERVIDOS PELO CATÁLOGO.
 *
 * A mesma régua de `i18n-catalogo-turco-e-servido`, para os dois idiomas que o
 * fork vende na Bélgica. Promovidos no registro (doc S2a, Task 7), eles
 * aparecem nas listas, um navegador belga cai neles, o texto vem de
 * `lib/i18n/traducoes/<codigo>.json` e a data sai como na Bélgica.
 */
const CASOS = [
  {
    codigo: "nl",
    navegador: "nl-BE,nl;q=0.9,en;q=0.8",
    planoAtual: "Huidig plan",
    tag: "nl-BE",
    segunda19DeOutubro: "maandag 19 oktober",
  },
  {
    codigo: "fr",
    navegador: "fr-BE,fr;q=0.9",
    planoAtual: "Formule actuelle",
    tag: "fr-BE",
    segunda19DeOutubro: "lundi 19 octobre",
  },
] as const;

describe.each(CASOS)("o idioma $codigo é servido", (caso) => {
  const idioma = caso.codigo as Idioma;

  it("é um idioma visível e normaliza para ele mesmo", () => {
    expect(IDIOMAS).toContain(caso.codigo);
    expect(normalizarIdioma(caso.codigo)).toBe(caso.codigo);
  });

  it("um navegador da Bélgica cai nele", () => {
    expect(parseAcceptLanguage(caso.navegador)).toBe(caso.codigo);
  });

  it("traduz pela entrada do catálogo e degrada para o português", () => {
    expect(traduzir("Plano atual", idioma)).toBe(caso.planoAtual);
    expect(traduzir("frase que não existe em catálogo nenhum", idioma)).toBe("frase que não existe em catálogo nenhum");
  });

  it("a etiqueta BCP-47 é a da Bélgica", () => {
    expect(tagDeIdioma(idioma)).toBe(caso.tag);
  });

  it("a data sai no idioma, e não em português nem em inglês", () => {
    expect(format(new Date(2026, 9, 19), "EEEE d MMMM", { locale: localeDeData(idioma) })).toBe(
      caso.segunda19DeOutubro,
    );
  });
});
