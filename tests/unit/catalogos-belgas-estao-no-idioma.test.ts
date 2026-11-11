import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REGISTRO_DE_IDIOMAS } from "@/lib/i18n/registro";

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
 *
 * Com o idioma `completo` (Task 7), as duas tabelas de exceção não podem ter
 * linha morta: toda exceção do Brasil está no catálogo e ainda cita o Brasil, e
 * toda exceção de tratamento ainda casa algum valor. Exceção que não protege
 * nada esconde o próximo erro de verdade.
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
/**
 * Palavras que só o português usa. As do plano mais as que sobram numa
 * meia-tradução (revisão do PR #41): nenhuma é palavra do francês ou do neerlandês.
 */
const PALAVRA_PORTUGUESA =
  /(?<!\p{L})(não|você|vocês|está|salvar|cancelar|conversa|atendimento|negócio|contatos?|empresa|mensage(m|ns)|também|configurações)(?!\p{L})/iu;
const DO_BRASIL = /\bLGPD\b|\bCNPJ\b|\bBRL\b|R\$|\bProcon\b/;
/**
 * O inglês herdado. "tenant" só como palavra (sozinha, no plural, em
 * "cross-tenant"): dentro de "maintenant"/"appartenant" e em "en tenant compte"
 * é francês correto (revisão do PR #41).
 */
const INGLES_HERDADO = /(?<!\p{L})(?<!\ben\s)tenants?(?!\p{L})|\bactor\b|\bcustomer\b/iu;
/** O placeholder do catálogo, a mesma forma de `catalogo-de-idioma-tem-forma`. */
const PLACEHOLDER = /\{\{?[A-Za-z_][A-Za-z0-9_]*\}?\}/g;
/** Num padrão de data, o apóstrofo do texto se dobra (`''`); um apóstrofo solto faz o date-fns imprimir lixo sem erro. */
const PADRAO_DE_DATA = /'(de|às)'/;
const aspaSolta = (padrao: string) => (padrao.replaceAll("''", "").split("'").length - 1) % 2 !== 0;

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
    // As do plano (je, jij, jouw) mais as outras formas do "je" (revisão do PR #41).
    informal: /(?<!\p{L})(je|jij|jou|jouw|jouwe|jullie|jezelf)(?!\p{L})/iu,
    termoDoVizinho: /(?<!\p{L})(BCE|TVA|APD)(?!\p{L})/iu,
    naoETratamento: {},
  },
  fr: {
    // As do plano (tu, ton, ta) mais tes, toi, te e o "t'" elidido (revisão do PR #41).
    informal: /(?<!\p{L})(tu|ton|ta|tes|toi|te)(?!\p{L})|(?<!\p{L})t['’]/iu,
    termoDoVizinho: /(?<!\p{L})(KBO|btw|GBA)(?!\p{L})/iu,
    naoETratamento: {
      "ton de voix": "o tom de voz (das vozes do agente) é um substantivo, não tratamento",
      "(?<!\\p{L})(le|un|au|du|ce|quel|même|bon|votre|notre|son|leur|aucun|chaque|autre|nouveau|tout)\\s+ton(?!\\p{L})":
        "\"ton\" depois de artigo ou determinante é o substantivo (tom): \"au ton de la conversation\", \"votre ton\". Dois determinantes não se empilham, então nenhum possessivo se esconde aqui; \"de\" fica de fora (\"de ton compte\").",
    },
  },
};

/**
 * Exceção que o glossário APROVADO declara com todas as letras ("Tek istisna
 * gerçek bir addır: ton de voix", `fr-sozluk.md`): vale mesmo sem frase que a
 * use hoje, porque um rótulo "Ton de voix" é tradução legítima e mudar o
 * glossário pede a leitora. A régua de exceção morta não a cobra.
 */
const EXCECAO_DECLARADA_NO_GLOSSARIO: ReadonlySet<string> = new Set(["ton de voix"]);

type Problemas = Record<
  | "letraPortuguesa"
  | "palavraPortuguesa"
  | "igualAChave"
  | "doBrasil"
  | "tratamento"
  | "termoDoVizinho"
  | "inglesHerdado"
  | "dataComAspaSolta",
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

  // O placeholder fica como na chave (`{empresa}`, `{contatos}`): não é texto da tela.
  const texto = (valor: string) => valor.replace(PLACEHOLDER, " ");
  const semExcecoes = (valor: string) =>
    Object.keys(regras.naoETratamento).reduce((resto, expressao) => resto.replace(new RegExp(expressao, "giu"), " "), valor);

  return {
    letraPortuguesa: onde((_, valor) => LETRA_PORTUGUESA.test(valor)),
    palavraPortuguesa: onde((_, valor) => PALAVRA_PORTUGUESA.test(texto(valor))),
    igualAChave: proporcao < 0.02 ? [] : iguais.map(mostrar),
    doBrasil: onde((chave, valor) => DO_BRASIL.test(valor) && !(chave in BRASIL_DE_PROPOSITO)),
    tratamento: onde((_, valor) => regras.informal.test(semExcecoes(texto(valor)))),
    termoDoVizinho: onde((_, valor) => regras.termoDoVizinho.test(texto(valor))),
    inglesHerdado: onde((_, valor) => INGLES_HERDADO.test(texto(valor))),
    dataComAspaSolta: onde((chave, valor) => PADRAO_DE_DATA.test(chave) && aspaSolta(valor)),
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
  dataComAspaSolta: [],
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

  it("controle: francês e neerlandês corretos e comuns não são acusados", () => {
    // Revisão do PR #41: "maintenant" e "en tenant compte" caíam em `tenant`, e
    // "votre ton"/"aucun ton" em tratamento — frases reais do catálogo.
    const frances: Catalogo = {
      "Enviar agora": "Envoyer maintenant",
      "A IA responde levando em conta o histórico.": "L'IA répond en tenant compte de l'historique.",
      "Contatos desta equipe": "Contacts appartenant à cette équipe",
      "Revise com seu tom": "Relisez-le avec votre ton et envoyez-le.",
      "Não existe tom desta cor": "Il n'existe aucun ton de cette couleur.",
      "Número de IVA": "Numéro de TVA",
      "Quer continuar?": "Voulez-vous continuer ?",
    };
    const neerlandes: Catalogo = {
      "Seu número de IVA": "Uw btw-nummer",
      "Número KBO inválido": "Ongeldig KBO-nummer",
      "Enviar agora": "Nu verzenden",
    };
    expect(problemasDoCatalogo(frances, REGRAS.fr, nomes)).toEqual(NENHUM);
    expect(problemasDoCatalogo(neerlandes, REGRAS.nl, nomes)).toEqual(NENHUM);
  });

  it("o inglês herdado continua achado: tenant sozinho, no plural e composto", () => {
    const frances: Catalogo = { "Novo tenant": "Nouveau tenant", Tenants: "Tenants", "cross-tenant": "Vue cross-tenant" };
    expect(problemasDoCatalogo(frances, REGRAS.fr, nomes).inglesHerdado).toHaveLength(3);
  });

  it("neerlandês: jou, jullie e jezelf também são tratamento", () => {
    const informal: Catalogo = {
      "Esta mensagem é para você": "Dit bericht is voor jou",
      "Sua equipe pode ver": "Jullie team kan dit zien",
      "Apresente-se": "Stel jezelf voor",
    };
    expect(problemasDoCatalogo(informal, REGRAS.nl, nomes).tratamento).toHaveLength(3);
  });

  it("francês: tes, toi, te e t' também são tratamento", () => {
    const informal: Catalogo = {
      "Ver seus contatos": "Voir tes contacts",
      "Esta mensagem é para você": "Ce message est pour toi",
      "Posso ajudar?": "Je peux t'aider ?",
      "Ele te liga": "Il te rappelle",
    };
    expect(problemasDoCatalogo(informal, REGRAS.fr, nomes).tratamento).toHaveLength(4);
  });

  it("meia-tradução: a palavra portuguesa comum que sobrou é achada", () => {
    expect(problemasDoCatalogo({ "Ver o contato": "Bekijk o contato" }, REGRAS.nl, nomes).palavraPortuguesa).toHaveLength(1);
    expect(problemasDoCatalogo({ "Enviar a mensagem": "Envoyer la mensagem" }, REGRAS.fr, nomes).palavraPortuguesa).toHaveLength(1);
    expect(problemasDoCatalogo({ "Dados da empresa": "Données de l'empresa" }, REGRAS.fr, nomes).palavraPortuguesa).toHaveLength(1);
  });

  it("o placeholder fica como na chave e não conta como palavra portuguesa ({empresa}, {contatos})", () => {
    const comPlaceholder: Catalogo = {
      "IA copiada da empresa {empresa}.": "IA kopieerd van het bedrijf {empresa}.",
      "Remover {tag} de {contatos} contatos": "Retirer {tag} de {contatos} contacts",
    };
    expect(problemasDoCatalogo(comPlaceholder, REGRAS.nl, nomes).palavraPortuguesa).toEqual([]);
    expect(problemasDoCatalogo(comPlaceholder, REGRAS.fr, nomes).palavraPortuguesa).toEqual([]);
  });

  it("padrão de data: apóstrofo sem escape é achado (o date-fns não recusa, imprime lixo)", () => {
    // `'aujourd'hui à' HH:mm` formata "aujourd920261 à …" sem erro: a guarda de
    // forma não vê. O apóstrofo dentro do texto se escreve dobrado: `''`.
    const quebrado: Catalogo = { "'hoje às' HH:mm 'de' dd": "'aujourd'hui à' HH:mm" };
    const certo: Catalogo = { "'hoje às' HH:mm 'de' dd": "'aujourd''hui à' HH:mm", "d 'de' MMMM 'às' HH:mm": "d MMMM 'à' HH:mm" };
    expect(problemasDoCatalogo(quebrado, REGRAS.fr, nomes).dataComAspaSolta).toHaveLength(1);
    expect(problemasDoCatalogo(certo, REGRAS.fr, nomes).dataComAspaSolta).toEqual([]);
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

  const completo = REGISTRO_DE_IDIOMAS.find((idioma) => idioma.codigo === codigo)?.nivel === "completo";

  it.runIf(completo)("completo: toda exceção do Brasil está no catálogo e ainda cita o Brasil", () => {
    const mortas = Object.keys(BRASIL_DE_PROPOSITO).filter((chave) => !DO_BRASIL.test(catalogo[chave] ?? ""));
    expect(mortas).toEqual([]);
  });

  it.runIf(completo)("completo: toda exceção de tratamento ainda casa algum valor do catálogo", () => {
    const valores = Object.values(catalogo).map((valor) => valor.replace(PLACEHOLDER, " "));
    const mortas = Object.keys(REGRAS[codigo].naoETratamento).filter(
      (expressao) =>
        !EXCECAO_DECLARADA_NO_GLOSSARIO.has(expressao) &&
        !valores.some((valor) => new RegExp(expressao, "iu").test(valor)),
    );
    expect(mortas).toEqual([]);
  });

  it.skipIf(vazio)("a exceção do Brasil só vale para frase traduzida que ainda cita o Brasil", () => {
    // Frase ainda sem tradução não é exceção morta: o catálogo é traduzido aos lotes.
    const mortas = Object.keys(BRASIL_DE_PROPOSITO).filter(
      (chave) => chave in catalogo && !DO_BRASIL.test(catalogo[chave] ?? ""),
    );
    expect(mortas).toEqual([]);
  });
});
