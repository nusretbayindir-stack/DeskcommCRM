import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { FUNCOES_COM_TEXTO_DE_QUEM_CHAMA } from "@/lib/ai/avisos-do-banco";

import { arquivosDeCodigo, caminhoRelativo } from "./helpers/varrer-codigo";

/**
 * A CENTRAL DE AVISOS FALA O IDIOMA DA EMPRESA — e não o português de quem
 * escreveu o código.
 *
 * Todo aviso que entra em `agent_inbox_items` é lido pela equipe da empresa, e a
 * equipe de uma empresa belga ou turca não lê português (doc S2a, "português não
 * fica", D4: aviso para a equipe sai no idioma da empresa). O padrão é o de
 * `lib/leads/reactivation.ts`: o idioma é lido SÓ quando o aviso vai mesmo ser
 * gravado (`idiomaDaOrgPeloPg` / `idiomaDaOrgPeloSupabase`, que não lançam), e o
 * título e o corpo passam por `traduzir`.
 *
 * A guarda é de vizinhança: o arquivo que grava na Central precisa ao menos citar
 * `traduzir`, `idiomaDa…` ou `Idioma`. Os testes por grupo (os `*-no-idioma`
 * deste PR) provam o resto.
 */

const GRAVA_NA_CENTRAL = [
  /from\(\s*["'`]agent_inbox_items["'`]\s*\)\s*\.\s*(insert|upsert)\s*\(/,
  /insert\s+into\s+(public\.)?agent_inbox_items\b/i,
  // O ajudante genérico do engine (`lib/agent-engine/db/repository.ts`): quem o
  // chama é quem escreve o título e o corpo.
  /\binsertInboxItem\s*\(/,
  // `registrarAviso` (lib/channels/zernio/avisos.ts) NÃO entra aqui: ela mesma lê
  // o idioma e só aceita `montar(idioma)`, então o tipo já cobra quem a chama.
  // Funções do banco que gravam na Central o texto recebido (`fn_agent_legacy_notice`…):
  // quem as chama por `rpc` escreve o título e o corpo (lib/ai/avisos-do-banco.ts).
  new RegExp(`\\.rpc\\(\\s*["'\`](${Object.keys(FUNCOES_COM_TEXTO_DE_QUEM_CHAMA).join("|")})["'\`]`),
];
/**
 * Uma CHAMADA que lê o idioma ou traduz — não a palavra solta: comentário e
 * tipo não contam (revisão final, I2). O que cada gravação grava é medido em
 * `central-sem-portugues-fixo.test.ts`.
 */
const LE_O_IDIOMA = /\btraduzir\s*\(|\bidiomaDaOrg\w*\s*(\?\.)?\s*\(|\bnormalizarIdioma\s*\(/;

/** O código sem comentários: "sem traduzir" num comentário não é tradução. */
function semComentarios(caminho: string, fonte: string): string {
  const arq = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, false);
  return ts.createPrinter({ removeComments: true }).printFile(arq);
}

/** Arquivos que gravam na Central sem texto de tela para traduzir, com o motivo. Só encolhe. */
const SEM_TEXTO_PARA_TRADUZIR: Record<string, string> = {
  "lib/agent-engine/db/repository.ts":
    "`insertInboxItem` é genérico: título e corpo chegam prontos de quem chama, e quem chama é cobrado por esta guarda",
  "app/api/v1/cron/task-reminder/route.ts":
    "o título do item é o NOME DA TAREFA (dado de gente) e não há corpo; o que aconteceu é o rótulo do kind, que a tela já traduz (doc de decisão 162)",
};

const gravadores = arquivosDeCodigo(["app", "lib", "workers"])
  .map((absoluto) => ({ caminho: caminhoRelativo(absoluto), fonte: readFileSync(absoluto, "utf8") }))
  .filter(({ fonte }) => GRAVA_NA_CENTRAL.some((padrao) => padrao.test(fonte)))
  .map(({ caminho, fonte }) => ({ caminho, fonte: semComentarios(caminho, fonte) }));

describe("a Central de avisos fala o idioma da empresa", () => {
  it("a varredura acha quem grava na Central (controle positivo)", () => {
    const caminhos = gravadores.map(({ caminho }) => caminho);
    expect(caminhos).toContain("lib/leads/reactivation.ts");
    expect(caminhos.length).toBeGreaterThan(20);
  });

  it("todo arquivo que grava na Central lê o idioma da empresa ou traduz", () => {
    const semIdioma = gravadores
      .filter(
        ({ caminho, fonte }) =>
          !(caminho in SEM_TEXTO_PARA_TRADUZIR) && !LE_O_IDIOMA.test(fonte),
      )
      .map(({ caminho }) => caminho)
      .sort();
    expect(semIdioma, `${semIdioma.length} arquivo(s) gravam aviso em português fixo`).toEqual([]);
  });

  it("a exceção só lista arquivo que ainda grava na Central sem idioma", () => {
    const mortas = Object.keys(SEM_TEXTO_PARA_TRADUZIR).filter(
      (caminho) => !gravadores.some((g) => g.caminho === caminho && !LE_O_IDIOMA.test(g.fonte)),
    );
    expect(mortas).toEqual([]);
  });
});
