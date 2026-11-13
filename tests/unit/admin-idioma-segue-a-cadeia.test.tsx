/**
 * O PAINEL DO ADMIN FALA A MESMA CADEIA DE IDIOMA DO APP — E TEM ONDE TROCÁ-LO.
 *
 * ─── O defeito (S2a, decisão D7) ────────────────────────────────────────────
 *
 * `app/admin/(protected)/layout.tsx` entregava ao `IdiomaProvider` só o
 * `user_metadata.locale` da pessoa. Quem nunca escolheu idioma, mas trabalha
 * numa empresa em holandês, abria o painel em PORTUGUÊS — enquanto o app
 * (`/app`) da mesma conta abria em holandês, porque lá o idioma vem da cadeia
 * de `loadAuthUser` (pessoa → organização ativa → padrão). E o painel não
 * tinha o `SeletorDeIdioma`: ele só existia no `UserMenu` da casca do tenant,
 * então a única saída era ir a `/app`, trocar, e voltar.
 *
 * ─── O que se guarda ────────────────────────────────────────────────────────
 *
 *   - sem preferência própria, empresa ativa em `nl` → o painel em `nl`;
 *   - preferência própria `tr` → `tr` (o controle: a pessoa vence a empresa);
 *   - sem resposta da cadeia (não deveria acontecer depois do
 *     `requirePlatformAdmin`) → a preferência da pessoa, não uma tela quebrada;
 *   - o seletor está DENTRO da barra do topo do painel (`<header>`), mostra o
 *     idioma em vigor e abre um menu.
 *
 * O dublê está em `loadAuthUser`, na forma que ele responde (`locale` cru e
 * `idioma` já resolvido): a cadeia em si é guardada onde mora, em
 * `lib/auth/server.ts`. Mesmo recorte de `admin-forbidden-segue-o-idioma-da-empresa`.
 *
 * Sabotagem que confirma a guarda: voltar o layout a ler só o
 * `user_metadata.locale` deixa vermelho o caso da empresa em `nl`; tirar
 * `<SeletorDeIdioma />` do header do `AdminShell` deixa vermelho o caso do seletor.
 *
 * Confira com: pnpm vitest run tests/unit/admin-idioma-segue-a-cadeia.test.tsx
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const estado = vi.hoisted(() => ({
  metadado: {} as Record<string, unknown>,
  cadeia: null as null | { locale: string | null; idioma: string },
}));

vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdmin: async () => ({
    user: { id: "u-1", email: "dono@exemplo.invalid", user_metadata: estado.metadado },
  }),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => estado.cadeia,
}));
vi.mock("@/lib/instalacao/modulos", () => ({ modulosLigados: async () => [] }));
vi.mock("@/lib/email/estado", () => ({ instalacaoSemSmtp: async () => false }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/app/actions/settings/trocarIdioma", () => ({ trocarIdioma: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/inbox",
}));

// O `ThemeProvider` lê `matchMedia`, que o jsdom não implementa — mesmo stub de
// `tests/unit/admin-busca.test.tsx`.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

import ProtectedAdminLayout from "@/app/admin/(protected)/layout";
import { AdminShell } from "@/components/admin/AdminShell";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { ThemeProvider } from "@/lib/theme";

beforeEach(() => {
  estado.metadado = {};
  estado.cadeia = null;
});
afterEach(cleanup);

/** O `locale` que o layout entrega ao `IdiomaProvider`, achado na árvore devolvida. */
function localeDoProvider(no: ReactNode): string | null | undefined {
  if (!isValidElement(no)) return undefined;
  const el = no as ReactElement<{ locale?: string | null; children?: ReactNode }>;
  if (el.type === IdiomaProvider) return el.props.locale;
  const filhos = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
  for (const filho of filhos) {
    const achado = localeDoProvider(filho as ReactNode);
    if (achado !== undefined) return achado;
  }
  return undefined;
}

describe("painel do admin — idioma pela cadeia de loadAuthUser", () => {
  it("sem preferência própria, empresa ativa em holandês: o painel em holandês", async () => {
    estado.cadeia = { locale: null, idioma: "nl" };
    const arvore = await ProtectedAdminLayout({ children: null });
    expect(localeDoProvider(arvore)).toBe("nl");
  });

  it("preferência própria em turco: o painel em turco", async () => {
    estado.metadado = { locale: "tr" };
    estado.cadeia = { locale: "tr", idioma: "tr" };
    const arvore = await ProtectedAdminLayout({ children: null });
    expect(localeDoProvider(arvore)).toBe("tr");
  });

  it("sem resposta da cadeia: a preferência da pessoa", async () => {
    estado.metadado = { locale: "fr" };
    estado.cadeia = null;
    const arvore = await ProtectedAdminLayout({ children: null });
    expect(localeDoProvider(arvore)).toBe("fr");
  });
});

describe("painel do admin — seletor de idioma na barra do topo", () => {
  it("o seletor mora no header do painel, mostra o idioma em vigor e abre um menu", () => {
    render(
      <ThemeProvider>
        <IdiomaProvider locale="nl">
          <AdminShell userEmail="dono@exemplo.invalid">
            <p>conteúdo</p>
          </AdminShell>
        </IdiomaProvider>
      </ThemeProvider>,
    );
    const topo = screen.getByRole("banner");
    const seletor = within(topo).getByTestId("seletor-de-idioma");
    expect(seletor.textContent?.trim()).toBe("NL");
    expect(seletor).toHaveAttribute("aria-haspopup", "menu");
  });
});
