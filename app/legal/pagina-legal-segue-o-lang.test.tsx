/**
 * U38.a — o "Voltar" do topo e o título da aba das páginas legais seguem o
 * `?lang=` escolhido, não o idioma do navegador.
 *
 * S2a Task 15 / U38 — a política e os termos saem na língua escolhida
 * (`?lang=`, senão a do visitante), com ou sem sessão: o mesmo texto, do
 * catálogo, para os dois.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Dicionario from "@/lib/i18n/dicionario";

const busca = vi.hoisted(() => ({ lang: null as string | null }));
const estado = vi.hoisted(() => ({
  usuario: null as { id: string; user_metadata?: { locale?: string } } | null,
  idiomaDoVisitante: "pt-BR",
  pais: "BE" as string | null,
  cnpj: "0123.456.749" as string | null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(busca.lang ? `lang=${busca.lang}` : ""),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "nl-BE" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => (estado.usuario ? { ...estado.usuario, idioma: estado.idiomaDoVisitante } : null),
}));
vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: estado.pais }) }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => estado.idiomaDoVisitante }));
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
    razaoSocial: "Acme BV",
    cnpj: estado.cnpj,
    dpoEmail: null,
    politicaPropria: null,
    resolvido: Boolean(estado.usuario),
    pais: estado.pais,
  }),
  nomeDoOperador: (op: { razaoSocial: string | null }, sem: string) => op.razaoSocial ?? sem,
}));
vi.mock("@/lib/i18n/dicionario", async (original) => {
  const real = await original<typeof Dicionario>();
  return { ...real, traduzir: vi.fn(real.traduzir) };
});

import { VoltarDaPaginaLegal } from "@/components/legal/VoltarDaPaginaLegal";
import LegalLayout from "./layout";
import PrivacyPage, { generateMetadata } from "./privacy/page";
import TermsPage, { generateMetadata as metadataDosTermos } from "./terms/page";
import { entradaDoCatalogo } from "@/lib/i18n/catalogos";
import { traduzir } from "@/lib/i18n/dicionario";

const rotulos = { nl: "Terug", fr: "Retour", tr: "Geri" };

const COM_SESSAO = { id: "u1", user_metadata: { locale: "pt-BR" } };

beforeEach(() => {
  busca.lang = null;
  estado.usuario = null;
  estado.idiomaDoVisitante = "pt-BR";
  estado.pais = "BE";
  estado.cnpj = "0123.456.749";
  vi.mocked(traduzir).mockClear();
});

/** Palavras que só o português tem e que estas duas páginas usam a cada parágrafo. */
const PORTUGUES = /\b(serviço|prestador|contrato|empresa|dados|você|não|conversas)\b/i;

/** Toda frase que a página pediu ao dicionário existe no catálogo da língua. */
function frasesSemTraducao(lingua: "nl" | "fr"): string[] {
  return vi
    .mocked(traduzir)
    .mock.calls.filter(([, idioma]) => idioma === lingua)
    .map(([texto]) => texto)
    .filter((texto) => entradaDoCatalogo(lingua, texto) === undefined);
}

const abrirPolitica = async (lang?: string) =>
  render(await PrivacyPage({ searchParams: Promise.resolve(lang ? { lang } : {}) })).container;
const abrirTermos = async (lang?: string) =>
  render(await TermsPage({ searchParams: Promise.resolve(lang ? { lang } : {}) })).container;

describe("Voltar do topo", () => {
  it.each([["fr", "Retour"], ["tr", "Geri"], ["nl", "Terug"]])("?lang=%s → %s", (lang, esperado) => {
    busca.lang = lang;
    render(<VoltarDaPaginaLegal padrao="Terug" rotulos={rotulos} aceitaLang />);
    expect(screen.getByRole("link").textContent).toBe(esperado);
  });
  it("sem ?lang= vale o padrão (navegador)", () => {
    busca.lang = null;
    render(<VoltarDaPaginaLegal padrao="Terug" rotulos={rotulos} aceitaLang />);
    expect(screen.getByRole("link").textContent).toBe("Terug");
  });
  it("fora da Bélgica ou com sessão, ?lang= é ignorado (a página também o ignora)", () => {
    busca.lang = "fr";
    render(<VoltarDaPaginaLegal padrao="Voltar" rotulos={rotulos} aceitaLang={false} />);
    expect(screen.getByRole("link").textContent).toBe("Voltar");
  });
});

describe("título da aba da política", () => {
  it("?lang=tr com navegador em holandês: título em turco", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "tr" }) });
    expect(meta.title).toBe("Gizlilik Politikası");
  });
  it("?lang=fr: título em francês", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "fr" }) });
    expect(String(meta.title)).not.toBe("Privacyverklaring");
  });
  it("?lang=fr com sessão: título em francês também", async () => {
    estado.usuario = COM_SESSAO;
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "fr" }) });
    expect(meta.title).toBe("Déclaration de confidentialité");
  });
});

describe("política: com e sem sessão, o mesmo texto", () => {
  it.each(["nl", "fr"] as const)("?lang=%s: quem tem sessão lê exatamente o que o visitante lê", async (lang) => {
    const semSessao = (await abrirPolitica(lang)).innerHTML;
    estado.usuario = COM_SESSAO;
    const comSessao = (await abrirPolitica(lang)).innerHTML;
    expect(comSessao).toBe(semSessao);
  });

  it("sem ?lang=, os dois leem na língua do visitante", async () => {
    estado.idiomaDoVisitante = "nl";
    const semSessao = (await abrirPolitica()).innerHTML;
    estado.usuario = COM_SESSAO;
    const comSessao = (await abrirPolitica()).innerHTML;
    expect(comSessao).toBe(semSessao);
    expect(comSessao).toContain("Privacyverklaring");
  });

  it("?lang=fr vence a língua do visitante, com sessão e sem", async () => {
    estado.idiomaDoVisitante = "nl";
    expect((await abrirPolitica("fr")).querySelector("h1")?.textContent).toBe("Déclaration de confidentialité");
    estado.usuario = COM_SESSAO;
    expect((await abrirPolitica("fr")).querySelector("h1")?.textContent).toBe("Déclaration de confidentialité");
  });

  it("francês: BCE e APD, nenhuma frase em português", async () => {
    const pagina = await abrirPolitica("fr");
    const texto = pagina.textContent ?? "";
    expect(texto).toContain("BCE");
    expect(texto).toContain("Autorité de protection des données (APD)");
    expect(texto).not.toContain("Gegevensbeschermingsautoriteit");
    expect(texto.match(PORTUGUES)?.[0] ?? null).toBeNull();
    expect(frasesSemTraducao("fr")).toEqual([]);
    expect(pagina.querySelector('[lang="fr"]')).not.toBeNull();
  });

  it("holandês: KBO e GBA, nenhuma frase em português", async () => {
    const pagina = await abrirPolitica("nl");
    const texto = pagina.textContent ?? "";
    expect(texto).toContain("KBO");
    expect(texto).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(texto.match(PORTUGUES)?.[0] ?? null).toBeNull();
    expect(frasesSemTraducao("nl")).toEqual([]);
    expect(pagina.querySelector('[lang="nl"]')).not.toBeNull();
  });

  it("o seletor de língua aparece numa empresa belga também para quem tem sessão", async () => {
    estado.usuario = COM_SESSAO;
    const links = Array.from((await abrirPolitica("fr")).querySelectorAll("nav a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toEqual(["?lang=nl", "?lang=fr", "?lang=tr"]);
  });
});

describe("U38 — os termos de uso na língua escolhida", () => {
  it.each(["nl", "fr"] as const)("visitante sem sessão, ?lang=%s: nenhuma frase em português", async (lang) => {
    const pagina = await abrirTermos(lang);
    const texto = pagina.textContent ?? "";
    expect(texto).toContain(entradaDoCatalogo(lang, "Termos de Uso")!);
    expect(texto.match(PORTUGUES)?.[0] ?? null).toBeNull();
    expect(frasesSemTraducao(lang)).toEqual([]);
    expect(pagina.querySelector(`[lang="${lang}"]`)).not.toBeNull();
  });

  it("sem ?lang=, vale a língua do visitante, não o português", async () => {
    estado.idiomaDoVisitante = "nl";
    const pagina = await abrirTermos();
    expect(pagina.querySelector("h1")?.textContent).toBe("Gebruiksvoorwaarden");
  });

  it("?lang=fr com sessão também vale", async () => {
    estado.usuario = COM_SESSAO;
    const pagina = await abrirTermos("fr");
    expect(pagina.querySelector("h1")?.textContent).toBe("Conditions d'utilisation");
  });

  it("valor estranho no ?lang= é ignorado", async () => {
    estado.idiomaDoVisitante = "nl";
    expect((await abrirTermos("xx")).querySelector("h1")?.textContent).toBe("Gebruiksvoorwaarden");
  });

  it("o título da aba segue o ?lang=", async () => {
    expect((await metadataDosTermos({ searchParams: Promise.resolve({ lang: "fr" }) })).title).toBe(
      "Conditions d'utilisation",
    );
    expect((await metadataDosTermos({ searchParams: Promise.resolve({ lang: "tr" }) })).title).toBe(
      "Kullanım Koşulları",
    );
  });
});

describe("U38 — o Voltar do layout segue a língua escolhida", () => {
  it("o rótulo padrão é o da língua do visitante", async () => {
    estado.idiomaDoVisitante = "fr";
    const { container } = render(await LegalLayout({ children: null }));
    expect(container.querySelector('a[href="/login"]')?.textContent).toBe("Retour");
  });

  it.each([
    ["instalação fora da Bélgica", { pais: null, usuario: null }],
    ["com sessão", { pais: "BE", usuario: COM_SESSAO }],
  ])("%s: ?lang=fr também troca o Voltar", async (_caso, { pais, usuario }) => {
    estado.pais = pais;
    estado.usuario = usuario;
    busca.lang = "fr";
    const { container } = render(await LegalLayout({ children: null }));
    expect(container.querySelector('a[href="/login"]')?.textContent).toBe("Retour");
  });
});
