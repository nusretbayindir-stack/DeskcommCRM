import { describe, expect, it } from "vitest";

import { IDIOMAS, parseAcceptLanguage } from "@/lib/i18n/idiomas";
import { REGISTRO_DE_IDIOMAS } from "@/lib/i18n/registro";

/**
 * O NEERLANDÊS E O FRANCÊS DA BÉLGICA ENTRAM NO REGISTRO SEM APARECER.
 *
 * O fork vende para empresas na Bélgica (Flandres e Bruxelas). Os dois idiomas
 * entram no registro como `em_construcao`: o catálogo pode ser traduzido e
 * medido sem que ninguém escolha uma língua que ainda não foi lida. A tag é a
 * da Bélgica (`nl-BE`, `fr-BE`): data, número e moeda saem como lá ("€ 1.500,00"),
 * e não como na Holanda ou na França.
 *
 * Promover um deles é outra decisão (doc S2a, D11: língua cuja leitura não
 * acabou não é vendida), e este teste muda junto com ela.
 */
const ESPERADO = {
  nl: { nomeNativo: "Nederlands", rotuloCurto: "NL", tagBcp47: "nl-BE", subtagsDoNavegador: ["nl"] },
  fr: { nomeNativo: "Français", rotuloCurto: "FR", tagBcp47: "fr-BE", subtagsDoNavegador: ["fr"] },
} as const;

const indiceDe = (codigo: string) => REGISTRO_DE_IDIOMAS.findIndex((idioma) => idioma.codigo === codigo);

describe("os idiomas da Bélgica no registro", () => {
  it.each(Object.entries(ESPERADO))("%s: nome, rótulo, tag e subtag da Bélgica, em construção", (codigo, esperado) => {
    const idioma = REGISTRO_DE_IDIOMAS.find((candidato) => candidato.codigo === codigo);
    expect(idioma).toMatchObject({
      ...esperado,
      nivel: "em_construcao",
      mantenedor: "Agenterix (@nusretbayindir-stack)",
    });
  });

  it("vêm logo depois do turco, o neerlandês primeiro", () => {
    expect(indiceDe("tr")).toBeGreaterThanOrEqual(0);
    expect(indiceDe("nl")).toBe(indiceDe("tr") + 1);
    expect(indiceDe("fr")).toBe(indiceDe("tr") + 2);
  });
});

describe("em construção, eles ainda não chegam a ninguém", () => {
  it("a lista servida não tem nl nem fr", () => {
    expect(IDIOMAS).not.toContain("nl");
    expect(IDIOMAS).not.toContain("fr");
  });

  it("um navegador belga não escolhe nl nem fr", () => {
    expect(parseAcceptLanguage("nl-BE,nl;q=0.9")).toBeNull();
    expect(parseAcceptLanguage("fr-BE,fr;q=0.9")).toBeNull();
  });
});
