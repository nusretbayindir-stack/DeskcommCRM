/**
 * U51 — entrada pelo Google numa instalação `com_aprovacao`.
 *
 * As pistas do cadastro pelo Google (idioma da tela, fuso do navegador) viajam
 * só na URL de volta (`urlDeRetornoDoGoogle`). No cadastro aberto o callback as
 * entrega ao provisionamento; no com aprovação ele mandava para `/get-started`
 * sem guardá-las, e a empresa aprovada nascia pt-BR / BRL. Agora o callback as
 * guarda na conta (as mesmas chaves do `signUp`), sem sobrescrever o que a
 * conta já tem. Falhar ao guardar não tranca ninguém: o destino é o mesmo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { decidirConviteDoSignup } from "@/lib/auth/convite-no-signup";
import { ensureTenantForUser, vinculoAtivo } from "@/lib/auth/provision";
import { modoDeCadastro } from "@/lib/auth/politica-de-cadastro";
import { acessoFoiRevogado } from "@/lib/auth/vinculo-revogado";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/dispositivo-confiavel", () => ({ reconhecerDispositivoConfiavel: vi.fn(async () => false) }));
vi.mock("@/lib/auth/aplicar-convite", () => ({ aplicarConvite: vi.fn() }));
vi.mock("@/lib/auth/convite-no-signup", () => ({ decidirConviteDoSignup: vi.fn() }));
vi.mock("@/lib/auth/provision", () => ({
  ensureTenantForUser: vi.fn(async () => ({ provisioned: true })),
  vinculoAtivo: vi.fn(async () => null),
}));
vi.mock("@/lib/auth/politica-de-cadastro", () => ({ modoDeCadastro: vi.fn(async () => "com_aprovacao") }));
vi.mock("@/lib/auth/vinculo-revogado", () => ({ acessoFoiRevogado: vi.fn(async () => false) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: vi.fn(async () => ({ nome: "Central de Teste" })) }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));

const atualizar = vi.fn();

async function rota(user_metadata: Record<string, unknown> = {}) {
  const usuario = { id: "11111111-1111-4111-8111-111111111111", email: "pessoa@example.com", user_metadata };
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ data: { user: usuario }, error: null })),
      mfa: { listFactors: vi.fn(async () => ({ data: { totp: [] } })) },
      updateUser: atualizar,
    },
  } as never);
  return await import("@/app/auth/callback/route");
}

const pedido = (qs: string, acceptLanguage?: string) =>
  new NextRequest(`http://localhost:3000/auth/callback?${qs}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });

async function destino(res: Response): Promise<string> {
  const script = (await res.clone().text()).match(/<script>(.*?)<\/script>/)![1]!;
  return JSON.parse(script.replace(/^window\.location\.replace\(/, "").replace(/\);$/, "")) as string;
}

describe("callback do Google, cadastro com aprovação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atualizar.mockResolvedValue({ data: {}, error: null });
    vi.mocked(decidirConviteDoSignup).mockReturnValue({ tipo: "provisionar" });
    vi.mocked(vinculoAtivo).mockResolvedValue(null);
    vi.mocked(modoDeCadastro).mockResolvedValue("com_aprovacao");
    vi.mocked(acessoFoiRevogado).mockResolvedValue(false);
  });

  it("guarda idioma, fuso e Accept-Language na conta e vai para /get-started", async () => {
    const { GET } = await rota();
    const res = await GET(pedido("code=abc&idioma=nl&fuso=Europe%2FBrussels", "nl-BE,nl;q=0.9"));
    expect(await destino(res)).toBe("/get-started");
    expect(atualizar).toHaveBeenCalledTimes(1);
    expect(atualizar).toHaveBeenCalledWith({
      data: {
        idioma_do_cadastro: "nl",
        fuso_do_cadastro: "Europe/Brussels",
        accept_language_do_cadastro: "nl-BE,nl;q=0.9",
      },
    });
    expect(ensureTenantForUser).not.toHaveBeenCalled();
  });

  it("não sobrescreve pista que a conta já tem", async () => {
    const { GET } = await rota({ idioma_do_cadastro: "fr", fuso_do_cadastro: "Europe/Brussels" });
    await GET(pedido("code=abc&idioma=nl&fuso=Europe%2FIstanbul", "nl-BE"));
    expect(atualizar).toHaveBeenCalledWith({ data: { accept_language_do_cadastro: "nl-BE" } });
  });

  it("pista adulterada não é guardada; sem nada a guardar, a conta não é tocada", async () => {
    const { GET } = await rota();
    await GET(pedido("code=abc&idioma=xx&fuso=Marte%2FOlympus"));
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("falhar ao guardar não tranca a pessoa: o destino é o mesmo", async () => {
    atualizar.mockRejectedValue(new Error("fora do ar"));
    const { GET } = await rota();
    const res = await GET(pedido("code=abc&idioma=nl&fuso=Europe%2FBrussels"));
    expect(await destino(res)).toBe("/get-started");
  });
});
