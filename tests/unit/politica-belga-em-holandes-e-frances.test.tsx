/**
 * O cliente belga da empresa cliente abre /legal/privacy sem sessão. O produto não
 * tinha holandês nem francês, e o texto saía em português: ele não conseguia ler.
 *
 * A página servia texto fixo nessas duas línguas, só para o visitante sem sessão
 * numa instalação da Bélgica. Desde a S2a Task 15 esse texto mora no catálogo
 * (`tests/unit/politica-belga-mora-no-catalogo.test.ts`), a língua vem de
 * `?lang=` ou de `idiomaDoVisitante`, e quem tem sessão lê o mesmo texto. Os
 * casos abaixo são os mesmos de antes, medidos na página em vez de nos helpers
 * que saíram (`idiomaBelgaDoCabecalho`, `POLITICA_BELGA`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Dicionario from "@/lib/i18n/dicionario";

const estado = vi.hoisted(() => ({
  cabecalho: null as string | null,
  pais: "BE" as string | null,
  dpo: null as string | null,
  usuario: null as { id: string; idioma?: string; user_metadata?: { locale?: string } } | null,
  org: null as { orgId: string } | null,
  linha: null as Record<string, unknown> | null,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(estado.cabecalho ? { "accept-language": estado.cabecalho } : {}),
}));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Marca da Revenda" }) }));
vi.mock("@/lib/instalacao/config", () => ({
  valorDaInstalacao: async (chave: string) => ({
    valor: chave === "PAIS_DA_INSTALACAO" ? estado.pais : chave === "LGPD_DPO_EMAIL" ? estado.dpo : null,
    fonte: "banco",
  }),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => estado.usuario,
  orgAtivaSemPortao: async () => estado.org,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: estado.linha, error: null }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/i18n/IdiomaProvider", () => ({
  IdiomaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/i18n/dicionario", async (original) => {
  const real = await original<typeof Dicionario>();
  return { ...real, traduzir: vi.fn(real.traduzir) };
});

import LegalLayout from "@/app/legal/layout";
import PrivacyPage, { generateMetadata } from "@/app/legal/privacy/page";
import { entradaDoCatalogo } from "@/lib/i18n/catalogos";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * A política belga como o visitante a lê hoje: as frases publicadas (a cópia
 * congelada), com o texto que o catálogo dá para cada uma.
 */
const PUBLICADA = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "politica-belga", "publicada.json"), "utf8"),
) as Record<"nl" | "fr", Record<string, string>>;
const POLITICA_BELGA = {
  nl: Object.fromEntries(Object.keys(PUBLICADA.nl).map((chave) => [chave, entradaDoCatalogo("nl", chave) ?? chave])),
  fr: Object.fromEntries(Object.keys(PUBLICADA.fr).map((chave) => [chave, entradaDoCatalogo("fr", chave) ?? chave])),
};

/** Em que língua belga a página abriu, ou `null` quando seguiu o caminho de sempre. */
async function idiomaBelgaDaPagina(cabecalho: string | null): Promise<"nl" | "fr" | null> {
  estado.cabecalho = cabecalho;
  const lingua = (await abrir()).querySelector("div[lang]")?.getAttribute("lang");
  return lingua === "nl" || lingua === "fr" ? lingua : null;
}

const abrir = async (lang?: string) => {
  const { container } = render(await PrivacyPage({ searchParams: Promise.resolve({ lang }) }));
  return container;
};

beforeEach(() => {
  estado.cabecalho = null;
  estado.pais = "BE";
  estado.dpo = null;
  estado.usuario = null;
  estado.org = null;
  estado.linha = null;
  vi.mocked(traduzir).mockClear();
});

describe("qual língua o navegador pede", () => {
  it.each([
    ["nl-BE,nl;q=0.9,en;q=0.8", "nl"],
    ["fr-BE,fr;q=0.9,en;q=0.8", "fr"],
    // Inglês não é língua do produto: passa para a próxima da lista.
    ["en-US,en;q=0.9,fr;q=0.8", "fr"],
    // A ordem é a do `q`, não a da escrita.
    ["nl;q=0.5,fr;q=0.9", "fr"],
    // Língua que o produto serve vem antes: o caminho de sempre atende.
    ["tr,nl;q=0.8", null],
    ["pt-BR,nl;q=0.5", null],
    ["es,fr;q=0.5", null],
  ])("%s → %s", async (cabecalho, esperado) => {
    expect(await idiomaBelgaDaPagina(cabecalho)).toBe(esperado);
  });

  it.each([["de-DE,de;q=0.9"], ["en-US"], [""], [null]])(
    "%s não diz nada que sirva: abre em holandês, com o link para o francês",
    async (cabecalho) => {
      expect(await idiomaBelgaDaPagina(cabecalho)).toBe("nl");
    },
  );
});

describe("o texto fixo está inteiro", () => {
  it("as duas línguas têm as mesmas chaves", () => {
    expect(Object.keys(POLITICA_BELGA.nl).length).toBeGreaterThan(30);
    expect(Object.keys(POLITICA_BELGA.fr).sort()).toEqual(Object.keys(POLITICA_BELGA.nl).sort());
  });

  it.each(["nl", "fr"] as const)("%s: cada marcador da chave continua no texto", (lingua) => {
    for (const [chave, texto] of Object.entries(POLITICA_BELGA[lingua])) {
      const marcadores = (t: string) => (t.match(/\{[a-z]+\}/g) ?? []).sort();
      expect(marcadores(texto), chave).toEqual(marcadores(chave));
    }
  });

  it.each(["nl", "fr"] as const)("%s: nenhum vocabulário brasileiro nem português sobrou", (lingua) => {
    const proibido = /LGPD|\bCPF\b|CNPJ|controlador|subcontratante|prestador|\bempresa\b|\bdados\b/i;
    for (const texto of Object.values(POLITICA_BELGA[lingua])) {
      expect(texto).not.toMatch(proibido);
    }
  });

  it("os direitos do texto belga são os da Bijlage 3 do contrato", () => {
    const chave = Object.keys(POLITICA_BELGA.nl).find((c) => c.startsWith("O RGPD garante-lhe"))!;
    expect(POLITICA_BELGA.nl[chave]).toMatch(/beperk/);
    expect(POLITICA_BELGA.nl[chave]).toMatch(/overdra/);
    expect(POLITICA_BELGA.nl[chave]).toMatch(/bezwaar/);
    expect(POLITICA_BELGA.fr[chave]).toMatch(/limitation/);
    expect(POLITICA_BELGA.fr[chave]).toMatch(/portabilité/);
    expect(POLITICA_BELGA.fr[chave]).toMatch(/opposer/);
  });
});

describe("sem sessão, numa instalação da Bélgica", () => {
  it("navegador em holandês lê holandês, com os termos do contrato", async () => {
    estado.cabecalho = "nl-BE,nl;q=0.9";
    const pagina = await abrir();
    const texto = pagina.textContent ?? "";

    expect(pagina.querySelector("h1")?.textContent).toBe("Privacyverklaring");
    expect(texto).toContain("verwerkingsverantwoordelijke");
    expect(texto).toContain("Bijlage 2 van de dienstverleningsovereenkomst");
    expect(texto).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(pagina.querySelector('[lang="nl"]')).not.toBeNull();
  });

  it("navegador em francês lê francês, e a autoridade em francês", async () => {
    estado.cabecalho = "fr-BE,fr;q=0.9";
    const pagina = await abrir();
    const texto = pagina.textContent ?? "";

    expect(pagina.querySelector("h1")?.textContent).toBe("Déclaration de confidentialité");
    expect(texto).toContain("responsable du traitement");
    expect(texto).toContain("Autorité de protection des données (APD)");
    expect(texto).toContain("https://www.autoriteprotectiondonnees.be");
    expect(texto).not.toContain("Gegevensbeschermingsautoriteit");
    expect(pagina.querySelector('[lang="fr"]')).not.toBeNull();
  });

  it.each([
    ["nl", "nl-BE", null],
    ["fr", "fr-BE", null],
    ["nl", "nl-BE", "dpo@exemplo.be"],
    ["fr", "fr-BE", "dpo@exemplo.be"],
  ])("%s (%s, encarregado %s): nenhuma frase cai no português", async (lingua, cabecalho, dpo) => {
    // É a catraca: frase nova na página sem a tradução no catálogo sairia em
    // português no meio do holandês, sem erro nenhum. (Antes da Task 15 a
    // catraca era "o dicionário nem é chamado"; hoje o texto vem dele.)
    estado.cabecalho = cabecalho;
    estado.dpo = dpo;
    await abrir();
    const semTraducao = vi
      .mocked(traduzir)
      .mock.calls.map(([texto]) => texto)
      .filter((texto) => entradaDoCatalogo(lingua as "nl" | "fr", texto) === undefined);
    expect(vi.mocked(traduzir)).toHaveBeenCalled();
    expect(semTraducao).toEqual([]);
  });

  it("a escolha no link vence o navegador", async () => {
    estado.cabecalho = "nl-BE";
    expect((await abrir("fr")).querySelector("h1")?.textContent).toBe("Déclaration de confidentialité");
  });

  it("o link do turco leva ao texto turco que o produto já tem", async () => {
    estado.cabecalho = "nl-BE";
    expect((await abrir("tr")).textContent).toContain("sizinle yazışan işletme");
  });

  it("valor estranho no link é ignorado", async () => {
    estado.cabecalho = "nl-BE";
    expect((await abrir("xx")).querySelector("h1")?.textContent).toBe("Privacyverklaring");
  });

  it("navegador em turco continua em turco, com os links para as outras línguas", async () => {
    estado.cabecalho = "tr";
    const pagina = await abrir();
    expect(pagina.textContent).toContain("sizinle yazışan işletme");
    const links = Array.from(pagina.querySelectorAll("nav a")).map((a) => a.getAttribute("href"));
    expect(links).toEqual(["?lang=nl", "?lang=fr", "?lang=tr"]);
  });

  it("a aba e o link de voltar seguem a língua da página", async () => {
    estado.cabecalho = "fr-BE";
    expect((await generateMetadata({ searchParams: Promise.resolve({}) })).title).toBe(
      "Déclaration de confidentialité",
    );
    expect((await generateMetadata({ searchParams: Promise.resolve({ lang: "nl" }) })).title).toBe(
      "Privacyverklaring",
    );
    const { container } = render(await LegalLayout({ children: null }));
    expect(container.querySelector('a[href="/login"]')?.textContent).toBe("Retour");
  });
});

describe("fora desse caso nada muda", () => {
  it("instalação sem país: holandês não abre o texto belga", async () => {
    // Desde que o holandês é idioma do produto (doc S2a, Task 7), o visitante
    // lê a política do PRODUTO traduzida pelo catálogo — a do país padrão, com
    // as seções dela —, e não o texto belga, que tem o seletor de língua.
    estado.pais = null;
    estado.cabecalho = "nl-BE";
    const pagina = await abrir("nl");
    expect(pagina.querySelector("h1")?.textContent).toBe(entradaDoCatalogo("nl", "Política de Privacidade"));
    expect(pagina.textContent).toContain(entradaDoCatalogo("nl", "1. Quem é o controlador"));
    expect(pagina.querySelector("nav")).toBeNull();
  });

  it("com sessão, vale o idioma da pessoa, mesmo com navegador em holandês", async () => {
    estado.cabecalho = "nl-BE";
    estado.usuario = { id: "u1", idioma: "pt-BR", user_metadata: { locale: "pt-BR" } };
    estado.org = { orgId: "o1" };
    estado.linha = {
      display_name: "Empresa",
      legal_name: null,
      cnpj: null,
      dpo_email: null,
      privacy_policy_url: null,
      country: "BE",
    };
    // Sem escolha no link, vale o idioma da pessoa, e não o navegador.
    const pagina = await abrir();
    expect(pagina.querySelector("h1")?.textContent).toBe("Política de Privacidade");
    expect(pagina.textContent).toContain("1. Quem é o responsável pelo tratamento");
    expect((await generateMetadata({ searchParams: Promise.resolve({}) })).title).not.toBe("Privacyverklaring");
  });

  it("com sessão, a escolha no link vale como para o visitante (S2a Task 15)", async () => {
    estado.cabecalho = "pt-BR";
    estado.usuario = { id: "u1", idioma: "pt-BR", user_metadata: { locale: "pt-BR" } };
    estado.org = { orgId: "o1" };
    estado.linha = {
      display_name: "Empresa",
      legal_name: null,
      cnpj: null,
      dpo_email: null,
      privacy_policy_url: null,
      country: "BE",
    };
    const pagina = await abrir("nl");
    expect(pagina.querySelector("h1")?.textContent).toBe("Privacyverklaring");
    expect(pagina.querySelector("nav")).not.toBeNull();
    expect((await generateMetadata({ searchParams: Promise.resolve({ lang: "nl" }) })).title).toBe(
      "Privacyverklaring",
    );
  });
});
