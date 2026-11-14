/**
 * U51 — no cadastro `com_aprovacao`, a empresa aprovada nascia pt-BR / BRL.
 *
 * O `signUp` guarda as pistas (idioma da tela e fuso do navegador) no
 * `user_metadata` da conta, nas chaves PRÓPRIAS do cadastro
 * (`CHAVE_IDIOMA_DO_CADASTRO`, `CHAVE_FUSO_DO_CADASTRO`). No cadastro aberto o
 * `/auth/confirm` as lê ao provisionar. No com aprovação a empresa só nasce em
 * `decideRegistrationRequest`, que montava um `user_metadata` novo só com o nome
 * do pedido e o plano — as pistas ficavam na conta e nunca chegavam ao
 * provisionamento. Agora a aprovação as leva junto, saneadas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO,
  CHAVE_FUSO_DO_CADASTRO,
  CHAVE_IDIOMA_DO_CADASTRO,
  perfilDaEmpresaNova,
} from "@/lib/auth/perfil-da-empresa-nova";
import { ensureTenantForUser } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => ({ get: () => null })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdminEscrita: vi.fn(async () => ({ user: { id: "99999999-9999-4999-8999-999999999999" } })),
}));
vi.mock("@/lib/auth/provision", () => ({ ensureTenantForUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const PEDIDO = {
  id: "44444444-4444-4444-8444-444444444444",
  user_id: "11111111-1111-4111-8111-111111111111",
  requested_organization_name: "Empresa Exemplo",
};

function banco(metadata: Record<string, unknown>) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: PEDIDO, error: null }) }) }) }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: {
            user: {
              id: PEDIDO.user_id,
              email: "dono@example.com",
              email_confirmed_at: "2026-11-14T10:00:00Z",
              user_metadata: metadata,
            },
          },
        })),
      },
    },
  } as never);
}

async function aprovar(metadata: Record<string, unknown>) {
  banco(metadata);
  const { decideRegistrationRequest } = await import("@/app/actions/registration/decide");
  await expect(decideRegistrationRequest({ requestId: PEDIDO.id, decision: "approve" })).resolves.toEqual({ ok: true });
  const [usuario] = vi.mocked(ensureTenantForUser).mock.calls[0]!;
  return usuario.user_metadata as Record<string, unknown>;
}

/** O que o provisionamento faz com o metadata (lib/auth/provision.ts), sem banco. */
const perfilDoMetadata = (meta: Record<string, unknown>) =>
  perfilDaEmpresaNova({
    idioma: typeof meta[CHAVE_IDIOMA_DO_CADASTRO] === "string" ? (meta[CHAVE_IDIOMA_DO_CADASTRO] as string) : null,
    fuso: typeof meta[CHAVE_FUSO_DO_CADASTRO] === "string" ? (meta[CHAVE_FUSO_DO_CADASTRO] as string) : null,
  });

describe("U51 — a aprovação leva as pistas do cadastro ao provisionamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureTenantForUser).mockResolvedValue({ provisioned: true, organizationId: "22222222-2222-4222-8222-222222222222" });
  });

  it("Bélgica (nl + Bruxelas): o idioma e o fuso do cadastro chegam à empresa aprovada", async () => {
    const meta = await aprovar({ [CHAVE_IDIOMA_DO_CADASTRO]: "nl", [CHAVE_FUSO_DO_CADASTRO]: "Europe/Brussels" });
    expect(meta).toEqual({
      org_name: "Empresa Exemplo",
      [CHAVE_IDIOMA_DO_CADASTRO]: "nl",
      [CHAVE_FUSO_DO_CADASTRO]: "Europe/Brussels",
    });
    // O mesmo perfil do cadastro aberto, do mesmo navegador.
    expect(perfilDoMetadata(meta)).toEqual({ locale: "nl", timezone: "Europe/Brussels", currency: "EUR", country: "BE" });
  });

  it("Turquia (tr + Istambul), junto com o plano escolhido", async () => {
    const meta = await aprovar({
      [CHAVE_IDIOMA_DO_CADASTRO]: "tr",
      [CHAVE_FUSO_DO_CADASTRO]: "Europe/Istanbul",
      cobranca_plan_id: "55555555-5555-4555-8555-555555555555",
    });
    expect(meta).toEqual({
      org_name: "Empresa Exemplo",
      cobranca_plan_id: "55555555-5555-4555-8555-555555555555",
      [CHAVE_IDIOMA_DO_CADASTRO]: "tr",
      [CHAVE_FUSO_DO_CADASTRO]: "Europe/Istanbul",
    });
    expect(perfilDoMetadata(meta)).toEqual({ locale: "tr", timezone: "Europe/Istanbul", currency: "TRY" });
  });

  it("pista adulterada ou inválida não passa (a mesma régua do signUp)", async () => {
    const meta = await aprovar({ [CHAVE_IDIOMA_DO_CADASTRO]: "xx-YY", [CHAVE_FUSO_DO_CADASTRO]: "Marte/Olympus", org_name: "outro" });
    expect(meta).toEqual({ org_name: "Empresa Exemplo" });
  });

  it("Brasil (pt-BR): o perfil é só o idioma, como no cadastro aberto", async () => {
    const meta = await aprovar({ [CHAVE_IDIOMA_DO_CADASTRO]: "pt-BR", [CHAVE_FUSO_DO_CADASTRO]: "America/Sao_Paulo" });
    expect(JSON.stringify(perfilDoMetadata(meta))).toBe(JSON.stringify({ locale: "pt-BR" }));
  });

  it("conta sem pistas (cadastro antigo): o metadata é o de antes, byte a byte", async () => {
    const meta = await aprovar({ org_name: "outro" });
    expect(JSON.stringify(meta)).toBe(JSON.stringify({ org_name: "Empresa Exemplo" }));
  });
  it("o Accept-Language guardado no cadastro vira a pista do provisionamento (navegador sem fuso)", async () => {
    banco({ [CHAVE_IDIOMA_DO_CADASTRO]: "nl", [CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO]: "nl-BE,nl;q=0.9" });
    const { decideRegistrationRequest } = await import("@/app/actions/registration/decide");
    await decideRegistrationRequest({ requestId: PEDIDO.id, decision: "approve" });
    const [usuario, opcoes] = vi.mocked(ensureTenantForUser).mock.calls[0]!;
    expect(opcoes).toEqual({ source: "signup", pistas: { acceptLanguage: "nl-BE,nl;q=0.9" } });
    // O mesmo perfil que o /auth/confirm daria com o cabeçalho do próprio navegador.
    expect(
      perfilDaEmpresaNova({
        idioma: usuario.user_metadata?.[CHAVE_IDIOMA_DO_CADASTRO] as string,
        acceptLanguage: opcoes?.pistas?.acceptLanguage,
      }),
    ).toEqual({ locale: "nl", timezone: "Europe/Brussels", currency: "EUR", country: "BE" });
  });

  it("sem Accept-Language guardado, a aprovação chama o provisionamento como antes", async () => {
    banco({ [CHAVE_IDIOMA_DO_CADASTRO]: "nl" });
    const { decideRegistrationRequest } = await import("@/app/actions/registration/decide");
    await decideRegistrationRequest({ requestId: PEDIDO.id, decision: "approve" });
    expect(vi.mocked(ensureTenantForUser).mock.calls[0]![1]).toEqual({ source: "signup" });
  });
});
