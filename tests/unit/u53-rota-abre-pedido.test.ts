// @vitest-environment node
/**
 * U53: `POST /api/v1/lgpd/requests` abre o pedido do titular pela tela.
 *
 * A rota REAL com dublês de banco, de papel e do repositório. O que se prova:
 * a ordem das travas (papel, sessão de suporte, corpo, data, contato, canal,
 * pedido aberto), o que vai para o `request_payload`, e que a trilha de
 * auditoria nunca leva nota, e-mail ou telefone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CONTATO = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";

const h = vi.hoisted(() => {
  const estado = {
    role: "admin" as "viewer" | "agent" | "admin",
    contato: null as Record<string, unknown> | null,
    aberto: null as Record<string, unknown> | null,
    filtros: [] as Array<[string, string, unknown]>,
  };
  const criar = vi.fn();
  const audit = vi.fn();
  const avisar = vi.fn();
  const rpc = vi.fn();
  const suporte = vi.fn();
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
          limit: () => cadeia,
          maybeSingle: async () => ({
            data: tabela === "contacts" ? estado.contato : estado.aberto,
            error: null,
          }),
        };
        return cadeia;
      },
      rpc,
    };
  }
  return { estado, criar, audit, avisar, rpc, suporte, requireRole, admin };
});

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: h.suporte }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/lgpd/repository", () => ({ createLgpdRequest: h.criar }));
vi.mock("@/lib/lgpd/avisos-do-pedido-manual", () => ({ avisarAdminsDoNovoPedido: h.avisar }));

import { POST } from "@/app/api/v1/lgpd/requests/route";

const HOJE = new Date().toISOString().slice(0, 10);

function corpo(extra: Record<string, unknown> = {}) {
  return {
    contact_id: CONTATO,
    request_type: "data_request",
    received_at: HOJE,
    canal: "outro",
    observacao: "veio à loja com documento",
    ...extra,
  };
}

async function enviar(body: unknown) {
  const req = new NextRequest("http://localhost/api/v1/lgpd/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req);
  return { res, json: (await res.json()) as Record<string, any> };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.estado.role = "admin";
  h.estado.filtros.length = 0;
  h.estado.aberto = null;
  h.estado.contato = {
    id: CONTATO,
    email: "ana@loja.test",
    phone_number: "+32000000000",
    wa_lid: null,
    is_anonymized: false,
  };
  h.suporte.mockResolvedValue(null);
  h.criar.mockResolvedValue({ id: "p1", due_at: "2026-11-24T00:00:00.000Z" });
  h.avisar.mockResolvedValue({ avisados: 2 });
  h.requireRole.mockImplementation(async () => {
    if (h.estado.role === "viewer") {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 }),
      };
    }
    return {
      ok: true,
      user: { id: "u1", email: "ana@loja.test", full_name: "Ana", idioma: "pt-BR" },
      org: { orgId: "org-1", role: h.estado.role },
    };
  });
});

describe("POST /api/v1/lgpd/requests (U53)", () => {
  it("viewer 403; agent e admin 201", async () => {
    h.estado.role = "viewer";
    expect((await enviar(corpo())).res.status).toBe(403);
    expect(h.criar).not.toHaveBeenCalled();
    for (const role of ["agent", "admin"] as const) {
      h.estado.role = role;
      const { res, json } = await enviar(corpo());
      expect(res.status).toBe(201);
      expect(json.data).toEqual({ id: "p1", due_at: "2026-11-24T00:00:00.000Z" });
    }
  });

  it("exige agent e libera org suspensa", async () => {
    await enviar(corpo());
    expect(h.requireRole).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        permiteOrgSuspensa: true,
        resource: "lgpd_requests",
        allowPlatformAdmin: true,
      }),
    );
  });

  it("sessão de suporte que só lê é recusada", async () => {
    const recusa = new Response(JSON.stringify({ error: { code: "support_read_only" } }), {
      status: 403,
    });
    h.suporte.mockResolvedValue(recusa);
    const { res } = await enviar(corpo());
    expect(res).toBe(recusa);
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("contato de outra org é 404", async () => {
    h.estado.contato = null;
    const { res, json } = await enviar(corpo());
    expect(h.estado.filtros).toContainEqual(["contacts", "organization_id", "org-1"]);
    expect(res.status).toBe(404);
    expect(json.error.code).toBe("not_found");
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("contato anonimizado é 409", async () => {
    h.estado.contato = { ...h.estado.contato!, is_anonymized: true };
    const { res, json } = await enviar(corpo());
    expect(res.status).toBe(409);
    expect(json.error.code).toBe("contato_anonimizado");
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("segundo pedido do mesmo tipo é 409", async () => {
    h.estado.aberto = { id: "antigo", due_at: "2026-11-20T00:00:00.000Z" };
    const { res, json } = await enviar(corpo());
    expect(res.status).toBe(409);
    expect(json.error.code).toBe("pedido_aberto");
    expect(json.error.details.due_at).toBe("2026-11-20T00:00:00.000Z");
    expect(h.estado.filtros).toContainEqual(["lgpd_requests", "organization_id", "org-1"]);
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("data futura é 422", async () => {
    const futuro = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { res, json } = await enviar(corpo({ received_at: futuro }));
    expect(res.status).toBe(422);
    expect(json.error.code).toBe("data_no_futuro");
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("'outro' sem observação é 422", async () => {
    const { res, json } = await enviar(corpo({ observacao: "   " }));
    expect(res.status).toBe(422);
    expect(json.error.code).toBe("validation_failed");
    expect(h.criar).not.toHaveBeenCalled();
  });

  it("WhatsApp sem telefone nem wa_lid é 422; só wa_lid é 201", async () => {
    h.estado.contato = { ...h.estado.contato!, phone_number: null, wa_lid: null };
    const recusado = await enviar(corpo({ canal: "whatsapp_registrado" }));
    expect(recusado.res.status).toBe(422);
    expect(recusado.json.error.code).toBe("canal_incompativel");
    expect(h.criar).not.toHaveBeenCalled();

    h.estado.contato = { ...h.estado.contato!, wa_lid: "lid-fake-1" };
    const aceito = await enviar(corpo({ canal: "whatsapp_registrado" }));
    expect(aceito.res.status).toBe(201);
  });

  it("e-mail registrado sem e-mail no cadastro é 422", async () => {
    h.estado.contato = { ...h.estado.contato!, email: null };
    const { res, json } = await enviar(corpo({ canal: "email_registrado" }));
    expect(res.status).toBe(422);
    expect(json.error.code).toBe("canal_incompativel");
  });

  it("source manual, prazo 7 e 15, delivery do cadastro", async () => {
    await enviar(corpo({ delivery: { address: "x@fora.test" } }));
    expect(h.criar.mock.calls[0][0]).toMatchObject({
      organizationId: "org-1",
      requestType: "data_request",
      source: "manual",
      slaDays: 7,
      contactId: CONTATO,
      payload: { delivery: { address: "ana@loja.test", origem: "cadastro_no_pedido" } },
    });
    await enviar(corpo({ request_type: "redact" }));
    expect(h.criar.mock.calls[1][0]).toMatchObject({ requestType: "redact", slaDays: 15 });
  });

  it("observação vazia vira null no payload", async () => {
    await enviar(corpo({ canal: "whatsapp_registrado", observacao: "   " }));
    expect(h.criar.mock.calls[0][0].payload.origem_manual).toMatchObject({
      canal: "whatsapp_registrado",
      observacao: null,
      criado_por: "u1",
    });
  });

  it("auditoria sem observação nem e-mail", async () => {
    await enviar(corpo());
    const meta = JSON.stringify(h.audit.mock.calls[0][0].metadata);
    expect(meta).not.toContain("ana@loja.test");
    expect(meta).not.toContain("veio à loja com documento");
    expect(h.audit.mock.calls[0][0].action).toBe("lgpd.data_request_received");
    expect(h.audit.mock.calls[0][0].metadata).toEqual({
      source: "manual",
      canal: "outro",
      request_id: "p1",
    });
  });

  it("exclusão audita como lgpd.redact_received", async () => {
    await enviar(corpo({ request_type: "redact" }));
    expect(h.audit.mock.calls[0][0].action).toBe("lgpd.redact_received");
  });

  it("abrir não emite evento", async () => {
    await enviar(corpo());
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("avisa os admins com o prazo do pedido", async () => {
    await enviar(corpo({ request_type: "redact" }));
    expect(h.avisar).toHaveBeenCalledTimes(1);
    expect(h.avisar.mock.calls[0][1]).toEqual({
      organizationId: "org-1",
      requestId: "p1",
      tipo: "redact",
      dueAt: "2026-11-24T00:00:00.000Z",
    });
  });

  it("aviso que falha não desfaz o pedido", async () => {
    h.avisar.mockResolvedValue({ avisados: 0 });
    const { res } = await enviar(corpo());
    expect(res.status).toBe(201);
  });
});
