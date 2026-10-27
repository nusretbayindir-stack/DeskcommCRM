/**
 * Pular o passo do quadro no onboarding deixa o funil semeado — no idioma da
 * empresa.
 *
 * Pular é decisão, e o funil de e-commerce que o gatilho semeou fica de pé (é
 * o comportamento de sempre). Mas ficava em PORTUGUÊS: uma empresa turca que
 * pulava abria o Kanban com "Carrinho abandonado". Agora o pulo traduz o que
 * ainda é semente para o idioma da organização.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  patch: vi.fn(),
  audit: vi.fn(),
  sementes: vi.fn(),
  idioma: vi.fn(),
  admin: { cliente: "admin" },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/ai/agents/idioma-da-org", () => ({ idiomaDaOrgPeloSupabase: h.idioma }));
vi.mock("@/lib/organizacao/sementes-no-idioma", () => ({ sementesNoIdioma: h.sementes }));
vi.mock("@/app/actions/onboarding/_shared", () => ({
  requireOnboardingCtx: async () => ({ orgId: "org-1", userId: "user-1" }),
  patchOnboardingState: h.patch,
  loadOnboardingState: vi.fn(),
  OnboardingError: class extends Error {},
}));

import { pularQuadro } from "@/app/actions/onboarding/montarQuadro";

beforeEach(() => {
  vi.clearAllMocks();
  h.idioma.mockResolvedValue("tr");
  h.sementes.mockResolvedValue(true);
});

describe("pularQuadro", () => {
  it("traduz as sementes para o idioma da organização e segue para o onboarding", async () => {
    await expect(pularQuadro()).rejects.toThrow("NEXT_REDIRECT");
    expect(h.patch).toHaveBeenCalledWith("org-1", { funil: { skipped: true } });
    expect(h.idioma).toHaveBeenCalledWith(h.admin, "org-1");
    expect(h.sementes).toHaveBeenCalledWith(h.admin, "org-1", "tr");
  });

  it("tradução que lança não impede o pulo", async () => {
    h.sementes.mockRejectedValue(new Error("banco fora"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(pularQuadro()).rejects.toThrow("NEXT_REDIRECT");
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "onboarding.quadro_pulado" }));
    erro.mockRestore();
  });
});
