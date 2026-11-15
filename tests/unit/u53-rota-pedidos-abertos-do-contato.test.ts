// @vitest-environment node
/**
 * U53: `GET /api/v1/lgpd/contacts/[contactId]/open-requests` — o que o cartão da
 * página do contato lê. Devolve só tipo, situação e prazo dos pedidos abertos e
 * dois booleanos de canal; nunca e-mail, telefone ou o payload do pedido.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CONTATO = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";

const h = vi.hoisted(() => {
  const estado = {
    role: "agent" as "viewer" | "agent",
    contato: null as Record<string, unknown> | null,
    pedidos: [] as Array<Record<string, unknown>>,
    filtros: [] as Array<[string, string, unknown]>,
  };
  const requireRole = vi.fn();
  function admin() {
    return {
      from(tabela: string) {
        const cadeia: Record<string, unknown> = {
          select: () => cadeia,
          eq: (col: string, val: unknown) => {
            estado.filtros.push([tabela, col, val]);
            return cadeia;
          },
          in: () => cadeia,
          order: () => cadeia,
          maybeSingle: async () => ({ data: estado.contato, error: null }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve({ data: estado.pedidos, error: null }).then(res, rej),
        };
        return cadeia;
      },
    };
  }
  return { estado, requireRole, admin };
});

vi.mock("@/lib/auth/require-role", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin() }));

import { GET } from "@/app/api/v1/lgpd/contacts/[contactId]/open-requests/route";

async function ler() {
  const res = await GET(
    new NextRequest(`http://localhost/api/v1/lgpd/contacts/${CONTATO}/open-requests`),
    { params: Promise.resolve({ contactId: CONTATO }) },
  );
  return { res, texto: await res.text() };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.estado.role = "agent";
  h.estado.filtros.length = 0;
  h.estado.contato = {
    id: CONTATO,
    email: null,
    phone_number: "+32000000000",
    wa_lid: "lid-fake-1",
  };
  h.estado.pedidos = [
    {
      request_type: "data_request",
      status: "received",
      due_at: "2026-11-24T00:00:00.000Z",
      request_payload: { delivery: { address: "ana@loja.test" } },
    },
  ];
  h.requireRole.mockImplementation(async () => {
    if (h.estado.role === "viewer") {
      return { ok: false, response: new Response("{}", { status: 403 }) };
    }
    return { ok: true, user: { id: "u1", idioma: "pt-BR" }, org: { orgId: "org-1", role: "agent" } };
  });
});

describe("GET /api/v1/lgpd/contacts/[contactId]/open-requests (U53)", () => {
  it("viewer 403; agent 200 com permiteOrgSuspensa", async () => {
    h.estado.role = "viewer";
    expect((await ler()).res.status).toBe(403);
    h.estado.role = "agent";
    expect((await ler()).res.status).toBe(200);
    expect(h.requireRole).toHaveBeenLastCalledWith(
      "agent",
      expect.objectContaining({
        permiteOrgSuspensa: true,
        resource: "lgpd_requests",
        allowPlatformAdmin: "leitura",
      }),
    );
  });

  it("devolve só tipo, situação e prazo dos pedidos abertos", async () => {
    const { texto } = await ler();
    const body = JSON.parse(texto);
    expect(body.data.pedidos).toEqual([
      { request_type: "data_request", status: "received", due_at: "2026-11-24T00:00:00.000Z" },
    ]);
    expect(texto).not.toMatch(/@loja\.test|\+32|wa_lid|request_payload/);
    expect(h.estado.filtros).toContainEqual(["lgpd_requests", "organization_id", "org-1"]);
  });

  it("canais em booleanos", async () => {
    const body = JSON.parse((await ler()).texto);
    expect(body.data.canais).toEqual({ whatsapp: true, email: false });
  });

  it("contato de outra org é 404", async () => {
    h.estado.contato = null;
    const { res } = await ler();
    expect(res.status).toBe(404);
    expect(h.estado.filtros).toContainEqual(["contacts", "organization_id", "org-1"]);
  });
});
