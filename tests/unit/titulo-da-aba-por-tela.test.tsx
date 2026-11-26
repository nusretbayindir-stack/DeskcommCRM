/**
 * O TÍTULO DA ABA DE CADA TELA, MEDIDO NO IDIOMA DE QUEM ABRE (U43).
 *
 * Um caso por forma de declarar o título: o layout só de título (arquivo do
 * fork, as telas embaixo herdam) e a linha `tituloDaAba` na própria página
 * (onde o segmento já tem um layout do projeto de origem). Cada um em pt-BR,
 * turco, holandês e francês, com o texto exato — o mesmo nome que o menu dá
 * à tela.
 */
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadAuthUser: vi.fn(),
  idiomaDoVisitante: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: mocks.loadAuthUser,
  requireAuth: vi.fn(),
  resolveActiveOrg: vi.fn(),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: mocks.idiomaDoVisitante }));
vi.mock("@/lib/instalacao/config", async () =>
  (await import("@/tests/helpers/instalacao-sem-pais-declarado")).instalacaoSemPaisDeclarado(),
);

beforeEach(() => {
  mocks.loadAuthUser.mockReset();
  mocks.idiomaDoVisitante.mockReset();
});

type Gerador = () => Promise<{ title?: unknown }>;

const CASOS: ReadonlyArray<{
  tela: string;
  carregar: () => Promise<{ generateMetadata: Gerador }>;
  esperado: Record<"pt-BR" | "tr" | "nl" | "fr", string>;
}> = [
  {
    tela: "Agentes (layout só de título em app/app/ai/agents)",
    carregar: () => import("@/app/app/ai/agents/layout"),
    esperado: { "pt-BR": "Agentes", tr: "Asistanlar", nl: "Assistenten", fr: "Assistants" },
  },
  {
    tela: "Plano e cobrança (layout só de título em app/app/settings/billing)",
    carregar: () => import("@/app/app/settings/billing/layout"),
    esperado: { "pt-BR": "Plano e cobrança", tr: "Plan ve ödeme", nl: "Plan en facturatie", fr: "Formule et facturation" },
  },
  {
    tela: "Empresas (linha na própria página, app/app/companies)",
    carregar: () => import("@/app/app/companies/page"),
    esperado: { "pt-BR": "Empresas", tr: "Şirketler", nl: "Bedrijven", fr: "Entreprises" },
  },
];

describe("o título da aba de cada tela", () => {
  for (const caso of CASOS) {
    for (const idioma of ["pt-BR", "tr", "nl", "fr"] as const) {
      it(`${caso.tela} — ${idioma}`, async () => {
        mocks.loadAuthUser.mockResolvedValue({ idioma });
        const { generateMetadata } = await caso.carregar();
        expect(await generateMetadata()).toEqual({ title: caso.esperado[idioma] });
      });
    }
  }

  it("o layout só de título devolve a tela sem embrulho", async () => {
    const { default: Layout } = await import("@/app/app/ai/agents/layout");
    const tela = <p>tela</p>;
    const saida = Layout({ children: tela });
    expect(isValidElement(saida)).toBe(true);
    expect(saida).toBe(tela);
  });
});
