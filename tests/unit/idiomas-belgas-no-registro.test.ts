import { describe, expect, it } from "vitest";

import { REGISTRO_DE_IDIOMAS } from "@/lib/i18n/registro";

/**
 * O NEERLANDÊS E O FRANCÊS DA BÉLGICA NO REGISTRO.
 *
 * O fork vende para empresas na Bélgica (Flandres e Bruxelas). Os dois idiomas
 * entraram no registro como `em_construcao` (Task 4 do doc S2a): o catálogo foi
 * traduzido e medido sem que ninguém escolhesse uma língua ainda não lida. Com
 * os catálogos completos, a Task 7 os promove a `completo`: aparecem nas
 * listas, e toda frase de tela passa a precisar deles. A tag é a da Bélgica
 * (`nl-BE`, `fr-BE`): a data sai como lá, e não como na Holanda ou na França.
 *
 * Que eles chegam a quem usa (lista, navegador, catálogo, data) é a régua de
 * `i18n-catalogos-belgas-sao-servidos`. Vender um deles a cliente continua
 * sendo outra decisão (doc S2a, D11: língua cuja leitura não acabou não é
 * vendida).
 */
const ESPERADO = {
  nl: { nomeNativo: "Nederlands", rotuloCurto: "NL", tagBcp47: "nl-BE", subtagsDoNavegador: ["nl"] },
  fr: { nomeNativo: "Français", rotuloCurto: "FR", tagBcp47: "fr-BE", subtagsDoNavegador: ["fr"] },
} as const;

const indiceDe = (codigo: string) => REGISTRO_DE_IDIOMAS.findIndex((idioma) => idioma.codigo === codigo);

describe("os idiomas da Bélgica no registro", () => {
  it.each(Object.entries(ESPERADO))("%s: nome, rótulo, tag e subtag da Bélgica, completo", (codigo, esperado) => {
    const idioma = REGISTRO_DE_IDIOMAS.find((candidato) => candidato.codigo === codigo);
    expect(idioma).toMatchObject({
      ...esperado,
      nivel: "completo",
      mantenedor: "Agenterix (@nusretbayindir-stack)",
    });
  });

  it("vêm logo depois do turco, o neerlandês primeiro", () => {
    expect(indiceDe("tr")).toBeGreaterThanOrEqual(0);
    expect(indiceDe("nl")).toBe(indiceDe("tr") + 1);
    expect(indiceDe("fr")).toBe(indiceDe("tr") + 2);
  });
});
