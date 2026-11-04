import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { signInviteToken } from "@/lib/auth/invite-token";

const visitante = vi.hoisted(() => ({ idioma: "pt-BR" as "pt-BR" | "es" | "tr" }));
const empresa = vi.hoisted(() => ({
  linha: { status: "active" } as { status: string } | null,
  erro: null as { message: string } | null,
  orgLida: null as unknown,
}));
beforeEach(() => {
  visitante.idioma = "pt-BR";
  empresa.linha = { status: "active" };
  empresa.erro = null;
  empresa.orgLida = null;
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_coluna: string, valor: unknown) => {
          empresa.orgLida = valor;
          return { maybeSingle: async () => ({ data: empresa.linha, error: empresa.erro }) };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/branding/saida", () => ({
  marcaDaSaida: async () => ({ nome: "Marca sintética" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  authRateLimited: async () => false,
  AUTH_LIMITS: { invite_accept: {} },
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => visitante.idioma }));
vi.mock("@/lib/auth/politica-de-cadastro", () => ({ modoDeCadastro: async () => "aberto" }));
vi.mock("@/components/auth/LoginForm", () => ({
  LoginForm: ({ email, next }: { email?: string; next?: string }) => (
    <input data-next={next} defaultValue={email} />
  ),
}));
vi.mock("@/components/auth/SignupForm", () => ({ SignupForm: () => null }));
vi.mock("@/components/auth/EntrarComGoogle", () => ({ EntrarComGoogle: () => null }));
vi.mock("@/app/team/accept-invite/[token]/AcceptInviteForm", () => ({
  AcceptInviteForm: () => null,
}));

const token = signInviteToken({
  invite_id: "e9f1fd0c-8d64-4d33-b7e2-793856166df2",
  organization_id: "9093db4b-9d09-4a65-8f76-caf4c0b09a13",
  email: "pessoa@example.test",
  role: "agent",
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const destino = `/team/accept-invite/${token}`;

describe("convite de empresa que ainda não está ativa", () => {
  const abrir = async () => {
    const Page = (await import("@/app/team/accept-invite/[token]/page")).default;
    return renderToStaticMarkup(await Page({ params: Promise.resolve({ token }) }));
  };

  it("⭐ empresa suspensa: diz o motivo e não manda criar conta para nada", async () => {
    empresa.linha = { status: "suspended" };
    const html = await abrir();

    expect(html).toContain("a empresa ainda não está ativa");
    expect(html).not.toContain("Criar minha conta");
    expect(html).not.toContain("expirado");
    // O id lido é o do token assinado, nunca um valor do pedido.
    expect(empresa.orgLida).toBe("9093db4b-9d09-4a65-8f76-caf4c0b09a13");
  });

  it("em turco", async () => {
    empresa.linha = { status: "suspended" };
    visitante.idioma = "tr";
    expect(await abrir()).toContain("şirket henüz açık değil");
  });

  it("empresa ativa segue o caminho de sempre", async () => {
    expect(await abrir()).toContain("Criar minha conta");
  });

  it("leitura que falhou não fecha o convite: segue o caminho de sempre", async () => {
    empresa.linha = null;
    empresa.erro = { message: "falhou" };
    expect(await abrir()).toContain("Criar minha conta");
  });
});

describe("convite acompanha os dois caminhos", () => {
  it("destaca criar conta e preserva o token nas duas opções", async () => {
    const Page = (await import("@/app/team/accept-invite/[token]/page")).default;
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ token }) }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = doc.querySelectorAll("a");
    expect(links[0]?.textContent).toBe("Criar minha conta");
    expect(links[0]?.className).toContain("bg-primary");
    expect(links[0]?.getAttribute("href")).toBe(`/signup?invite=${encodeURIComponent(token)}`);
    expect(links[1]?.textContent).toBe("Já tenho conta? Entrar");
    expect(links[1]?.getAttribute("href")).toBe(`/login?next=${encodeURIComponent(destino)}`);
    expect(html).toContain("pessoa@example.test");
  });
  it("login preenche só e-mail de convite válido e mantém cadastro vinculado", async () => {
    const Page = (await import("@/app/(public)/login/page")).default;
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ next: destino }) }),
    );
    expect(html).toContain('value="pessoa@example.test"');
    expect(html).toContain(`/signup?invite=${encodeURIComponent(token)}`);
    const invalido = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ next: destino + "x" }) }),
    );
    expect(invalido).not.toContain('value="pessoa@example.test"');
    const semConvite = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(semConvite).not.toContain('value="pessoa@example.test"');
    expect(semConvite).toContain('href="/signup"');
    const vencido = signInviteToken({
      invite_id: "e9f1fd0c-8d64-4d33-b7e2-793856166df2",
      organization_id: "9093db4b-9d09-4a65-8f76-caf4c0b09a13",
      email: "pessoa@example.test",
      role: "agent",
      exp: 1,
    });
    const expirado = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ next: `/team/accept-invite/${vencido}` }),
      }),
    );
    expect(expirado).not.toContain('value="pessoa@example.test"');
    expect(expirado).toContain('href="/signup"');
  });
  it("cadastro conserva convite quando a pessoa decide entrar", async () => {
    const Page = (await import("@/app/(public)/signup/page")).default;
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ invite: token }) }),
    );
    expect(html).toContain(`/login?next=${encodeURIComponent(destino)}`);
  });
  it("os dois caminhos do convite estão traduzidos para quem chega em espanhol", async () => {
    visitante.idioma = "es";
    const Page = (await import("@/app/team/accept-invite/[token]/page")).default;
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(await Page({ params: Promise.resolve({ token }) })),
      "text/html",
    );
    expect(doc.querySelectorAll("a")[0]?.textContent).toBe("Crear mi cuenta");
    expect(doc.querySelectorAll("a")[1]?.textContent).toBe("¿Ya tienes cuenta? Iniciar sesión");
    expect(doc.body.textContent).toContain("Usa el correo");
    expect(doc.body.textContent).toContain("para unirte al equipo que te invitó");
  });
});
