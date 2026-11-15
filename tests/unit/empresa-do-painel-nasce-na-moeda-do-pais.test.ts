/**
 * /admin/tenants/new: a empresa criada pelo painel da plataforma nasce na moeda
 * do país escolhido (U40).
 *
 * Antes, a rota gravava só país, idioma e fuso, e `organizations.currency`
 * ficava no default da coluna (`BRL`): uma empresa belga criada pelo painel
 * nascia em reais. Agora a moeda sai do país, pela MESMA tabela do cadastro
 * aberto (`MOEDA_DO_PAIS`, `lib/auth/perfil-da-empresa-nova.ts`), na MESMA
 * escrita de país, idioma e fuso. Sem país, a escrita é a de antes, byte a byte.
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
    body: JSON.stringify({ display_name: "Empresa Exemplo", slug: "empresa-exemplo", owner_email: "dono@example.test", ...extra }),
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
    () => ({ data: { id: ORG, display_name: "Empresa Exemplo", slug: "empresa-exemplo", created: true, invite_id: h.ator, issued_at: 1 } }),
  );
});

describe("POST /api/v1/admin/tenants — moeda do país da empresa nova", () => {
  it("Bélgica: EUR na MESMA escrita do país, antes do convite", async () => {
    let gravadoAntesDoConvite = false;
    h.invite.mockImplementation(async () => {
      gravadoAntesDoConvite = escritaNaOrganizacao() !== undefined;
      return { accept_url: "https://x/convite", expires_at: "2026-11-02T00:00:00Z", email_dispatched: true, email: "dono@example.test" };
    });

    const res = await POST(pedido({ country: "BE", locale: "nl", timezone: "Europe/Brussels" }));

    expect(res.status).toBe(201);
    const escritas = h.banco.cadeias.filter((c) => c.tabela === "organizations" && operacao(c) === "update");
    expect(escritas).toHaveLength(1);
    expect(argumentos(escritas[0]!, "update")).toEqual([
      { locale: "nl", timezone: "Europe/Brussels", country: "BE", currency: "EUR" },
    ]);
    expect(valorDoFiltro(escritas[0]!, "eq", "id")).toBe(ORG);
    expect(gravadoAntesDoConvite).toBe(true);
    expect((await res.json()).data.idioma_gravado).toBe(true);
  });

  it("Portugal: EUR", async () => {
    await POST(pedido({ country: "PT" }));
    expect(argumentos(escritaNaOrganizacao()!, "update")).toEqual([{ country: "PT", currency: "EUR" }]);
  });

  it("Brasil: a escrita é a de hoje, sem moeda — a coluna fica no default BRL", async () => {
    await POST(pedido({ country: "BR" }));
    expect(argumentos(escritaNaOrganizacao()!, "update")).toEqual([{ country: "BR" }]);
  });

  it("a moeda vem da tabela única do cadastro aberto, não de uma cópia", async () => {
    const { MOEDA_DO_PAIS } = await import("@/lib/auth/perfil-da-empresa-nova");
    expect(MOEDA_DO_PAIS.BE).toBe("EUR");
    expect(MOEDA_DO_PAIS.PT).toBe("EUR");
    expect(MOEDA_DO_PAIS).not.toHaveProperty("BR");
  });

  it("sem país: nenhuma chave de moeda, a escrita é a de antes byte a byte", async () => {
    await POST(pedido({ locale: "tr", timezone: "Europe/Brussels" }));
    expect(JSON.stringify(argumentos(escritaNaOrganizacao()!, "update"))).toBe(
      JSON.stringify([{ locale: "tr", timezone: "Europe/Brussels" }]),
    );
  });

  it("sem país, idioma nem fuso: nada é escrito na organização", async () => {
    const res = await POST(pedido());
    expect(escritaNaOrganizacao()).toBeUndefined();
    expect((await res.json()).data).not.toHaveProperty("idioma_gravado");
  });

  it("a moeda não entra no pedido da função SQL (o recibo de idempotência não muda)", async () => {
    await POST(pedido({ country: "BE" }));
    expect(pRequest()).toBeDefined();
    expect(pRequest()).not.toHaveProperty("currency");
  });

  it("moeda no corpo do pedido é ignorada: o painel não tem esse campo", async () => {
    await POST(pedido({ country: "BE", currency: "USD" }));
    expect(argumentos(escritaNaOrganizacao()!, "update")).toEqual([{ country: "BE", currency: "EUR" }]);
    expect(pRequest()).not.toHaveProperty("currency");
  });

  it("a escrita falhou: a empresa existe, o convite sai, a resposta diz que não gravou", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    h.falhaNaOrganizacao = true;
    const res = await POST(pedido({ country: "BE" }));
    expect(res.status).toBe(201);
    expect(h.invite).toHaveBeenCalled();
    expect((await res.json()).data.idioma_gravado).toBe(false);
    erro.mockRestore();
  });
});
