/**
 * Login e cadastro só mostram "Entrar com Google" quando o provedor não está
 * desligado. O estado vem de `estadoDoProvedorGoogle` (mockado aqui); só um
 * `desligado` esconde — `desconhecido` mostra, como a action já tratava.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  estado: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: null } })),
}));

vi.mock("@/lib/auth/provedor-google", () => ({ estadoDoProvedorGoogle: mocks.estado }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: vi.fn(async () => ({ nome: "Marca" })) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/cobranca/cadastro", () => ({
  lerCadastroNaTela: vi.fn(async () => ({ oferecidos: [], exigeEscolha: false, padraoId: null })),
  planoInicialDoSeletor: vi.fn(() => null),
}));
vi.mock("@/lib/auth/politica-de-cadastro", () => ({ modoDeCadastro: vi.fn(async () => "aberto") }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: vi.fn(async () => "pt-BR") }));
vi.mock("@/lib/i18n/dicionario", () => ({ traduzir: (texto: string) => texto }));
vi.mock("@/components/auth/LoginForm", () => ({ LoginForm: () => null }));
vi.mock("@/components/auth/SignupForm", () => ({ SignupForm: () => null }));
vi.mock("@/components/auth/EntrarComGoogle", () => ({
  EntrarComGoogle: () => <button>BOTAO-GOOGLE</button>,
}));

async function renderLogin() {
  const { default: Page } = await import("@/app/(public)/login/page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}
async function renderSignup() {
  const { default: Page } = await import("@/app/(public)/signup/page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}

describe.each([
  ["login", renderLogin],
  ["cadastro", renderSignup],
])("tela de %s", (_nome, render) => {
  beforeEach(() => {
    vi.resetModules();
    mocks.estado.mockReset();
  });

  it("esconde o botão do Google quando o provedor está desligado", async () => {
    mocks.estado.mockResolvedValue("desligado");
    expect(await render()).not.toContain("BOTAO-GOOGLE");
  });

  it("mostra o botão quando o provedor está ligado", async () => {
    mocks.estado.mockResolvedValue("ligado");
    expect(await render()).toContain("BOTAO-GOOGLE");
  });

  it("mostra o botão quando não deu para ler o estado", async () => {
    mocks.estado.mockResolvedValue("desconhecido");
    expect(await render()).toContain("BOTAO-GOOGLE");
  });
});
