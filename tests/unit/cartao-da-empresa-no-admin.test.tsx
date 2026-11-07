/**
 * U33 / U40 — o cartão da empresa no painel do dono:
 *  - o rótulo do número da empresa segue o país (KBO na Bélgica, não CNPJ);
 *  - a empresa suspensa mostra o motivo gravado;
 *  - plano de 0 dia não aparece como "Teste grátis";
 *  - o seletor "Plano da empresa" abre no plano ATUAL.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

import { CardDeCobranca } from "@/components/admin/tenants/CardDeCobranca";
import { SuspendedBanner } from "@/components/admin/tenants/SuspendedBanner";
import { TenantOverview } from "@/components/admin/tenants/TenantOverview";
import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";

afterEach(cleanup);

const ORG_BE: TenantOrganization = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "acme",
  display_name: "Acme",
  legal_name: "Acme BV",
  cnpj: "0123.456.749",
  status: "active",
  onboarded_at: null,
  suspended_at: null,
  created_at: "2026-01-01T12:00:00.000Z",
  settings: null,
  country: "BE",
  timezone: "Europe/Brussels",
  locale: "nl-BE",
  currency: "EUR",
  media_retention_days: 180,
  media_retention_enforced: true,
  dpo_email: null,
  privacy_policy_url: null,
};
const COUNTS: TenantCounts = {
  user_count: 1, conversations_count: 0, messages_count: 0, leads_count: 0,
  orders_count: 0, lgpd_requests_pending: 0, ai_invocations_30d: 0, waha_sessions_count: 0,
};

describe("rótulo do número da empresa", () => {
  it("Bélgica: KBO/BCE, nunca CNPJ", () => {
    render(<TenantOverview organization={ORG_BE} counts={COUNTS} integrations={{ nuvemshop_status: null, nuvemshop_connected_at: null }} />);
    expect(screen.getByText("Número da empresa (KBO/BCE)")).toBeTruthy();
    expect(screen.queryByText("CNPJ")).toBeNull();
  });
  it("Brasil continua CNPJ", () => {
    render(<TenantOverview organization={{ ...ORG_BE, country: "BR" }} counts={COUNTS} integrations={{ nuvemshop_status: null, nuvemshop_connected_at: null }} />);
    expect(screen.getByText("CNPJ")).toBeTruthy();
  });
});

describe("faixa de empresa suspensa", () => {
  it("mostra o motivo gravado, e só sem ele diz que não há", () => {
    render(<SuspendedBanner suspendedAt="2026-11-01T00:00:00Z" reason="Falta de pagamento da fatura de outubro" />);
    expect(screen.getByText("Falta de pagamento da fatura de outubro")).toBeTruthy();
    expect(screen.queryByText("Sem razão registrada.")).toBeNull();
  });
});

const A = { id: "cccccccc-0000-4000-8000-000000000001", nome: "Básico", arquivado_em: null };
const B = { id: "cccccccc-0000-4000-8000-000000000002", nome: "Pro", arquivado_em: null };
const base = { orgId: "bbbbbbbb-0000-4000-8000-000000000001", planos: [A, B], suspensaPorCobranca: false, rotuloAntigo: null };

describe("card de cobrança", () => {
  it("o seletor abre no plano atual, não no primeiro da lista", () => {
    render(
      <CardDeCobranca {...base} assinatura={{ plano_id: B.id, estado: "em_atraso", trial_ate: null, prazo_extra_ate: null, provedor: null, plano_agendado_id: null, proximo_vencimento: null }} />,
    );
    expect((screen.getByLabelText("Plano da empresa") as HTMLSelectElement).value).toBe(B.id);
  });
  it("plano atual arquivado: cai no primeiro ativo", () => {
    render(
      <CardDeCobranca {...base} planos={[A, { ...B, arquivado_em: "2026-09-01T00:00:00Z" }]} assinatura={{ plano_id: B.id, estado: "em_atraso", trial_ate: null, prazo_extra_ate: null, provedor: null, plano_agendado_id: null, proximo_vencimento: null }} />,
    );
    expect((screen.getByLabelText("Plano da empresa") as HTMLSelectElement).value).toBe(A.id);
  });
  it("teste que já terminou (plano de 0 dia) não se chama 'Teste grátis'", () => {
    render(
      <CardDeCobranca {...base} assinatura={{ plano_id: A.id, estado: "trial", trial_ate: "2026-01-01T00:00:00Z", prazo_extra_ate: null, provedor: null, plano_agendado_id: null, proximo_vencimento: null }} />,
    );
    expect(screen.getByText("Aguardando o primeiro pagamento")).toBeTruthy();
    expect(screen.queryByText("Teste grátis")).toBeNull();
  });
  it("teste em curso continua 'Teste grátis'", () => {
    render(
      <CardDeCobranca {...base} assinatura={{ plano_id: A.id, estado: "trial", trial_ate: "2099-01-01T00:00:00Z", prazo_extra_ate: null, provedor: null, plano_agendado_id: null, proximo_vencimento: null }} />,
    );
    expect(screen.getByText("Teste grátis")).toBeTruthy();
  });
  it("o botão do link não promete criar um link novo", () => {
    render(
      <CardDeCobranca {...base} assinatura={{ plano_id: A.id, estado: "em_atraso", trial_ate: null, prazo_extra_ate: null, provedor: null, plano_agendado_id: null, proximo_vencimento: null }} />,
    );
    expect(screen.getByRole("button", { name: "Mostrar link de pagamento" })).toBeTruthy();
  });
});

describe("página da empresa suspensa", () => {
  it("a faixa recebe o motivo que a API devolveu", async () => {
    vi.resetModules();
    vi.doMock("@/hooks/useTenantDetail", () => ({
      useTenantDetail: () => ({
        isLoading: false,
        isError: false,
        data: {
          data: {
            organization: { ...ORG_BE, status: "suspended", suspended_at: "2026-11-01T00:00:00Z", suspended_reason: "Pedido do cliente por escrito" },
            counts: COUNTS,
            integrations: { nuvemshop_status: null, nuvemshop_connected_at: null },
          },
        },
      }),
    }));
    vi.doMock("@/components/admin/tenants/TenantActions", () => ({ TenantActions: () => null }));
    vi.doMock("@/components/admin/tenants/TenantMembers", () => ({ TenantMembers: () => null }));
    const { TenantOverviewClient } = await import("@/app/admin/(protected)/tenants/[id]/_client");
    render(<TenantOverviewClient id={ORG_BE.id} />);
    expect(screen.getByText("Pedido do cliente por escrito")).toBeTruthy();
    expect(screen.queryByText("Sem razão registrada.")).toBeNull();
  });
});
