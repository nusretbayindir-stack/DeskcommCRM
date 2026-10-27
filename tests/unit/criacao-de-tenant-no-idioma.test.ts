/**
 * /admin/tenants/new: a empresa nasce no idioma e no fuso que quem a cria escolheu.
 *
 * Antes, `organizations.locale` nascia `pt-BR` e o fuso, São Paulo — e o convite
 * do dono sai NA HORA da criação, no idioma da organização. Uma empresa turca
 * recebia o primeiro e-mail em português. Agora o idioma e o fuso são gravados
 * entre a criação e o convite. Sem os dois campos, a rota faz o que sempre fez.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  argumentos,
  bancoFalso,
  operacao,
  valorDoFiltro,
  type BancoFalso,
} from "@/tests/helpers/banco-falso-da-cobranca";

const h = vi.hoisted(() => ({
  ator: "a2180000-0000-4000-8000-000000000001",
  escrita: vi.fn(),
  audit: vi.fn(),
  invite: vi.fn(),
  banco: undefined as unknown as BancoFalso,
  falhaNaOrganizacao: false,
}));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDivida: async () => false, loadAuthUser: async () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/requirePlatformAdmin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/requirePlatformAdmin")>()),
  requirePlatformAdminEscrita: h.escrita,
}));
vi.mock("@/lib/instalacao/modulos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instalacao/modulos")>()),
  moduloLigado: async () => false,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.banco.cliente }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/auth/issue-invite", () => ({ issueInvite: h.invite }));

import { POST } from "@/app/api/v1/admin/tenants/route";

const ORG = "a2180000-0000-4000-8000-000000000002";
const pedido = (extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/v1/admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "a2180000-0000-4000-8000-000000000003" },
    body: JSON.stringify({ display_name: "Kuaför Ayşe", slug: "kuafor-ayse", owner_email: "dono@example.test", ...extra }),
  });
const pRequest = () =>
  h.banco.rpcs.find((r) => r.nome === "fn_create_tenant_with_owner")?.args.p_request as Record<string, unknown> | undefined;
const escritaNaOrganizacao = () =>
  h.banco.cadeias.find((c) => c.tabela === "organizations" && operacao(c) === "update");

beforeEach(() => {
  vi.clearAllMocks();
  h.falhaNaOrganizacao = false;
  h.escrita.mockResolvedValue({ user: { id: h.ator, email: "admin@example.test", user_metadata: {} }, platformAdmin: { scope: "full" } });
  h.invite.mockResolvedValue({ accept_url: "https://x/convite", expires_at: "2026-11-02T00:00:00Z", email_dispatched: true, email: "dono@example.test" });
  h.banco = bancoFalso(
    (c) =>
      c.tabela === "organizations" && operacao(c) === "update" && h.falhaNaOrganizacao
        ? { error: { message: "falhou" } }
        : {},
    () => ({ data: { id: ORG, display_name: "Kuaför Ayşe", slug: "kuafor-ayse", created: true, invite_id: h.ator, issued_at: 1 } }),
  );
});

describe("POST /api/v1/admin/tenants — idioma e fuso da empresa nova", () => {
  it("grava idioma e fuso na organização ANTES de mandar o convite", async () => {
    let gravadoAntesDoConvite = false;
    h.invite.mockImplementation(async () => {
      gravadoAntesDoConvite = escritaNaOrganizacao() !== undefined;
      return { accept_url: "https://x/convite", expires_at: "2026-11-02T00:00:00Z", email_dispatched: true, email: "dono@example.test" };
    });

    const res = await POST(pedido({ locale: "tr", timezone: "Europe/Brussels" }));

    expect(res.status).toBe(201);
    const cadeia = escritaNaOrganizacao();
    expect(argumentos(cadeia!, "update")).toEqual([{ locale: "tr", timezone: "Europe/Brussels" }]);
    expect(valorDoFiltro(cadeia!, "eq", "id")).toBe(ORG);
    expect(gravadoAntesDoConvite).toBe(true);
    expect((await res.json()).data.idioma_gravado).toBe(true);
  });

  it("traduz as sementes da empresa nova (tipos de agendamento)", async () => {
    await POST(pedido({ locale: "tr", timezone: "Europe/Brussels" }));
    const tipos = h.banco.cadeias.filter((c) => c.tabela === "calendar_event_types" && operacao(c) === "update");
    expect(tipos.map((c) => argumentos(c, "update")?.[0])).toContainEqual({ name: "Görüşme" });
  });

  it("idioma e fuso não entram no pedido da função SQL (o recibo de idempotência não muda)", async () => {
    await POST(pedido({ locale: "tr", timezone: "Europe/Brussels" }));
    expect(pRequest()).toBeDefined();
    expect(pRequest()).not.toHaveProperty("locale");
    expect(pRequest()).not.toHaveProperty("timezone");
  });

  it("sem os dois campos, nada é escrito na organização (o comportamento de antes)", async () => {
    const res = await POST(pedido());
    expect(res.status).toBe(201);
    expect(escritaNaOrganizacao()).toBeUndefined();
    expect((await res.json()).data).not.toHaveProperty("idioma_gravado");
  });

  it("fuso que não existe → 400, nada criado", async () => {
    const res = await POST(pedido({ locale: "tr", timezone: "Europe/Bruxelas" }));
    expect(res.status).toBe(400);
    expect(h.banco.rpcs).toEqual([]);
  });

  it("idioma que a instalação não serve → 400, nada criado", async () => {
    const res = await POST(pedido({ locale: "fr", timezone: "Europe/Brussels" }));
    expect(res.status).toBe(400);
    expect(h.banco.rpcs).toEqual([]);
  });

  it("a organização não gravou: a empresa existe, o convite sai, e a resposta diz que o idioma não foi gravado", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    h.falhaNaOrganizacao = true;
    const res = await POST(pedido({ locale: "tr", timezone: "Europe/Brussels" }));
    expect(res.status).toBe(201);
    expect(h.invite).toHaveBeenCalled();
    expect((await res.json()).data.idioma_gravado).toBe(false);
    erro.mockRestore();
  });
});
