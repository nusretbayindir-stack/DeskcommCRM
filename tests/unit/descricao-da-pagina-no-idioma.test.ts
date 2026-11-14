/**
 * U39 — a descrição da página (`<meta name="description">`) e as palavras-chave
 * contavam o Brasil e a LGPD em todos os idiomas: "Multi-tenant, LGPD-nativo,
 * feito para operações brasileiras." O tr, o nl e o fr já tinham tirado o
 * Brasil, mas afirmavam conformidade com o GDPR — uma afirmação jurídica que a
 * página não pode fazer. O espanhol seguia com LGPD e "operaciones brasileñas".
 *
 * Fora do pt-BR, a descrição passa a ser a frase do produto sem a última
 * sentença (chave com contexto, `@@descricao-da-pagina`), e as palavras-chave
 * não citam lei nenhuma. O pt-BR fica byte a byte como era.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDIOMAS } from "@/lib/i18n/idiomas";

const mocks = vi.hoisted(() => ({ loadAuthUser: vi.fn(), idiomaDoVisitante: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({ loadAuthUser: mocks.loadAuthUser }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: mocks.idiomaDoVisitante }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "fonte" }) }));
vi.mock("@/lib/branding/instalacao", () => ({
  marcaDaInstalacao: vi.fn(async () => null),
  motivoDoFallback: vi.fn(() => null),
  registrarEstadoDaMarca: vi.fn(),
}));

const DESCRICAO_PT =
  "Centralize o atendimento por WhatsApp num funil só. Agentes de IA resolvem o que dá pra resolver e passam para o time humano o que importa — com tudo registrado. Multi-tenant, LGPD-nativo, feito para operações brasileiras.";
const PALAVRAS_PT = ["CRM", "atendimento", "WhatsApp", "IA conversacional", "LGPD", "multi-tenant"];
/** Todo idioma servido fora do pt-BR: um idioma que vire visível entra na régua sozinho. */
const OUTROS = IDIOMAS.filter((idioma) => idioma !== "pt-BR");

async function metadados(idioma: string) {
  mocks.loadAuthUser.mockResolvedValue({ idioma });
  const { generateMetadata } = await import("@/app/layout");
  return generateMetadata();
}

beforeEach(() => {
  mocks.loadAuthUser.mockReset();
  mocks.idiomaDoVisitante.mockReset();
});

describe("U39 — descrição e palavras-chave no idioma de quem abre", () => {
  it("pt-BR: byte a byte como antes", async () => {
    const meta = await metadados("pt-BR");
    expect(meta.description).toBe(DESCRICAO_PT);
    expect(JSON.stringify(meta.keywords)).toBe(JSON.stringify(PALAVRAS_PT));
  });

  it("a régua alcança os quatro idiomas de hoje (o verde abaixo não é vacuidade)", () => {
    expect(OUTROS).toEqual(expect.arrayContaining(["tr", "nl", "fr", "es"]));
  });

  it.each(OUTROS)("%s: nem Brasil, nem LGPD, nem afirmação de GDPR", async (idioma) => {
    const meta = await metadados(idioma);
    const texto = `${meta.description} ${JSON.stringify(meta.keywords)}`;
    expect(texto).not.toMatch(/LGPD|brasil|brazil|brezilya|brésil|braziliaans/i);
    expect(texto).not.toMatch(/GDPR|RGPD|AVG|KVKK/);
    expect(meta.description).not.toBe(DESCRICAO_PT);
    expect(meta.description).toContain("WhatsApp");
    expect(meta.keywords).toEqual(expect.arrayContaining(["CRM", "WhatsApp"]));
    // A lista sai de `.split(", ")`: vírgula sem espaço ou item vazio viraria palavra-chave torta.
    for (const palavra of meta.keywords as string[]) {
      expect(palavra, `${idioma}: "${palavra}"`).toBe(palavra.trim());
      expect(palavra.length, idioma).toBeGreaterThan(0);
      expect(palavra, idioma).not.toContain(",");
    }
  });

  it("a chave com contexto existe em cada catálogo (não é a queda para a frase antiga)", async () => {
    for (const idioma of OUTROS) {
      const meta = await metadados(idioma);
      expect(meta.description, idioma).not.toMatch(/Multi|Çok şirketli|meerdere bedrijven|entreprise/);
    }
  });
});
