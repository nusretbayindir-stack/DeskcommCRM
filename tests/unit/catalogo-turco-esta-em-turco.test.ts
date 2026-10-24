/**
 * O CATÁLOGO TURCO ESTÁ EM TURCO — e não em português com outra extensão.
 *
 * A guarda de completude (`i18n-espanhol-cobre-a-tela`) conta se toda chave tem
 * valor; ela fica verde com um catálogo que copiou o português para o valor.
 * Esta conta o que ela não vê: letra que só o português usa, e valor igual à
 * chave além do que o turco de fato mantém (marca, sigla, número).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { arquivosDeCodigo, caminhoRelativo } from "./helpers/varrer-codigo";

const RAIZ = join(__dirname, "..", "..");
const CATALOGO = JSON.parse(readFileSync(join(RAIZ, "lib", "i18n", "traducoes", "tr.json"), "utf8")) as Record<
  string,
  string
>;

/** Os nomes que não se traduzem, lidos do próprio glossário: uma lista só. */
function nomesQueNaoSeTraduzem(): Set<string> {
  const glossario = readFileSync(join(RAIZ, "docs", "i18n", "tr-sozluk.md"), "utf8");
  const secao = glossario.split(/^## /m).find((parte) => parte.startsWith("Çevrilmeyecek adlar"));
  const linha = secao?.split("\n").find((l) => l.includes(",")) ?? "";
  return new Set(linha.split(",").map((nome) => nome.trim()).filter(Boolean));
}

describe("o catálogo turco", () => {
  const nomes = nomesQueNaoSeTraduzem();

  it("o glossário lista os nomes que não se traduzem — a régua abaixo não é vazia", () => {
    expect(nomes.has("WhatsApp")).toBe(true);
    expect(nomes.size).toBeGreaterThanOrEqual(12);
  });

  it("nenhum valor carrega letra que só o português usa", () => {
    const portugues = Object.entries(CATALOGO)
      .filter(([, valor]) => /[ãõáéíóúàê]/i.test(valor))
      .map(([chave, valor]) => `${JSON.stringify(chave)} → ${JSON.stringify(valor)}`);
    expect(portugues, `${portugues.length} valor(es) com letra portuguesa`).toEqual([]);
  });

  it("menos de 2% dos valores ficaram iguais à chave", () => {
    const contaveis = Object.entries(CATALOGO).filter(
      ([chave, valor]) => /\p{L}/u.test(chave) && chave.trim().length > 3 && !nomes.has(valor.trim()),
    );
    const iguais = contaveis.filter(([chave, valor]) => chave === valor);
    const amostra = iguais.slice(0, 20).map(([chave]) => JSON.stringify(chave));
    expect(
      iguais.length / Math.max(contaveis.length, 1),
      `${iguais.length} de ${contaveis.length} valores iguais à chave; os primeiros: ${amostra.join(", ")}`,
    ).toBeLessThan(0.02);
  });
});

/**
 * O TURCO FALA COM QUEM VENDE NA EUROPA — e não com quem vende no Brasil.
 *
 * A revisão das oito telas (v1.85.2) achou o que as guardas acima não veem: o
 * valor estava em turco, mas carregava a lei (LGPD), o documento (CNPJ) e a
 * moeda (BRL) do Brasil, e o inglês que o português deixou ("tenant"). Quem lê
 * é uma empresa na Bélgica ou na Turquia: a lei dela é a GDPR, e a empresa
 * cliente é "şirket".
 *
 * Procon é o órgão de defesa do consumidor do Brasil: a chave de assunto
 * jurídico dos agentes o citava como exemplo em turco, para quem não tem Procon.
 */
const DO_BRASIL = /\bLGPD\b|\bCNPJ\b|\bBRL\b|R\$|\bProcon\b/;

/** Valores que citam o Brasil de propósito, um a um, com o motivo. Só encolhe. */
const BRASIL_DE_PROPOSITO: Record<string, string> = {
  "Preço (R$)":
    "o plano da plataforma é cobrado em reais: _planos.tsx formata com currency \"BRL\"; trocar o rótulo mentiria sobre o número",
  "Confira os campos do plano: preço a partir de R$ 5,00, teste grátis de 0 a 90 dias e limites a partir de 1.":
    "o mesmo piso em reais que _planos.tsx valida",
};

/** O termo que a revisão decidiu, frase a frase (o glossário traz a regra). */
const TERMOS_DECIDIDOS: Record<string, string> = {
  Duplicados: "Mükerrer kayıtlar",
  Pessoais: "Yalnızca kişisel",
  "Sair pra app pessoal": "Uygulamaya dön",
  LGPD: "GDPR",
  CNPJ: "Vergi numarası",
  Tenants: "Şirketler",
  "Novo tenant": "Yeni şirket",
};

describe("o catálogo turco fala com quem vende na Europa", () => {
  it("nenhum valor cita a lei, o documento ou a moeda do Brasil", () => {
    const brasil = Object.entries(CATALOGO)
      .filter(([chave, valor]) => DO_BRASIL.test(valor) && !(chave in BRASIL_DE_PROPOSITO))
      .map(([chave, valor]) => `${JSON.stringify(chave)} → ${JSON.stringify(valor)}`);
    expect(brasil, `${brasil.length} valor(es) com LGPD, CNPJ, BRL, R$ ou Procon`).toEqual([]);
  });

  it("a exceção do Brasil só lista frase que existe e ainda cita o Brasil", () => {
    const mortas = Object.keys(BRASIL_DE_PROPOSITO).filter((chave) => !DO_BRASIL.test(CATALOGO[chave] ?? ""));
    expect(mortas).toEqual([]);
  });

  it("nenhum valor deixa o inglês do português: tenant, cross-tenant, actor, customer", () => {
    const ingles = Object.entries(CATALOGO)
      .filter(([, valor]) => /tenant|\bactor\b|\bcustomer\b/i.test(valor))
      .map(([chave, valor]) => `${JSON.stringify(chave)} → ${JSON.stringify(valor)}`);
    expect(ingles, `${ingles.length} valor(es) com inglês herdado`).toEqual([]);
  });

  it("a caixa de busca começa por \"Ara\", e não por \"Ada\" (ilha), que é o que sobra cortado", () => {
    const busca = Object.entries(CATALOGO)
      .filter(([chave]) => /^(Buscar por|Procure pel?o)\b/.test(chave))
      .filter(([, valor]) => !valor.startsWith("Ara"))
      .map(([chave, valor]) => `${JSON.stringify(chave)} → ${JSON.stringify(valor)}`);
    expect(busca, `${busca.length} busca(s) que não começam por "Ara"`).toEqual([]);
  });

  it.each(Object.entries(TERMOS_DECIDIDOS))("%s → %s", (chave, esperado) => {
    expect(CATALOGO[chave]).toBe(esperado);
  });
});

/**
 * DEPOIS DE UM NÚMERO, O TURCO USA O SINGULAR: "3 talep", nunca "3 talepler".
 *
 * A tela monta a contagem em pedaços — `${total} ${t("solicitações")}` — e o
 * pedaço é traduzido sozinho, sem saber que vem depois de um número. O
 * português e o espanhol põem o plural ali; o turco não. A varredura acha todo
 * pedaço que segue uma expressão (`${n} ${t(…)}` e `{n} {t(…)}`) e reprova o
 * valor turco cuja primeira palavra tem o sufixo de plural.
 */
const CONTAGEM_NO_TEMPLATE = /\$\{\s*([^{}]+?)\s*\}(?=\s+\$\{([^{}]*?)\})/g;
const CONTAGEM_NO_JSX = /\{\s*([^{}$]+?)\s*\}(?=\s+\{([^{}]*?)\})/g;
const CHAMADA_DE_T = /\bt\(([^()]*)\)/g;
const LITERAL = /"([^"]+)"/g;
const PLURAL = /\p{L}(ler|lar)$/u;

/** Pedaços que seguem uma expressão que não é contagem, com o motivo. Só encolhe. */
const NAO_E_CONTAGEM: Record<string, string> = {
  "continua em Propostas": "segue o ANO da proposta (0042/2026); \"Teklifler\" é o nome da seção",
};

function pedacosDepoisDeContagem(): { chave: string; local: string }[] {
  const achados: { chave: string; local: string }[] = [];
  for (const arquivo of arquivosDeCodigo(["app", "components", "lib", "hooks"])) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const padrao of [CONTAGEM_NO_TEMPLATE, CONTAGEM_NO_JSX]) {
      for (const casamento of fonte.matchAll(padrao)) {
        const antes = casamento[1] ?? "";
        // `{" "}` e `{t("…")}` antes do pedaço são texto, não número.
        if (/^["'`]|^t\(/.test(antes)) continue;
        const linha = fonte.slice(0, casamento.index).split("\n").length;
        for (const chamada of (casamento[2] ?? "").matchAll(CHAMADA_DE_T)) {
          for (const literal of (chamada[1] ?? "").matchAll(LITERAL)) {
            achados.push({ chave: literal[1] ?? "", local: `${caminhoRelativo(arquivo)}:${linha}` });
          }
        }
      }
    }
  }
  return achados;
}

describe("depois de um número, o turco usa o singular", () => {
  const achados = pedacosDepoisDeContagem();

  it("a varredura enxerga — o verde abaixo não é vacuidade", () => {
    expect(achados.map((a) => a.chave)).toEqual(expect.arrayContaining(["solicitações", "dias", "incidentes"]));
  });

  it("nenhum pedaço depois de uma contagem fica no plural", () => {
    const plurais = achados
      .filter(({ chave }) => !(chave in NAO_E_CONTAGEM))
      .filter(({ chave }) => PLURAL.test((CATALOGO[chave] ?? "").trim().split(/\s+/)[0]?.replace(/\p{P}+$/u, "") ?? ""))
      .map(({ chave, local }) => `${local} → t(${JSON.stringify(chave)}) = ${JSON.stringify(CATALOGO[chave])}`);
    expect([...new Set(plurais)], `${plurais.length} contagem(ns) com o pedaço turco no plural`).toEqual([]);
  });
});
