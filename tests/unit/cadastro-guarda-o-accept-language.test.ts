/**
 * U51 — o cadastro guarda na conta o `Accept-Language` de quem se cadastra.
 *
 * No cadastro aberto, o `/auth/confirm` passa o cabeçalho do PRÓPRIO navegador
 * ao provisionamento: é a pista de país de quem não tem fuso reconhecido
 * (Firefox com resistFingerprinting manda UTC). No modo `com_aprovacao` a
 * empresa nasce na aprovação, com o navegador do administrador — o da pessoa
 * só existe se ficou guardado na conta. Saneado: só caracteres de etiqueta de
 * idioma, tamanho limitado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { modoDeCadastro } from "@/lib/auth/politica-de-cadastro";
import { acceptLanguageParaGuardar, CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO } from "@/lib/auth/perfil-da-empresa-nova";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ auth: { admin: {} }, from: vi.fn() })) }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth/politica-de-cadastro", () => ({ modoDeCadastro: vi.fn(async () => "com_aprovacao") }));
vi.mock("@/lib/instalacao/modulos", () => ({ moduloLigado: vi.fn(async () => false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<Record<string, unknown>>()), audit: vi.fn(async () => undefined) }));

const signUpDoProvedor = vi.fn();
let n = 0;
const entrada = () => ({
  org_name: "Empresa Exemplo",
  email: `pista-${++n}-${Date.now()}@example.com`,
  password: "SenhaForte!2026",
  password_confirm: "SenhaForte!2026",
});

function comCabecalho(acceptLanguage: string | null) {
  vi.mocked(headers).mockResolvedValue({
    get: (k: string) =>
      k === "x-forwarded-for" ? `192.0.2.${(n % 200) + 20}` : k === "accept-language" ? acceptLanguage : null,
  } as never);
}

function dadosGravados(): Record<string, unknown> {
  const chamada = signUpDoProvedor.mock.calls[0]?.[0] as { options?: { data?: Record<string, unknown> } };
  return chamada?.options?.data ?? {};
}

describe("acceptLanguageParaGuardar", () => {
  it("guarda o cabeçalho de um navegador", () => {
    expect(acceptLanguageParaGuardar("nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7");
    expect(acceptLanguageParaGuardar(" tr-TR ")).toBe("tr-TR");
  });

  it.each([null, undefined, 42, "", "nl-BE<script>", "x".repeat(201)])("recusa %s", (bruto) => {
    expect(acceptLanguageParaGuardar(bruto)).toBeUndefined();
  });
});

describe("signUp guarda o Accept-Language na conta", () => {
  beforeEach(() => {
    vi.resetModules();
    signUpDoProvedor.mockReset();
    signUpDoProvedor.mockResolvedValue({ data: { user: { id: "u-1" }, session: null }, error: null });
    vi.mocked(createClient).mockResolvedValue({ auth: { signUp: signUpDoProvedor } } as never);
    vi.mocked(modoDeCadastro).mockResolvedValue("com_aprovacao");
  });

  it("nl-BE: o cabeçalho vai para a chave do cadastro, junto com as outras pistas", async () => {
    comCabecalho("nl-BE,nl;q=0.9");
    const { signUp } = await import("@/app/actions/auth/signUp");
    await signUp(entrada(), undefined, { idioma: "nl" });
    expect(dadosGravados()[CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO]).toBe("nl-BE,nl;q=0.9");
    expect(dadosGravados().idioma_do_cadastro).toBe("nl");
  });

  it("sem cabeçalho, ou cabeçalho adulterado, a chave não existe", async () => {
    comCabecalho("nl<script>");
    const { signUp } = await import("@/app/actions/auth/signUp");
    await signUp(entrada(), undefined, { idioma: "nl" });
    expect(dadosGravados()).not.toHaveProperty(CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO);
  });
});
