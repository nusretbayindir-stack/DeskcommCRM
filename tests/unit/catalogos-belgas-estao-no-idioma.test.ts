import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * OS CATÁLOGOS DA BÉLGICA ESTÃO NO IDIOMA — e não em português com outra extensão.
 *
 * A guarda de forma (`catalogo-de-idioma-tem-forma`) vê valor vazio, placeholder
 * e data. Esta vê o que ela não vê, a mesma régua de `catalogo-turco-esta-em-turco`
 * mais o que só o neerlandês e o francês da Bélgica têm:
 *
 * - letra e palavra que só o português usa;
 * - valor igual à chave além dos nomes que o glossário manda não traduzir;
 * - lei, documento e moeda do Brasil (a exceção é a mesma do turco);
 * - tratamento: "u" em neerlandês e "vous" em francês, nunca "je"/"tu";
 * - o termo do vizinho: KBO, btw e GBA são do neerlandês; BCE, TVA e APD, do francês;
 * - o inglês que o português deixou (tenant, actor, customer).
 *
 * Catálogo vazio não é cobrado: o idioma está em construção e a tradução só
 * começa depois do glossário aprovado (doc S2a, Task 4). O detector é testado
 * à parte, com catálogos de exemplo, para a guarda não passar cega.
 */

const RAIZ = join(__dirname, "..", "..");

type Catalogo = Readonly<Record<string, string>>;

function lerCatalogo(codigo: string): Catalogo {
  return JSON.parse(readFileSync(join(RAIZ, "lib", "i18n", "traducoes", `${codigo}.json`), "utf8")) as Catalogo;
}

/** Os nomes que não se traduzem, lidos do glossário do idioma: uma lista só. */
function nomesQueNaoSeTraduzem(codigo: string): Set<string> {
  const glossario = readFileSync(join(RAIZ, "docs", "i18n", `${codigo}-sozluk.md`), "utf8");
  const secao = glossario.split(/^## /m).find((parte) => parte.startsWith("Çevrilmeyecek adlar"));
  const linha = secao?.split("\n").find((l) => l.includes(",")) ?? "";
  return new Set(linha.split(",").map((nome) => nome.trim()).filter(Boolean));
}

const LETRA_PORTUGUESA = /[ãõ]/i;
const PALAVRA_PORTUGUESA =
  /(?<!\p{L})(não|você|vocês|está|salvar|cancelar|conversa|atendimento|negócio)(?!\p{L})/iu;
const DO_BRASIL = /\bLGPD\b|\bCNPJ\b|\bBRL\b|R\$|\bProcon\b/;
const INGLES_HERDADO = /tenant|\bactor\b|\bcustomer\b/i;

/** Valores que citam o Brasil de propósito — a mesma tabela de `catalogo-turco-esta-em-turco`. Só encolhe. */
const BRASIL_DE_PROPOSITO: Record<string, string> = {
  "Preço (R$)":
    "o plano da plataforma é cobrado em reais: _planos.tsx formata com currency \"BRL\"; trocar o rótulo mentiria sobre o número",
  "Confira os campos do plano: preço a partir de R$ 5,00, teste grátis de 0 a 90 dias e limites a partir de 1.":
    "o mesmo piso em reais que _planos.tsx valida",
};

interface RegrasDoIdioma {
  /** O tratamento informal: o glossário pede "u" (nl) e "vous" (fr). */
  readonly informal: RegExp;
  /** Os termos belgas do OUTRO idioma: em neerlandês é KBO, btw, GBA; em francês, BCE, TVA, APD. */
  readonly termoDoVizinho: RegExp;
  /** Expressões (regex) que casam com `informal` sem ser tratamento, com o motivo. Só encolhe. */
  readonly naoETratamento: Readonly<Record<string, string>>;
}

const REGRAS: Readonly<Record<"nl" | "fr", RegrasDoIdioma>> = {
  nl: {
    informal: /(?<!\p{L})(je|jij|jouw)(?!\p{L})/iu,
    termoDoVizinho: /(?<!\p{L})(BCE|TVA|APD)(?!\p{L})/iu,
    naoETratamento: {},
  },
  fr: {
    informal: /(?<!\p{L})(tu|ton|ta)(?!\p{L})/iu,
    termoDoVizinho: /(?<!\p{L})(KBO|btw|GBA)(?!\p{L})/iu,
    naoETratamento: {
      "ton de voix": "o tom de voz (das vozes do agente) é um substantivo, não tratamento",
      "(?<!\\p{L})(le|un|au|du|ce|quel|même|bon)\\s+ton(?!\\p{L})":
        "\"ton\" depois de artigo ou determinante é o substantivo (tom): \"au ton de la conversation\", \"un ton neutre\"",
    },
  },
};

type Problemas = Record<
  "letraPortuguesa" | "palavraPortuguesa" | "igualAChave" | "doBrasil" | "tratamento" | "termoDoVizinho" | "inglesHerdado",
  string[]
>;

function problemasDoCatalogo(catalogo: Catalogo, regras: RegrasDoIdioma, nomes: ReadonlySet<string>): Problemas {
  const entradas = Object.entries(catalogo);
  const mostrar = ([chave, valor]: [string, string]) => `${JSON.stringify(chave)} → ${JSON.stringify(valor)}`;
  const onde = (teste: (chave: string, valor: string) => boolean) =>
    entradas.filter(([chave, valor]) => teste(chave, valor)).map(mostrar);

  const contaveis = entradas.filter(
    ([chave, valor]) => /\p{L}/u.test(chave) && chave.trim().length > 3 && !nomes.has(valor.trim()),
  );
  const iguais = contaveis.filter(([chave, valor]) => chave === valor);
  const proporcao = iguais.length / Math.max(contaveis.length, 1);

  const semExcecoes = (valor: string) =>
    Object.keys(regras.naoETratamento).reduce((texto, expressao) => texto.replace(new RegExp(expressao, "giu"), " "), valor);

  return {
    letraPortuguesa: onde((_, valor) => LETRA_PORTUGUESA.test(valor)),
    palavraPortuguesa: onde((_, valor) => PALAVRA_PORTUGUESA.test(valor)),
    igualAChave: proporcao < 0.02 ? [] : iguais.map(mostrar),
    doBrasil: onde((chave, valor) => DO_BRASIL.test(valor) && !(chave in BRASIL_DE_PROPOSITO)),
    tratamento: onde((_, valor) => regras.informal.test(semExcecoes(valor))),
    termoDoVizinho: onde((_, valor) => regras.termoDoVizinho.test(valor)),
    inglesHerdado: onde((_, valor) => INGLES_HERDADO.test(valor)),
  };
}

const NENHUM: Problemas = {
  letraPortuguesa: [],
  palavraPortuguesa: [],
  igualAChave: [],
  doBrasil: [],
  tratamento: [],
  termoDoVizinho: [],
  inglesHerdado: [],
};

describe("o detector acha cada problema (para a guarda não passar cega com catálogo vazio)", () => {
  const nomes = new Set(["WhatsApp"]);
  const categoriasAchadas = (problemas: Problemas) =>
    Object.entries(problemas)
      .filter(([, achados]) => achados.length > 0)
      .map(([categoria]) => categoria)
      .sort();

  it("neerlandês: cada erro cai na sua categoria", () => {
    const ruim: Catalogo = {
      "Salvar alterações": "Salvar alterações",
      "Ver conversa": "Bekijk conversa",
      "Informe o CNPJ": "Vul het CNPJ in",
      "Você pode sair": "Je kunt afsluiten",
      "Número da empresa": "BCE-nummer",
      "Novo tenant": "Nieuwe tenant",
    };
    expect(categoriasAchadas(problemasDoCatalogo(ruim, REGRAS.nl, nomes))).toEqual(
      [
        "doBrasil",
        "igualAChave",
        "inglesHerdado",
        "letraPortuguesa",
        "palavraPortuguesa",
        "termoDoVizinho",
        "tratamento",
      ].sort(),
    );
  });

  it("francês: \"tu\", \"ta\" e \"ton compte\" são tratamento; o substantivo \"ton\" (tom) não", () => {
    const comTratamento: Catalogo = {
      "Sua conta": "Ton compte",
      "Você pode": "Tu peux",
      "Sua senha": "Ta clé",
      "Abra sua conta": "Ouvre ton compte",
    };
    expect(problemasDoCatalogo(comTratamento, REGRAS.fr, nomes).tratamento).toHaveLength(4);
    const tom: Catalogo = {
      "Tom de voz": "Ton de voix",
      "A IA pode adaptar a pergunta ao tom da conversa.": "L'IA peut adapter la question au ton de la conversation.",
      "um tom neutro": "un ton neutre",
    };
    expect(problemasDoCatalogo(tom, REGRAS.fr, nomes).tratamento).toEqual([]);
  });

  it("francês: o termo do neerlandês (btw, KBO, GBA) é achado", () => {
    expect(problemasDoCatalogo({ "Número de IVA": "Numéro de btw" }, REGRAS.fr, nomes).termoDoVizinho).toHaveLength(1);
  });

  it("um catálogo limpo não tem problema nenhum; nome do glossário igual à chave não conta", () => {
    const limpoNl: Catalogo = { "Salvar alterações": "Wijzigingen opslaan", WhatsApp: "WhatsApp", "Sua conta": "Uw account" };
    const limpoFr: Catalogo = { "Salvar alterações": "Enregistrer les modifications", WhatsApp: "WhatsApp", "Sua conta": "Votre compte" };
    expect(problemasDoCatalogo(limpoNl, REGRAS.nl, nomes)).toEqual(NENHUM);
    expect(problemasDoCatalogo(limpoFr, REGRAS.fr, nomes)).toEqual(NENHUM);
  });

  it("a exceção do Brasil é a mesma do turco", () => {
    const turco = readFileSync(join(RAIZ, "tests", "unit", "catalogo-turco-esta-em-turco.test.ts"), "utf8");
    for (const chave of Object.keys(BRASIL_DE_PROPOSITO)) expect(turco).toContain(JSON.stringify(chave));
  });
});

describe.each(["nl", "fr"] as const)("o catálogo %s", (codigo) => {
  const catalogo = lerCatalogo(codigo);
  const vazio = Object.keys(catalogo).length === 0;

  it("o glossário lista os nomes que não se traduzem — a régua não é vazia", () => {
    const nomes = nomesQueNaoSeTraduzem(codigo);
    expect(nomes.has("WhatsApp")).toBe(true);
    expect(nomes.size).toBeGreaterThanOrEqual(12);
  });

  it.skipIf(vazio)("está no idioma: nada de português, Brasil, tratamento informal, termo do vizinho ou inglês herdado", () => {
    expect(problemasDoCatalogo(catalogo, REGRAS[codigo], nomesQueNaoSeTraduzem(codigo))).toEqual(NENHUM);
  });

  it.skipIf(vazio)("a exceção do Brasil só vale para frase traduzida que ainda cita o Brasil", () => {
    // Frase ainda sem tradução não é exceção morta: o catálogo é traduzido aos lotes.
    const mortas = Object.keys(BRASIL_DE_PROPOSITO).filter(
      (chave) => chave in catalogo && !DO_BRASIL.test(catalogo[chave] ?? ""),
    );
    expect(mortas).toEqual([]);
  });
});
