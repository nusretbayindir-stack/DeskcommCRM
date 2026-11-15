// @vitest-environment node
/**
 * U53: `POST /api/v1/lgpd/requests/[id]/encerrar` fecha o pedido do titular.
 *
 * A rota REAL com dublês de banco, de papel e de auditoria. O que se prova: o
 * papel exigido, as duas transições (e só elas), os filtros de empresa e de
 * estado que a leitura e o UPDATE carregam, o que vai para o `result`, e que a
 * trilha de auditoria nunca leva a nota.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const PEDIDO = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const h = vi.hoisted(() => {
  const estado = {
    role: "admin" as "agent" | "admin",
    pedido: null as Record<string, unknown> | null,
    atualizacoes: [] as Array<Record<string, unknown>>,
    filtrosLeitura: [] as Array<[string, unknown]>,
    filtrosUpdate: [] as Array<[string, unknown]>,
    updateAfetou: true,
  };
  const audit = vi.fn();
  const resolver = vi.fn();
  const suporte = vi.fn();
  const requireRole = vi.fn();

  function admin() {
    return {
      from() {
        let modo: "leitura" | "update" = "leitura";
        const cadeia: Record<string, unknown> = {
          select: () => cadeia,
          update: (valores: Record<string, unknown>) => {
            modo = "update";
            estado.atualizacoes.push(valores);
            return cadeia;
          },
          eq: (col: string, val: unknown) => {
            (modo === "leitura" ? estado.filtrosLeitura : estado.filtrosUpdate).push([col, val]);
            return cadeia;
          },
          maybeSingle: async () => ({ data: estado.pedido, error: null }),
          then: (res: (v: unknown) => unknown) =>
            res({ data: estado.updateAfetou ? [{ id: "x" }] : [], error: null }),
        };
        return cadeia;
      },
    };
  }
  return { estado, audit, resolver, suporte, requireRole, admin };
});

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: h.suporte }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: h.requireRole }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin() }));
vi.mock("@/lib/lgpd/avisos-do-pedido-manual", () => ({ resolverAvisosDoPedido: h.resolver }));

import { POST } from "@/app/api/v1/lgpd/requests/[id]/encerrar/route";
import { encerradoPeloResponsavel } from "@/lib/lgpd/encerramento";

function pedido(status: string) {
  return {
    id: PEDIDO,
    organization_id: "org-1",
    status,
    result: { pdf_path: "org-1/p1/report.pdf" },
  };
}

// Só os campos da resposta que os testes leem.
type Corpo = { data: unknown; error: { code: string } };

async function enviar(body: unknown, id: string = PEDIDO) {
  const req = new NextRequest(`http://localhost/api/v1/lgpd/requests/${id}/encerrar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST(req, { params: Promise.resolve({ id }) });
  return { res, json: (await res.json()) as Corpo };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.estado.role = "admin";
  h.estado.pedido = pedido("pending_review");
  h.estado.atualizacoes.length = 0;
  h.estado.filtrosLeitura.length = 0;
  h.estado.filtrosUpdate.length = 0;
  h.estado.updateAfetou = true;
  h.suporte.mockResolvedValue(null);
  h.requireRole.mockImplementation(async () => {
    if (h.estado.role === "agent") {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 }),
      };
    }
    return {
      ok: true,
      user: { id: "u1", email: "ana@loja.test", full_name: "Ana", idioma: "pt-BR" },
      org: { orgId: "org-1", role: "admin" },
    };
  });
});

describe("POST /api/v1/lgpd/requests/[id]/encerrar (U53)", () => {
  it("agent 403", async () => {
    h.estado.role = "agent";
    const { res } = await enviar({ acao: "entregue_manualmente" });
    expect(res.status).toBe(403);
    expect(h.requireRole).toHaveBeenCalledWith(
      "admin",
      expect.objectContaining({ permiteOrgSuspensa: true, resource: "lgpd_requests" }),
    );
    expect(h.estado.atualizacoes).toHaveLength(0);
  });

  it("id que não é UUID é 404, sem tocar no banco", async () => {
    const { res, json } = await enviar({ acao: "entregue_manualmente" }, "p1");
    expect(res.status).toBe(404);
    expect(json.error.code).toBe("not_found");
    expect(h.estado.filtrosLeitura).toHaveLength(0);
  });

  it("pedido de outra empresa é 404 e a leitura filtra por empresa e id", async () => {
    h.estado.pedido = null;
    const { res } = await enviar({ acao: "entregue_manualmente" });
    expect(res.status).toBe(404);
    expect(h.estado.filtrosLeitura).toContainEqual(["organization_id", "org-1"]);
    expect(h.estado.filtrosLeitura).toContainEqual(["id", PEDIDO]);
    expect(h.estado.atualizacoes).toHaveLength(0);
  });

  it("entregue_manualmente só em pending_review", async () => {
    for (const status of ["received", "processing", "completed", "failed"]) {
      h.estado.pedido = pedido(status);
      const { res, json } = await enviar({ acao: "entregue_manualmente" });
      expect(res.status).toBe(409);
      expect(json.error.code).toBe("conflict");
    }
    expect(h.estado.atualizacoes).toHaveLength(0);
  });

  it("encerrado só em received", async () => {
    for (const status of ["processing", "pending_review", "completed"]) {
      h.estado.pedido = pedido(status);
      const { res, json } = await enviar({ acao: "encerrado", motivo_codigo: "duplicado" });
      expect(res.status).toBe(409);
      expect(json.error.code).toBe("conflict");
    }
    expect(h.estado.atualizacoes).toHaveLength(0);
  });

  it("corrida: o UPDATE que não acha mais o estado esperado é 409", async () => {
    h.estado.updateAfetou = false;
    const { res, json } = await enviar({ acao: "entregue_manualmente" });
    expect(res.status).toBe(409);
    expect(json.error.code).toBe("conflict");
    expect(h.audit).not.toHaveBeenCalled();
    expect(h.resolver).not.toHaveBeenCalled();
  });

  it("motivo que pede nota sem nota é 422", async () => {
    h.estado.pedido = pedido("received");
    for (const motivo_codigo of ["identidade_nao_confirmada", "outro"]) {
      const semNota = await enviar({ acao: "encerrado", motivo_codigo });
      expect(semNota.res.status).toBe(422);
      expect(semNota.json.error.code).toBe("validation_failed");
      const curta = await enviar({ acao: "encerrado", motivo_codigo, nota: "curta" });
      expect(curta.res.status).toBe(422);
    }
    expect(h.estado.atualizacoes).toHaveLength(0);
    const engano = await enviar({ acao: "encerrado", motivo_codigo: "aberto_por_engano" });
    expect(engano.res.status).toBe(200);
  });

  it("corpo que não é JSON é 400", async () => {
    const req = new NextRequest("http://localhost/x", { method: "POST", body: "{nao" });
    const res = await POST(req, { params: Promise.resolve({ id: PEDIDO }) });
    expect(res.status).toBe(400);
  });

  it("entregue_manualmente conclui e guarda a nota no result", async () => {
    const { res, json } = await enviar({
      acao: "entregue_manualmente",
      nota: "PDF enviado pela conversa",
    });
    expect(res.status).toBe(200);
    expect(json.data).toEqual({ request_id: PEDIDO, status: "completed" });
    expect(h.estado.atualizacoes[0]).toMatchObject({
      status: "completed",
      completed_at: expect.any(String),
      // O worker deixou `no_delivery_email`; o pedido concluído não pode exibir erro.
      error_message: null,
      result: {
        pdf_path: "org-1/p1/report.pdf",
        entrega_manual: { nota: "PDF enviado pela conversa", por: "u1", em: expect.any(String) },
      },
    });
    expect(h.estado.filtrosUpdate).toContainEqual(["organization_id", "org-1"]);
    expect(h.estado.filtrosUpdate).toContainEqual(["id", PEDIDO]);
    expect(h.estado.filtrosUpdate).toContainEqual(["status", "pending_review"]);
    expect(h.audit.mock.calls[0]![0]).toMatchObject({
      action: "lgpd.export_delivered",
      metadata: { delivery: "manual", request_id: PEDIDO },
    });
    expect(JSON.stringify(h.audit.mock.calls[0]![0])).not.toContain("PDF enviado");
  });

  it("encerrado vira failed com o código do responsável", async () => {
    h.estado.pedido = pedido("received");
    const { res, json } = await enviar({ acao: "encerrado", motivo_codigo: "duplicado" });
    expect(res.status).toBe(200);
    expect(json.data).toEqual({ request_id: PEDIDO, status: "failed" });
    expect(h.estado.atualizacoes[0]).toMatchObject({
      status: "failed",
      error_message: "encerrado_pelo_responsavel",
      completed_at: expect.any(String),
      result: { encerramento: { motivo_codigo: "duplicado", nota: null, por: "u1" } },
    });
    expect(h.estado.filtrosUpdate).toContainEqual(["organization_id", "org-1"]);
    expect(h.estado.filtrosUpdate).toContainEqual(["id", PEDIDO]);
    expect(h.estado.filtrosUpdate).toContainEqual(["status", "received"]);
  });

  it("auditoria sem a nota", async () => {
    h.estado.pedido = pedido("received");
    await enviar({
      acao: "encerrado",
      motivo_codigo: "identidade_nao_confirmada",
      nota: "não apresentou documento",
    });
    expect(h.audit.mock.calls[0]![0]).toMatchObject({
      action: "lgpd.request_closed",
      metadata: { motivo_codigo: "identidade_nao_confirmada", request_id: PEDIDO },
    });
    expect(JSON.stringify(h.audit.mock.calls[0]![0])).not.toContain("não apresentou documento");
  });

  it("fecha os avisos da Central", async () => {
    await enviar({ acao: "entregue_manualmente" });
    expect(h.resolver).toHaveBeenCalledWith(expect.anything(), "org-1", PEDIDO);
  });

  it("pedido fechado fica fora do alarme e da limpeza de mídia", () => {
    // As duas réguas que contam "pedido aberto" já tratam completed/failed como fechado.
    const vigia = readFileSync("app/api/v1/cron/lgpd-sla-watcher/route.ts", "utf8");
    expect(vigia).toContain(`.not("status", "in", '("completed","failed")')`);
    const midia = readFileSync(
      "supabase/migrations/20261005200301_0557_retencao_de_midia_opt_in_e_marcador.sql",
      "utf8",
    );
    expect(midia).toContain("r.status in ('received', 'processing')");
  });

  it("encerradoPeloResponsavel", () => {
    expect(
      encerradoPeloResponsavel({ status: "failed", error_message: "encerrado_pelo_responsavel" }),
    ).toBe(true);
    expect(encerradoPeloResponsavel({ status: "failed", error_message: "no_delivery_email" })).toBe(
      false,
    );
  });
});
