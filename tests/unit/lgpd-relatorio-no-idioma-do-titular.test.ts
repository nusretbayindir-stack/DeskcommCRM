// @vitest-environment node
/**
 * O RELATÓRIO DE ACESSO, O E-MAIL QUE O ENTREGA, O ATESTADO DE ANONIMIZAÇÃO E OS
 * AVISOS DO ART. 12.º SAEM NO IDIOMA DO TITULAR (S2a Task 13, D10).
 *
 * Quem lê os quatro é o TITULAR. O relatório, o e-mail e os avisos vão direto a
 * ele; o atestado, a rota que o entrega diz, é "o atestado do pedido, para o
 * titular" — a equipe só o repassa pelo canal do pedido. Então vale a regra das
 * mensagens fixas ao cliente: o idioma do contato; sem ele, o da empresa.
 *
 * Fora da regra, e de propósito:
 * - BRASIL e PORTUGAL saem no texto-fonte, byte a byte (o pt-PT é a chave dos
 *   catálogos). Os arquivos de `tests/fixtures/lgpd-documentos-antes-da-t13/`
 *   foram gravados rodando as entradas de `tests/helpers/lgpd-documentos-de-exemplo.ts`
 *   contra o código ANTERIOR à Task 13 — comparar com eles, e não com trechos, é o
 *   que prova "byte a byte". O Brasil tem ainda os fixtures do doc 88.
 * - Sem idioma (quem chama não passou nenhum), o documento é o de antes, também
 *   na Bélgica: o comportamento antigo é o padrão, não um caso que some.
 *
 * O PDF é conferido em dois níveis: o texto da árvore de React (o mesmo método
 * dos fixtures do doc 88) e, no turco, as BYTES do PDF — a fonte padrão do PDF
 * (Helvetica, WinAnsi) não tem ş, ğ, ı nem İ, e o texto certo na árvore sairia
 * ilegível no papel (medido: "şğıİĞŞ" virava "_ 10 ^").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enviados = vi.hoisted(() => [] as Array<{ subject: string; html: string; text: string }>);
const banco = vi.hoisted(() => ({ org: {} as Record<string, unknown>, agentes: [] as unknown[] }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/email/roteador", () => ({
  sendEmail: vi.fn(async (e: { subject: string; html: string; text: string }) => {
    enviados.push(e);
    return { ok: true, id: "m1" };
  }),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://crm.test" } }));
vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: "" }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
/** Banco falso do coletor: a organização do teste, os agentes no ar e, no resto, nada. */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const linhas = (tabela: string): unknown[] =>
      tabela === "organizations" ? [banco.org] : tabela === "ai_agents" ? banco.agentes : [];
    const consulta = (tabela: string): unknown => {
      const q: unknown = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then")
              return (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) =>
                Promise.resolve({ data: linhas(tabela), error: null, count: 0 }).then(ok, erro);
            if (prop === "maybeSingle" || prop === "single")
              return async () => ({ data: tabela === "organizations" ? banco.org : null, error: null });
            return () => q;
          },
        },
      );
      return q;
    };
    return { from: consulta, rpc: async () => ({ data: null, error: null }) };
  },
}));

import { extractPdfText } from "@/lib/ai/rag/extractors/pdf";
import type { Idioma } from "@/lib/i18n/idiomas";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";
import { AtestadoDeAnonimizacaoPdf, renderAtestadoPdf } from "@/lib/lgpd/atestado-renderer";
import { textoDaDeclaracao } from "@/lib/lgpd/atestado-de-anonimizacao";
import { montarAvisoArt12, prazoDeUmMes } from "@/lib/lgpd/avisos-do-artigo-12";
import { sendExportEmail } from "@/lib/lgpd/email-delivery";
import { collectExportData, type ExportPayload } from "@/lib/lgpd/export-collector";
import { idiomaDoDocumento } from "@/lib/lgpd/idioma-do-documento";
import { idiomaDoTitular } from "@/lib/lgpd/idioma-do-titular";
import { LgpdExportPdf, renderLgpdPdf } from "@/lib/lgpd/pdf-renderer";

import {
  AGENTES_NO_AR,
  MARCA,
  PEDIDO,
  RECEBIDO,
  atestados,
  avisosDe,
  comCpfDaConversa,
  comDocumentoGuardado,
  comTodasAsSecoes,
  linhaDaOrganizacao,
  textos,
} from "../helpers/lgpd-documentos-de-exemplo";

const RAIZ = join(__dirname, "..", "..");
const ANTES = (nome: string) =>
  readFileSync(join(RAIZ, "tests", "fixtures", "lgpd-documentos-antes-da-t13", nome), "utf8");
const DOC88 = (nome: string) =>
  readFileSync(join(RAIZ, "tests", "fixtures", "lgpd-brasil-antes-do-doc88", nome), "utf8");
const fonte = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), "utf8");

/**
 * Português que não pode sobrar num documento em neerlandês, francês ou turco:
 * as letras que só o português tem e as palavras dos textos destes documentos.
 */
const PORTUGUES =
  /[ãõ]|(?<!\p{L})(não|dados|pedido|relatório|titular|solicitação|conversa|mensage(?:m|ns)|contato|contacto|organização|responsável|encarregado|tratamento|prazo|eliminação|apagamento|atendido|ligação|ficheiro|secção|informado|controlador|olá|seus?|suas?|você|foram|está|cópia|direito|criad[oa]|enviada|recebido|registro|compromisso|avisos?|até|pelo|pela|sem|em)(?!\p{L})/iu;
/** O mesmo para o espanhol, só com o que o espanhol não escreve igual. */
const PORTUGUES_NO_ESPANHOL =
  /[ãõ]|(?<!\p{L})(não|dados|relatório|você|mensage(?:m|ns)|ficheiro|ligação|eliminação|solicitação|organização|cópia|seus?|suas?|olá|até|pelo|pela|prazo|contato|atendido|apagamento|recebimento|tratamento|em)(?!\p{L})/iu;
/** O ordinal português dos artigos ("art. 15.º", "n.º 1"). */
const ORDINAL_PORTUGUES = /\d\.º|n\.º/;

const TRADUZIDOS: readonly Idioma[] = ["nl", "fr", "tr", "es"];

/** Português que sobrou no texto, por trecho — a mensagem de falha diz onde. */
function sobras(texto: string, idioma: Idioma): string[] {
  const regua = idioma === "es" ? PORTUGUES_NO_ESPANHOL : PORTUGUES;
  return texto
    .split(/\u0001|\n|<[^>]+>/)
    .map((t) => t.trim())
    .filter((t) => t !== "" && (regua.test(t) || ORDINAL_PORTUGUES.test(t)));
}

beforeEach(() => {
  enviados.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

async function payloads(pais: string | null, fuso: string) {
  banco.org = linhaDaOrganizacao(pais, fuso);
  banco.agentes = AGENTES_NO_AR;
  const pedido = { organizationId: "org-1", requestId: "r1", externalCustomerId: null };
  const cheio = await collectExportData({ ...pedido, contactId: "c1" });
  const vazio = await collectExportData({ ...pedido, contactId: null });
  const rico = comTodasAsSecoes(cheio);
  return { rico, vazio: { ...vazio, generated_at: "2026-10-05T12:34:56.000Z" } as ExportPayload };
}

/** As quatro formas do PDF que os fixtures gravaram, na mesma ordem. */
function pdfs(p: { rico: ExportPayload; vazio: ExportPayload }, idioma?: Idioma): string {
  return [
    LgpdExportPdf({ data: p.rico, unsignedWarning: true, idioma }),
    LgpdExportPdf({ data: comDocumentoGuardado(p.rico), idioma }),
    LgpdExportPdf({ data: comCpfDaConversa(p.rico), idioma }),
    LgpdExportPdf({ data: p.vazio, idioma }),
  ]
    .map((el) => textos(el).join("\u0001"))
    .join("\n=====\n");
}

async function email(pais: string, fuso: string | undefined, idioma?: Idioma) {
  enviados.length = 0;
  await sendExportEmail({
    to: "titular@x.test",
    requestId: PEDIDO,
    signedUrl: "https://storage.test/report.pdf?token=abc",
    signedUrlDados: "https://storage.test/data.json?token=abc",
    expiresAt: new Date("2026-10-08T12:00:00.000Z"),
    marca: MARCA,
    perfil: perfilDoPais(pais),
    fuso,
    idioma,
  });
  return enviados[0]!;
}

function avisos(pais: string, idioma?: Idioma) {
  return avisosDe(perfilDoPais(pais), prazoDeUmMes(RECEBIDO)).map((a) => montarAvisoArt12({ ...a, idioma }));
}

function papeis(idioma?: Idioma): string {
  return atestados()
    .flatMap((dados) =>
      (["hmac-sha256", "sha256"] as const).map((algoritmo) =>
        textos(AtestadoDeAnonimizacaoPdf({ dados, codigo: "A1B2-C3D4-E5F6-7890", algoritmo, idioma })).join(
          "\u0001",
        ),
      ),
    )
    .join("\n=====\n");
}

/** O cliente de banco mínimo da leitura do idioma, contando as idas ao banco. */
function adminDoIdioma(org: string | null, contato: string | null) {
  const chamadas: string[] = [];
  const cadeia = (tabela: string, colunas: string) => {
    const q = {
      eq: () => q,
      maybeSingle: async () => ({
        data:
          tabela === "organizations"
            ? { locale: org, ...(colunas.includes("contacts") ? { contacts: contato ? [{ locale: contato }] : [] } : {}) }
            : null,
        error: null,
      }),
    };
    return q;
  };
  return {
    chamadas,
    admin: {
      from: (tabela: string) => ({
        select: (colunas: string) => {
          chamadas.push(`${tabela}:${colunas}`);
          return cadeia(tabela, colunas);
        },
      }),
    },
  };
}

describe("o idioma do documento: o do titular, senão o da empresa — fora do Brasil e de Portugal", () => {
  it("Brasil e Portugal saem no texto-fonte, seja qual for o idioma resolvido", () => {
    expect(idiomaDoDocumento("BR", "nl")).toBeUndefined();
    expect(idiomaDoDocumento(null, "fr")).toBeUndefined();
    expect(idiomaDoDocumento("PT", "fr")).toBeUndefined();
    expect(idiomaDoDocumento("pt", "tr")).toBeUndefined();
  });

  it("na Bélgica vale o idioma resolvido; o português do produto é o texto-fonte", () => {
    for (const idioma of TRADUZIDOS) expect(idiomaDoDocumento("BE", idioma)).toBe(idioma);
    expect(idiomaDoDocumento("BE", "pt-BR")).toBeUndefined();
    expect(idiomaDoDocumento("BE", undefined)).toBeUndefined();
  });

  it("lê o contato e, sem ele, a empresa; no Brasil e em Portugal nem vai ao banco", async () => {
    for (const pais of ["BR", "PT"]) {
      const { admin, chamadas } = adminDoIdioma("nl", "fr");
      expect(await idiomaDoTitular(admin, { organizationId: "o", contactId: "c", pais })).toBeUndefined();
      expect(chamadas, `${pais} foi ao banco por um idioma que não usa`).toEqual([]);
    }
    const casos: Array<[string | null, string | null, string | null, Idioma | undefined]> = [
      // [idioma da empresa, idioma do contato, id do contato, esperado]
      ["nl", "fr", "c", "fr"],
      ["nl", "tr", "c", "tr"],
      // Um idioma que o produto não serve no contato cai no da empresa (D4/D10).
      ["nl", "en", "c", "nl"],
      ["fr", null, "c", "fr"],
      // Pedido sem contato: o da empresa.
      ["fr", "nl", null, "fr"],
      // Empresa em português e contato sem idioma: o texto-fonte.
      ["pt-BR", null, "c", undefined],
    ];
    for (const [org, contato, contactId, esperado] of casos) {
      const { admin } = adminDoIdioma(org, contato);
      expect(
        await idiomaDoTitular(admin, { organizationId: "o", contactId, pais: "BE" }),
        `empresa ${org}, contato ${contato}`,
      ).toBe(esperado);
    }
  });
});

describe("o relatório de acesso (PDF)", () => {
  it("nl: nenhuma palavra portuguesa; GBA, KBO e a citação em neerlandês; documento nl-BE", async () => {
    const p = await payloads("BE", "Europe/Brussels");
    const texto = pdfs(p, "nl");
    expect(sobras(texto, "nl")).toEqual([]);
    expect(texto).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(texto).toContain("GDPR art. 15 (Verordening (EU) 2016/679)");
    expect(texto).toContain("Ondernemingsnummer (KBO)");
    expect(texto).not.toMatch(/\b(BCE|APD|RGPD)\b/);
    const doc = LgpdExportPdf({ data: p.rico, idioma: "nl" }) as ReactElement<{ language?: string }>;
    expect(doc.props.language).toBe("nl-BE");
  });

  it("fr: nenhuma palavra portuguesa; APD, BCE e a citação em francês; documento fr-BE", async () => {
    const p = await payloads("BE", "Europe/Brussels");
    const texto = pdfs(p, "fr");
    expect(sobras(texto, "fr")).toEqual([]);
    expect(texto).toContain("Autorité de protection des données (APD)");
    expect(texto).toContain("https://www.autoriteprotectiondonnees.be");
    expect(texto).toContain("RGPD art. 15 (Règlement (UE) 2016/679)");
    expect(texto).toContain("Numéro d'entreprise (BCE)");
    expect(texto).not.toMatch(/\b(KBO|GBA|GDPR)\b|Gegevensbeschermingsautoriteit/);
    const doc = LgpdExportPdf({ data: p.rico, idioma: "fr" }) as ReactElement<{ language?: string }>;
    expect(doc.props.language).toBe("fr-BE");
  });

  it("tr: em turco (U40), sem palavra portuguesa", async () => {
    const p = await payloads("BE", "Europe/Brussels");
    const texto = pdfs(p, "tr");
    expect(sobras(texto, "tr")).toEqual([]);
    expect(texto).toContain("Kişisel Verilere Erişim Raporu");
    expect(texto).toContain("GDPR md. 15 (2016/679 sayılı AB Tüzüğü)");
  });

  it("es: sem palavra portuguesa", async () => {
    const p = await payloads("BE", "Europe/Brussels");
    expect(sobras(pdfs(p, "es"), "es")).toEqual([]);
  });

  it("tr: as BYTES do PDF guardam ş, ğ, ı e İ — a fonte do documento traduzido tem as letras", async () => {
    const p = await payloads("BE", "Europe/Brussels");
    const lido = await extractPdfText(await renderLgpdPdf(p.rico, { idioma: "tr" }));
    expect(lido).toContain("Kişisel Verilere Erişim Raporu");
  }, 60_000);

  it("fr: valor de 1 000 ou mais legível nas BYTES do PDF — o separador de milhar do fr-BE (U+202F) não existe na fonte", async () => {
    // Revisão do PR #54 (I-1): `toLocaleString("fr-BE")` separa o milhar com
    // U+202F, que a Liberation Sans não tem; o PDF imprimia "EUR 1/234,50".
    const p = await payloads("BE", "Europe/Brussels");
    const lead = p.rico.leads[0];
    if (!lead) throw new Error("O payload de exemplo perdeu a linha de lead.");
    const comMilhar = { ...p.rico, leads: [{ ...lead, value_cents: 123450, currency: "EUR" }] };
    const lido = await extractPdfText(await renderLgpdPdf(comMilhar, { idioma: "fr" }));
    expect(lido).toMatch(/EUR 1[  ]234,50/);
    expect(lido).not.toContain("1/234");
  }, 60_000);

  it("sem idioma, Portugal e a Bélgica saem byte a byte como antes da Task 13", async () => {
    expect(pdfs(await payloads("PT", "Europe/Lisbon"))).toBe(ANTES("pdf-pt.txt"));
    expect(pdfs(await payloads("BE", "Europe/Brussels"))).toBe(ANTES("pdf-be.txt"));
  });

  it("o Brasil não traduz nem quando recebe idioma: o payload brasileiro sai como sempre", async () => {
    const p = await payloads(null, "America/Sao_Paulo");
    expect(pdfs(p, "nl")).toBe(pdfs(p));
  });
});

describe("o e-mail de entrega", () => {
  it.each([
    ["nl", "nl-BE"],
    ["fr", "fr-BE"],
    ["tr", "tr"],
    ["es", "es"],
  ] as const)("%s: sem palavra portuguesa, html lang %s, citação traduzida", async (idioma, lang) => {
    const { subject, html, text } = await email("BE", "Europe/Brussels", idioma);
    expect(html).toContain(`<html lang="${lang}">`);
    expect(subject).toContain("#3f2a9c10");
    for (const parte of [subject, html, text]) expect(sobras(parte, idioma)).toEqual([]);
    expect(html).toContain("https://storage.test/report.pdf?token=abc");
    expect(text).toContain("https://storage.test/data.json?token=abc");
  });

  it("nl e fr citam a lei no idioma, com o nome que o glossário dá", async () => {
    expect((await email("BE", "Europe/Brussels", "nl")).text).toContain("GDPR art. 15 (Verordening (EU) 2016/679)");
    expect((await email("BE", "Europe/Brussels", "fr")).text).toContain("RGPD art. 15 (Règlement (UE) 2016/679)");
  });

  it("fr: o prazo sai em números (o padrão do francês da Bélgica escreveria \"14 h 00 min 00 s\")", async () => {
    const { text } = await email("BE", "Europe/Brussels", "fr");
    expect(text).toContain("08/10/2026 14:00:00");
    expect(text).not.toMatch(/\d h \d{2} min/);
  });

  it("Portugal com idioma, a Bélgica sem idioma: os de antes, byte a byte", async () => {
    expect(JSON.stringify(await email("PT", "Europe/Lisbon", "nl"), null, 2)).toBe(ANTES("email-pt.json"));
    expect(JSON.stringify(await email("BE", "Europe/Brussels"), null, 2)).toBe(ANTES("email-be.json"));
  });

  it("Brasil com idioma: o do doc 88, byte a byte", async () => {
    expect(JSON.stringify(await email("BR", undefined, "es"), null, 2)).toBe(DOC88("email.json"));
  });
});

describe("os avisos do art. 12.º", () => {
  it.each([
    ["nl", "nl-BE"],
    ["fr", "fr-BE"],
    ["tr", "tr"],
    ["es", "es"],
  ] as const)("%s: os quatro avisos sem palavra portuguesa, html lang %s, motivo escapado", (idioma, lang) => {
    for (const { subject, html, text } of avisos("BE", idioma)) {
      expect(html).toContain(`<html lang="${lang}">`);
      for (const parte of [subject, html, text]) expect(sobras(parte, idioma)).toEqual([]);
    }
    const [, , recusa] = avisos("BE", idioma);
    expect(recusa!.html).toContain("X-1 &lt;b&gt;");
    expect(recusa!.text).toContain("X-1 <b>");
  });

  it("Portugal com idioma, a Bélgica sem idioma: os de antes, byte a byte", () => {
    expect(JSON.stringify(avisos("PT", "fr"), null, 2)).toBe(ANTES("avisos-pt.json"));
    expect(JSON.stringify(avisos("BE"), null, 2)).toBe(ANTES("avisos-be.json"));
  });
});

describe("o atestado de anonimização", () => {
  it.each(TRADUZIDOS)("%s: sem palavra portuguesa, e a declaração também", (idioma) => {
    expect(sobras(papeis(idioma), idioma)).toEqual([]);
    for (const dados of atestados()) {
      const declaracao = textoDaDeclaracao(dados, idioma);
      expect(sobras(declaracao, idioma)).toEqual([]);
      expect(declaracao).toContain(dados.request_id);
    }
  });

  it("sem idioma: o de antes, byte a byte", () => {
    expect(papeis()).toBe(ANTES("atestado.txt"));
  });

  it("tr: as BYTES do atestado guardam as letras turcas", async () => {
    const [dados] = atestados();
    const pdf = await renderAtestadoPdf({ dados: dados!, codigo: "A1B2-C3D4-E5F6-7890", algoritmo: "sha256", idioma: "tr" });
    const lido = await extractPdfText(pdf);
    expect(lido).toContain("Kişisel Verilerin Anonim Hâle Getirilmesi Belgesi");
  }, 60_000);
});

describe("quem chama passa o idioma do titular", () => {
  it("o worker de exportação: o PDF e o e-mail recebem o MESMO idioma, lido uma vez", () => {
    const worker = fonte("workers", "lgpd-export-worker.ts");
    expect(worker.match(/idiomaDoTitular\(/g)).toHaveLength(1);
    expect(worker).toMatch(/renderLgpdPdf\(data, \{[^}]*\bidioma\b[^}]*\}\)/);
    expect(worker).toMatch(/sendExportEmail\(\{[^}]*\bidioma,/);
  });

  it("o worker de anonimização: o idioma é lido ANTES da cascata e vai ao aviso e ao atestado", () => {
    const worker = fonte("workers", "lgpd-redact-worker.ts");
    const guarda = worker.indexOf("if (avisaTitular) {");
    const leitura = worker.indexOf("idiomaDoTitular(admin");
    const cascata = worker.indexOf("cascadeRedactContact({");
    expect(leitura).toBeGreaterThan(guarda);
    expect(leitura, "o idioma é lido depois da cascata").toBeLessThan(cascata);
    expect(worker).toMatch(/avisarTitularAposApagamento\(admin, \{[^}]*\bidioma\b/);
    expect(worker).toContain("emitirAtestadoDeAnonimizacao(admin, dadosDoAtestado, idioma)");
    const aviso = fonte("lib", "lgpd", "aviso-apos-apagar.ts");
    expect(aviso).toMatch(/sendAvisoArt12\(\s*\{[^}]*\bidioma: pedido\.idioma/);
    const emissao = fonte("lib", "lgpd", "emitir-atestado.ts");
    expect(emissao).toMatch(/renderAtestadoPdf\(\{[^}]*\bidioma\b/);
  });

  it("a rota do art. 12.º: o aviso de recusa e de prorrogação vai no idioma do titular", () => {
    const rota = fonte("app", "api", "v1", "lgpd", "requests", "[id]", "art12", "route.ts");
    expect(rota).toContain("idiomaDoTitular(admin");
    expect(rota).toMatch(/sendAvisoArt12\(\s*\{[^}]*\bidioma,/);
  });
});
