/**
 * O INGLÊS DOS CABEÇALHOS DO ADMIN PASSA POR t().
 *
 * Medido na v1.85.2 com o admin em turco: Denetim mostrava os filtros
 * "Tenants", "Actions" e "Actor (user ID)" e as colunas "Action" e "Actor";
 * Kullanıcılar, "Email" e "Role"; Platform Yöneticileri, "Scope". O português
 * do admin usa essas palavras em inglês de propósito, e por isso a guarda de
 * prosa portuguesa (`i18n-espanhol-cobre-a-tela`) não as via: não têm acento
 * nem palavra portuguesa. Ficaram cruas para todo idioma.
 *
 * A chave continua sendo o texto que o português mostra ("Action"): a tela em
 * português não muda uma letra, e os outros idiomas ganham tradução.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { arquivosDeCodigo, caminhoRelativo } from "./helpers/varrer-codigo";

const INGLES = ["Action", "Actions", "Actor", "Actor (user ID)", "Email", "Role", "Scope", "Tenant", "Tenants"];
const termo = INGLES.map((palavra) => palavra.replace(/[()]/g, "\\$&")).join("|");

/** O inglês cru nos três jeitos que o admin o escreve: texto de JSX, prop de texto e item de lista de cabeçalhos. */
const CRU = [
  new RegExp(`>\\s*(${termo})\\s*<`, "g"),
  new RegExp(`\\b(?:label|placeholder|title|aria-label)="(${termo})"`, "g"),
  new RegExp(`[[,]\\s*"(${termo})"\\s*(?=[,\\]])`, "g"),
];

function inglesCru(): string[] {
  const achados: string[] = [];
  for (const arquivo of arquivosDeCodigo(["app/admin", "components/admin"])) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const padrao of CRU) {
      for (const casamento of fonte.matchAll(padrao)) {
        const linha = fonte.slice(0, casamento.index).split("\n").length;
        achados.push(`${caminhoRelativo(arquivo)}:${linha} ${JSON.stringify(casamento[1])}`);
      }
    }
  }
  return achados;
}

describe("o admin", () => {
  it("a varredura enxerga o admin — o verde abaixo não é vacuidade", () => {
    expect(arquivosDeCodigo(["app/admin", "components/admin"]).length).toBeGreaterThan(20);
  });

  it("não deixa cabeçalho em inglês fora de t()", () => {
    const crus = inglesCru();
    expect(crus, `${crus.length} rótulo(s) em inglês fora de t()`).toEqual([]);
  });
});
