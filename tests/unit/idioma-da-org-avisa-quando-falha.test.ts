import { afterEach, describe, expect, it, vi } from "vitest";

import { idiomaDaOrgPeloPg, idiomaDaOrgPeloSupabase } from "@/lib/ai/agents/idioma-da-org";

/**
 * A leitura do idioma da empresa nunca lanca e cai no idioma do produto, mas
 * uma falha NAO pode passar em silencio: uma linha de aviso no log diz por que
 * o agente nasceu em portugues.
 */
afterEach(() => vi.restoreAllMocks());

function supabaseCom(resultado: () => Promise<unknown>) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: resultado }) }) }),
  };
}

describe("idiomaDaOrg avisa quando a leitura falha", () => {
  it("supabase com error: cai no padrao e registra um aviso", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const idioma = await idiomaDaOrgPeloSupabase(
      supabaseCom(async () => ({ data: null, error: { message: "permission denied" } })),
      "org-1",
    );
    expect(idioma).toBe("pt-BR");
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String(aviso.mock.calls[0]?.join(" "))).toContain("permission denied");
  });

  it("supabase que lanca: cai no padrao e registra um aviso", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const idioma = await idiomaDaOrgPeloSupabase(
      supabaseCom(async () => {
        throw new Error("rede caiu");
      }),
      "org-1",
    );
    expect(idioma).toBe("pt-BR");
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("pg que lanca: cai no padrao e registra um aviso", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const idioma = await idiomaDaOrgPeloPg(
      { query: vi.fn().mockRejectedValue(new Error("tx abortada")) } as never,
      "org-1",
    );
    expect(idioma).toBe("pt-BR");
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("leitura boa: nenhum aviso", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const idioma = await idiomaDaOrgPeloSupabase(
      supabaseCom(async () => ({ data: { locale: "tr" }, error: null })),
      "org-1",
    );
    expect(idioma).toBe("tr");
    expect(aviso).not.toHaveBeenCalled();
  });
});
