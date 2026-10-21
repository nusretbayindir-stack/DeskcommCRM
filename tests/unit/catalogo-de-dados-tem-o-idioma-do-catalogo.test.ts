/**
 * TEXTO DE TELA QUE MORA NUM CATÁLOGO DE DADOS TAMBÉM TEM O IDIOMA DO CATÁLOGO.
 *
 * Medido na v1.85.2: a tela Credenciais do admin (`/admin/configuracao`) saiu
 * metade em português para quem usa turco. O formulário faz
 * `t(definicao.rotulo)`, e o texto mora em `lib/instalacao/catalogo.ts` — nunca
 * como literal dentro de um `t()`. A extração do catálogo turco só via literal,
 * e nenhuma guarda de completude resolve `t(objeto.campo)`: o texto ficou fora
 * de TODO catálogo, inclusive do espanhol.
 *
 * Esta guarda lista os catálogos de dados que chegam à tela por `t()` e cobra,
 * de cada idioma servido por catálogo JSON, uma entrada para cada texto. Um
 * idioma novo (nl, fr) entra na conta no dia em que ganha catálogo, sem
 * ninguém lembrar desta lista.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { GRUPOS_DA_TELA } from "@/app/admin/(protected)/configuracao/_grupos";
import { entradaDoCatalogo, IDIOMAS_COM_CATALOGO } from "@/lib/i18n/catalogos";
import { CATALOGO_DA_INSTALACAO } from "@/lib/instalacao/catalogo";

/** Marca e sigla saem iguais em toda língua: a tela as mostra sem tradução. */
const IGUAIS_EM_TODA_LINGUA = new Set(["WhatsApp"]);

/**
 * Tabela de rótulos que o arquivo não exporta, lida do fonte: todo literal dos
 * campos pedidos, em qualquer objeto do arquivo. Serve às tabelas de módulo que
 * a tela passa por `t(meta.label)` — o literal nunca está dentro do `t()`.
 */
function literaisDosCampos(arquivo: string, campos: readonly string[]): string[] {
  const caminho = join(__dirname, "..", "..", arquivo);
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, "utf8"), ts.ScriptTarget.Latest, true);
  const textos: string[] = [];
  const visita = (no: ts.Node): void => {
    if (
      ts.isPropertyAssignment(no) &&
      ts.isIdentifier(no.name) &&
      campos.includes(no.name.text) &&
      (ts.isStringLiteral(no.initializer) || ts.isNoSubstitutionTemplateLiteral(no.initializer))
    ) {
      textos.push(no.initializer.text);
    }
    ts.forEachChild(no, visita);
  };
  visita(fonte);
  return textos;
}

/** As tabelas de rótulo de tela que a revisão da v1.85.2 achou sem turco. */
const TABELAS_EM_ARQUIVO: { arquivo: string; campos: readonly string[] }[] = [
  { arquivo: "app/app/radar/_components/RiskRadarList.tsx", campos: ["label"] },
  { arquivo: "components/campanhas/EstadoDaCampanha.tsx", campos: ["rotulo"] },
  { arquivo: "app/app/agenda/_components/AvisoDaConexaoGoogle.tsx", campos: ["titulo", "corpo"] },
  { arquivo: "lib/followup/eventos-legiveis.ts", campos: ["rotulo", "titulo", "detalhe", "resumo"] },
];

const CATALOGOS_DE_DADOS: { nome: string; textos: () => readonly string[] }[] = [
  {
    nome: "lib/instalacao/catalogo.ts (telas Credenciais e E-mail do admin)",
    textos: () =>
      CATALOGO_DA_INSTALACAO.flatMap((d) => [d.rotulo, d.explicacao, d.comoTrocar ?? ""]).filter(Boolean),
  },
  {
    nome: "app/admin/(protected)/configuracao/_grupos.ts (títulos da tela Credenciais)",
    textos: () =>
      GRUPOS_DA_TELA.flatMap((g) => [g.titulo, g.resumo, g.ponteiro?.texto ?? ""])
        .filter(Boolean)
        .filter((texto) => !IGUAIS_EM_TODA_LINGUA.has(texto)),
  },
  ...TABELAS_EM_ARQUIVO.map(({ arquivo, campos }) => ({
    nome: `${arquivo} (${campos.join(", ")})`,
    textos: () => literaisDosCampos(arquivo, campos),
  })),
];

describe("catálogo de dados que chega à tela por t()", () => {
  it("há idioma servido por catálogo — a guarda abaixo não roda no vazio", () => {
    expect(IDIOMAS_COM_CATALOGO).toContain("tr");
  });

  describe.each(IDIOMAS_COM_CATALOGO)("no catálogo %s", (idioma) => {
    it.each(CATALOGOS_DE_DADOS)("$nome tem todo texto", ({ textos }) => {
      const lista = textos();
      expect(lista.length).toBeGreaterThan(0);
      const faltam = lista.filter((texto) => entradaDoCatalogo(idioma, texto) === undefined);
      expect(faltam, `${faltam.length} texto(s) sem ${idioma}: caem no português`).toEqual([]);
    });
  });
});
