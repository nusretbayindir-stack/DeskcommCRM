import { describe, expect, it } from "vitest";

import { IDIOMA_PADRAO, idiomaDelNavegador } from "@/lib/i18n/idiomas";

describe("idiomaDelNavegador", () => {
  it("variantes regionais do espanhol viram es", () => {
    expect(idiomaDelNavegador(["es-MX", "es", "en"])).toBe("es");
    expect(idiomaDelNavegador(["es-419"])).toBe("es");
  });

  it("mantém português do Brasil", () => {
    expect(idiomaDelNavegador(["pt-BR", "pt", "en"])).toBe("pt-BR");
  });

  it("usa o primeiro idioma servido na ordem do navegador", () => {
    expect(idiomaDelNavegador(["en-US", "es-AR"])).toBe("es");
  });

  it("cai no padrão sem idioma servido ou com lista vazia", () => {
    // O francês virou idioma servido (doc S2a, Task 7); alemão e italiano seguem fora.
    expect(idiomaDelNavegador(["de-DE", "it"])).toBe(IDIOMA_PADRAO);
    expect(idiomaDelNavegador([])).toBe(IDIOMA_PADRAO);
  });
});
