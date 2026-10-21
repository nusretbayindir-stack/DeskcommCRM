/**
 * O TÍTULO DA ABA FALA O IDIOMA DE QUEM ABRE A PÁGINA.
 *
 * Medido na v1.85.2 com a interface toda em turco: a aba dizia "Funis ·
 * Agenterix", "Entrar · Agenterix" e, nas páginas sem título próprio,
 * "Agenterix — atendimento e vendas por WhatsApp com agentes de IA". Cada
 * página declarava `export const metadata = { title: "…" }`: uma constante, em
 * português, resolvida sem saber quem pediu.
 *
 * O título passa por `tituloDaAba((t) => t("…"))`, que resolve o idioma pela
 * mesma cadeia da tela (perfil → organização → Accept-Language → padrão). O
 * `t("…")` é literal de propósito: as guardas de completude e o
 * `lotes-para-traduzir` só enxergam literal dentro de `t()`.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { arquivosDeCodigo, caminhoRelativo } from "./helpers/varrer-codigo";

const mocks = vi.hoisted(() => ({
  loadAuthUser: vi.fn(),
  idiomaDoVisitante: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ loadAuthUser: mocks.loadAuthUser }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: mocks.idiomaDoVisitante }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "fonte" }) }));
vi.mock("@/lib/branding/instalacao", () => ({
  marcaDaInstalacao: vi.fn(async () => null),
  motivoDoFallback: vi.fn(() => null),
  registrarEstadoDaMarca: vi.fn(),
}));

beforeEach(() => {
  mocks.loadAuthUser.mockReset();
  mocks.idiomaDoVisitante.mockReset();
});

describe("tituloDaAba", () => {
  it("com sessão, o título sai no idioma da pessoa", async () => {
    mocks.loadAuthUser.mockResolvedValue({ idioma: "tr" });
    const { tituloDaAba } = await import("@/lib/i18n/titulo-da-aba");

    expect(await tituloDaAba((t) => t("Funis"))()).toEqual({ title: "Satış hunileri" });
  });

  it("sem sessão, o título segue o navegador", async () => {
    mocks.loadAuthUser.mockResolvedValue(null);
    mocks.idiomaDoVisitante.mockResolvedValue("tr");
    const { tituloDaAba } = await import("@/lib/i18n/titulo-da-aba");

    expect(await tituloDaAba((t) => t("Entrar"))()).toEqual({ title: "Giriş yap" });
    expect(mocks.idiomaDoVisitante).toHaveBeenCalledWith(null);
  });
});

describe("o layout raiz", () => {
  it("o título padrão e a descrição saem no idioma de quem abre", async () => {
    mocks.loadAuthUser.mockResolvedValue({ idioma: "tr" });
    const { generateMetadata } = await import("@/app/layout");

    const metadata = await generateMetadata();
    const titulo = metadata.title as { default: string; template: string };

    expect(titulo.default).not.toContain("atendimento e vendas");
    expect(titulo.default).toContain("WhatsApp");
    expect(titulo.template).toMatch(/^%s · /);
    expect(metadata.description).not.toContain("Centralize o atendimento");
  });
});

/** Vitrines internas, fora da navegação do cliente (ver `FORA_DO_PRODUTO` em i18n-espanhol-cobre-a-tela). */
const FORA_DO_PRODUTO = ["app/design/", "app/vitrine-agenda/"];

describe("toda página de produto", () => {
  const paginas = arquivosDeCodigo(["app"])
    .map((arquivo) => ({ arquivo, rel: caminhoRelativo(arquivo) }))
    .filter(({ rel }) => /(^|\/)(page|layout)\.tsx$/.test(rel))
    .filter(({ rel }) => !FORA_DO_PRODUTO.some((pasta) => rel.startsWith(pasta)));

  it("a varredura enxerga as páginas — o verde abaixo não é vacuidade", () => {
    expect(paginas.map((p) => p.rel)).toEqual(
      expect.arrayContaining(["app/app/crm/page.tsx", "app/(public)/login/page.tsx"]),
    );
  });

  it("nenhuma declara título fixo: o título passa por tituloDaAba", () => {
    const fixas = paginas
      .filter(({ arquivo }) => /^export const metadata\b/m.test(readFileSync(arquivo, "utf8")))
      .map(({ rel }) => rel);
    expect(fixas, `${fixas.length} página(s) com \`export const metadata\` em português fixo`).toEqual([]);
  });
});
