/**
 * O idioma do contato numa ida só ao banco — e nunca uma exceção (S2a, Task 9).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { idiomaDoContatoPeloPg, idiomaDoContatoPeloSupabase } from "@/lib/contacts/idioma-do-contato";

function supabaseQueDevolve(resposta: unknown, filtros: Array<[string, string]> = []) {
  const consulta = {
    eq(coluna: string, valor: string) {
      filtros.push([coluna, valor]);
      return consulta;
    },
    maybeSingle: async () => resposta,
  };
  return { from: () => ({ select: () => consulta }) };
}

describe("idiomaDoContatoPeloPg", () => {
  it("o idioma do contato vence o da empresa; a consulta leva organização e contato", async () => {
    const query = vi.fn(async () => ({ rows: [{ contato: "fr", org: "nl" }] }));
    expect(await idiomaDoContatoPeloPg({ query } as never, "org-1", "contato-1")).toBe("fr");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("organization_id"), ["org-1", "contato-1"]);
  });

  it("contato sem idioma servido: o da empresa", async () => {
    const query = vi.fn(async () => ({ rows: [{ contato: "en", org: "nl" }] }));
    expect(await idiomaDoContatoPeloPg({ query } as never, "org-1", "contato-1")).toBe("nl");
  });

  it("a leitura lança: o padrão do produto, sem exceção", async () => {
    const query = vi.fn(async () => {
      throw new Error("conexão caiu");
    });
    await expect(idiomaDoContatoPeloPg({ query } as never, "org-1", "contato-1")).resolves.toBe("pt-BR");
  });
});

describe("idiomaDoContatoPeloSupabase", () => {
  it("o idioma do contato, filtrado pela organização e pelo contato", async () => {
    const filtros: Array<[string, string]> = [];
    const admin = supabaseQueDevolve({ data: { locale: "nl", contacts: [{ locale: "fr" }] }, error: null }, filtros);
    expect(await idiomaDoContatoPeloSupabase(admin, "org-1", "contato-1")).toBe("fr");
    expect(filtros).toEqual([
      ["id", "org-1"],
      ["contacts.id", "contato-1"],
    ]);
  });

  it("contato não achado: o da empresa", async () => {
    const admin = supabaseQueDevolve({ data: { locale: "tr", contacts: [] }, error: null });
    expect(await idiomaDoContatoPeloSupabase(admin, "org-1", "contato-1")).toBe("tr");
  });

  it("erro na leitura: o padrão do produto, sem exceção", async () => {
    const admin = supabaseQueDevolve({ data: null, error: { message: "falhou" } });
    expect(await idiomaDoContatoPeloSupabase(admin, "org-1", "contato-1")).toBe("pt-BR");
    const quebrado = {
      from: () => {
        throw new Error("cliente quebrado");
      },
    };
    await expect(idiomaDoContatoPeloSupabase(quebrado, "org-1", "contato-1")).resolves.toBe("pt-BR");
  });
});
