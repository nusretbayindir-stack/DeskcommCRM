/**
 * S2a Task 15 — Brasil e Portugal não mudam. As páginas legais em português são
 * comparadas, byte a byte, com o HTML que saía antes da Task 15 (gravado em
 * `__snapshots__/` a partir da `main` de antes da mudança).
 */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  usuario: null as { id: string; user_metadata?: { locale?: string } } | null,
  pais: null as string | null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "pt-BR" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => (estado.usuario ? { ...estado.usuario, idioma: "pt-BR" } : null),
}));
vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: estado.pais }) }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => "pt-BR" }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: estado.usuario } }) } }),
}));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Marca da Revenda" }) }));
vi.mock("@/lib/i18n/IdiomaProvider", () => ({
  IdiomaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/legal/operador", () => ({
  resolverOperador: async () => ({
    sistema: "Marca da Revenda",
    nome: null,
    razaoSocial: "Empresa Teste Ltda",
    cnpj: estado.pais === "PT" ? "500 000 000" : "12.345.678/0001-90",
    dpoEmail: "dpo@example.com",
    politicaPropria: null,
    resolvido: Boolean(estado.usuario),
    pais: estado.pais,
  }),
  nomeDoOperador: (op: { razaoSocial: string | null }, sem: string) => op.razaoSocial ?? sem,
}));

import LegalLayout from "./layout";
import PrivacyPage, { generateMetadata } from "./privacy/page";
import TermsPage, { generateMetadata as metadataDosTermos } from "./terms/page";

beforeEach(() => {
  estado.usuario = null;
  estado.pais = null;
});

const CASOS = [
  ["brasil-sem-sessao", null, null],
  ["brasil-com-sessao", null, { id: "u1", user_metadata: { locale: "pt-BR" } }],
  ["portugal-sem-sessao", "PT", null],
  ["portugal-com-sessao", "PT", { id: "u1", user_metadata: { locale: "pt-BR" } }],
] as const;

describe("português: o HTML das páginas legais não muda", () => {
  it.each(CASOS)("%s", async (nome, pais, usuario) => {
    estado.pais = pais;
    estado.usuario = usuario;
    const sp = () => Promise.resolve({});
    const politica = render(await PrivacyPage({ searchParams: sp() })).container.innerHTML;
    const termos = render(await TermsPage({ searchParams: sp() } as never)).container.innerHTML;
    const layout = render(await LegalLayout({ children: null })).container.innerHTML;
    const titulos = [
      (await generateMetadata({ searchParams: sp() })).title,
      (await metadataDosTermos({ searchParams: sp() } as never)).title,
    ];
    await expect([politica, termos, layout, JSON.stringify(titulos)].join("\n\n")).toMatchFileSnapshot(
      `./__snapshots__/portugues-${nome}.html`,
    );
  });
});
