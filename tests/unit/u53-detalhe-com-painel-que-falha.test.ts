// @vitest-environment node
/**
 * U53: o painel é apoio. Se a montagem dele lançar, o detalhe do pedido ainda
 * responde 200, com o painel neutro, e o log leva só códigos e ids.
 */
import { describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: async () => ({ ok: true, user: { idioma: "pt-BR" }, org: { orgId: ORG } }),
}));
vi.mock("@/lib/lgpd/painel-do-pedido", async (original) => ({
  ...(await original<typeof import("@/lib/lgpd/painel-do-pedido")>()),
  painelDoPedido: async () => {
    throw new Error("falha com dado@loja.test");
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        or: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({
          data: { id: "p1", organization_id: ORG, request_type: "data_request", status: "received", contact_id: null, request_payload: {}, result: null },
          error: null,
        }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
      };
      return q;
    },
  }),
}));

import { GET } from "@/app/api/v1/lgpd/requests/[id]/route";
import { logger } from "@/lib/logger";
import { painelNeutro } from "@/lib/lgpd/painel-do-pedido";

describe("detalhe do pedido com o painel falhando", () => {
  it("responde 200 com o painel neutro e loga só código e ids", async () => {
    const res = await GET({} as never, { params: Promise.resolve({ id: "p1" }) });

    expect(res.status).toBe(200);
    expect((await res.json()).data.painel).toEqual(painelNeutro());
    const logs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logs).toContain("painel_failed");
    expect(logs).not.toContain("dado@loja.test");
  });
});
