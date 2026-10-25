import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O FUNIL PADRAO DE UMA EMPRESA NOVA NASCE COM O VOCABULARIO DO IDIOMA (F2).
 *
 * O gatilho do banco semeia o funil sem `vocabulary` e o default da coluna e
 * portugues. O onboarding renomeia o funil e as etapas; agora tambem escreve o
 * vocabulario do idioma da empresa. Nada muda no banco nem nas empresas que
 * ja existem: so o passo de onboarding de uma empresa nova.
 */
const { rpcMock, updates, estado } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  updates: [] as { tabela: string; valores: unknown; filtros: Record<string, unknown> }[],
  estado: { locale: "pt-BR" as string, vocabularioAtual: null as unknown },
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/ai/runtime/agent", () => ({ buildModel: vi.fn(), chaveDePlataforma: vi.fn() }));
vi.mock("@/lib/ai/credentials", () => ({ loadCredential: vi.fn() }));
vi.mock("@/app/actions/onboarding/_shared", () => ({
  requireOnboardingCtx: async () => ({ orgId: "org-1", userId: "u1" }),
  patchOnboardingState: vi.fn(),
  loadOnboardingState: vi.fn(),
  OnboardingError: class extends Error {},
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: (tabela: string) => {
      const filtros: Record<string, unknown> = {};
      let valores: unknown;
      let modo: "select" | "update" = "select";
      const q: Record<string, unknown> = {
        select: () => q,
        update: (v: unknown) => {
          modo = "update";
          valores = v;
          return q;
        },
        eq: (c: string, v: unknown) => {
          filtros[c] = v;
          return q;
        },
        neq: () => q,
        order: () => q,
        maybeSingle: async () => {
          if (tabela === "organizations") return { data: { locale: estado.locale }, error: null };
          if (tabela === "crm_pipelines") {
            return {
              data: { id: "p1", name: "Funil", slug: "funil", vocabulary: estado.vocabularioAtual },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (modo === "update") updates.push({ tabela, valores, filtros });
          const data = tabela === "crm_stages" ? [{ name: "A", position: 0 }] : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return q;
    },
  }),
}));

import { aplicarQuadro } from "@/app/actions/onboarding/montarQuadro";
import { vocabularioDoFunilPadrao } from "@/lib/pipelines/vocabulario-padrao";

function formulario(): FormData {
  const f = new FormData();
  f.set(
    "quadro",
    JSON.stringify({
      nome: "Pedidos",
      etapas: [
        { nome: "Novo", passo: "new" },
        { nome: "Conversando", passo: "contacted" },
        { nome: "Ganho", passo: "won" },
        { nome: "Perdido", passo: "lost" },
      ],
    }),
  );
  return f;
}

async function aplicar() {
  try {
    await aplicarQuadro(formulario());
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "NEXT_REDIRECT") throw e;
  }
}

beforeEach(() => {
  updates.length = 0;
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
  estado.locale = "pt-BR";
  estado.vocabularioAtual = null;
});

describe("aplicarQuadro grava o vocabulario do idioma da empresa", () => {
  it("tr: o funil padrao recebe o vocabulario turco", async () => {
    estado.locale = "tr";
    await aplicar();
    const u = updates.find((x) => x.tabela === "crm_pipelines");
    expect(u?.valores).toEqual({ vocabulary: vocabularioDoFunilPadrao("tr") });
    expect(u?.filtros).toMatchObject({ id: "p1", organization_id: "org-1" });
  });

  it("pt-BR: o vocabulario escrito e exatamente o default de hoje", async () => {
    await aplicar();
    const u = updates.find((x) => x.tabela === "crm_pipelines");
    expect(u?.valores).toEqual({
      vocabulary: {
        lead: "Cliente",
        lead_plural: "Clientes",
        deal: "Pedido",
        deal_plural: "Pedidos",
        won: "Pago",
        lost: "Cancelado",
        stage: "Etapa",
        stage_plural: "Etapas",
      },
    });
  });

  it("vocabulario ja personalizado nao e sobrescrito", async () => {
    estado.locale = "tr";
    estado.vocabularioAtual = { ...vocabularioDoFunilPadrao("pt-BR"), lead: "Paciente" };
    await aplicar();
    expect(updates.find((x) => x.tabela === "crm_pipelines")).toBeUndefined();
  });

  it("recusa do banco: nada e escrito", async () => {
    estado.locale = "tr";
    rpcMock.mockResolvedValue({ data: { ok: false, motivo: "funil_com_negocios", quantos: 2 }, error: null });
    await aplicar();
    expect(updates).toHaveLength(0);
  });
});
