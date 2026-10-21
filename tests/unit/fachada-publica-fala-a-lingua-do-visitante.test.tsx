import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A FACHADA PÚBLICA FALA A LÍNGUA DE QUEM NÃO ENTROU.
 *
 * Medido na v1.85.2, navegador em turco e sem sessão: o título do login dizia
 * "Giriş yap" (a página resolve o idioma por `idiomaDoVisitante`), mas o
 * formulário dizia "Senha" e "Mostrar senha". O formulário é componente
 * cliente e lê o idioma do `IdiomaProvider` da casca, e a casca passava o
 * `user_metadata.locale` cru — `null` para quem não tem sessão, que o provider
 * normaliza para pt-BR. A cadeia do visitante (perfil → Accept-Language →
 * padrão) tem de valer para a casca inteira, e não só para o título.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  idiomaDoVisitante: vi.fn(),
}));

vi.mock("@/lib/branding/saida", () => ({
  marcaDaSaida: vi.fn(async () => ({ nome: "Marca da instalação", logoUrl: null, logoDarkUrl: null })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: mocks.idiomaDoVisitante }));

/**
 * O que o formulário de login faz: lê o idioma da casca pelo `useT`. Importado
 * DEPOIS do `resetModules`, para ser o mesmo contexto que a casca recebe.
 */
async function campoDeSenha() {
  const { useT } = await import("@/lib/i18n/IdiomaProvider");
  return function CampoDeSenha() {
    const t = useT();
    return <label>{t("Senha")}</label>;
  };
}

function sessao(user: unknown) {
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user } })) } });
}

describe("a casca das telas de acesso", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.idiomaDoVisitante.mockReset();
  });

  it("sem sessão, o formulário segue o idioma do navegador", async () => {
    sessao(null);
    mocks.idiomaDoVisitante.mockResolvedValue("tr");
    const { default: PublicLayout } = await import("@/app/(public)/layout");

    const CampoDeSenha = await campoDeSenha();

    const html = renderToStaticMarkup(await PublicLayout({ children: <CampoDeSenha /> }));

    expect(mocks.idiomaDoVisitante).toHaveBeenCalledWith(null);
    expect(html).toContain("<label>Şifre</label>");
  });

  it("com sessão parcial (MFA), o idioma salvo no perfil entra na mesma cadeia", async () => {
    sessao({ user_metadata: { locale: "es" } });
    mocks.idiomaDoVisitante.mockResolvedValue("es");
    const { default: PublicLayout } = await import("@/app/(public)/layout");

    const CampoDeSenha = await campoDeSenha();

    const html = renderToStaticMarkup(await PublicLayout({ children: <CampoDeSenha /> }));

    expect(mocks.idiomaDoVisitante).toHaveBeenCalledWith("es");
    expect(html).toContain("<label>Contraseña</label>");
  });
});
