/**
 * A língua da mensagem fixa ao cliente: a dele, se o produto a serve; senão a
 * da empresa — nunca o português por acidente (S2a, Task 9; D4).
 */
import { describe, expect, it } from "vitest";

import { idiomaDoDestinatario } from "@/lib/i18n/idioma-do-destinatario";

describe("idiomaDoDestinatario", () => {
  it("o idioma do contato vence o da empresa", () => {
    expect(idiomaDoDestinatario("fr", "nl")).toBe("fr");
  });

  it("sem idioma do contato, vale o da empresa", () => {
    expect(idiomaDoDestinatario(null, "nl")).toBe("nl");
  });

  it("idioma do contato que o produto não serve cai no da empresa, não no português", () => {
    expect(idiomaDoDestinatario("en", "nl")).toBe("nl");
    expect(idiomaDoDestinatario("pt-PT", "tr")).toBe("tr");
  });

  it("sem nenhum dos dois, o padrão do produto", () => {
    expect(idiomaDoDestinatario(null, null)).toBe("pt-BR");
  });
});
