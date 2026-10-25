/**
 * Cadastro com escolha de plano obrigatoria e Google DESLIGADO (F8).
 *
 * A frase "conclua o cadastro com e-mail e senha" explica por que o botao do
 * Google some. Com o provedor desligado o botao ja nao existe, e a frase ficava
 * sozinha na tela. E a leitura do Google nao pode ser paga no cadastro "so por
 * convite", que nem mostra o botao.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  estado: vi.fn(),
  modo: vi.fn(async () => "aberto"),
}));

vi.mock("@/lib/auth/provedor-google", () => ({ estadoDoProvedorGoogle: mocks.estado }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: vi.fn(async () => ({ nome: "Marca" })) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/cobranca/cadastro", () => ({
  lerCadastroNaTela: vi.fn(async () => ({ oferecidos: [], exigeEscolha: true, padraoId: null })),
  planoInicialDoSeletor: vi.fn(() => null),
}));
vi.mock("@/lib/auth/politica-de-cadastro", () => ({ modoDeCadastro: mocks.modo }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: vi.fn(async () => "pt-BR") }));
vi.mock("@/lib/i18n/dicionario", () => ({ traduzir: (texto: string) => texto }));
vi.mock("@/components/auth/SignupForm", () => ({ SignupForm: () => null }));
vi.mock("@/components/auth/EntrarComGoogle", () => ({
  EntrarComGoogle: () => <button>BOTAO-GOOGLE</button>,
}));

const AVISO = "conclua o cadastro com e-mail e senha";

async function renderSignup() {
  const { default: Page } = await import("@/app/(public)/signup/page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  vi.resetModules();
  mocks.estado.mockReset();
  mocks.modo.mockReset();
  mocks.modo.mockResolvedValue("aberto");
});

describe("aviso 'conclua com e-mail e senha'", () => {
  it("Google desligado: o aviso some junto com o botao", async () => {
    mocks.estado.mockResolvedValue("desligado");
    const html = await renderSignup();
    expect(html).not.toContain(AVISO);
    expect(html).not.toContain("BOTAO-GOOGLE");
  });

  it("Google ligado: o aviso explica por que nao ha botao", async () => {
    mocks.estado.mockResolvedValue("ligado");
    const html = await renderSignup();
    expect(html).toContain(AVISO);
    expect(html).not.toContain("BOTAO-GOOGLE");
  });

  it("so por convite: a leitura do Google nem acontece", async () => {
    mocks.modo.mockResolvedValue("so_convite");
    mocks.estado.mockResolvedValue("ligado");
    await renderSignup();
    expect(mocks.estado).not.toHaveBeenCalled();
  });
});
