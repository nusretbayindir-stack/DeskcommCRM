import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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
];
const LE_O_IDIOMA = /traduzir|idiomaDa|\bIdioma\b/;

/** Arquivos que gravam na Central sem texto de tela para traduzir, com o motivo. Só encolhe. */
const SEM_TEXTO_PARA_TRADUZIR: Record<string, string> = {
  "lib/agent-engine/db/repository.ts":
    "`insertInboxItem` é genérico: título e corpo chegam prontos de quem chama, e quem chama é cobrado por esta guarda",
};

/**
 * Os que ESTA PR ainda vai corrigir, grupo a grupo (S2a Task 5). Andaime: só
 * encolhe, e a PR não sai de rascunho com ele cheio.
 */
const PENDENTES_DESTA_PR = new Set<string>([
  "app/api/v1/admin/tenants/[id]/members/[userId]/email/route.ts",
  "app/api/v1/cron/task-reminder/route.ts",
  "lib/agent-engine/guardrails/lgpd/legal-basis.ts",
  "lib/agent-engine/obs/metrics.ts",
  "lib/ai/credenciais/aviso-da-assinatura.ts",
  "lib/followup/engine.ts",
  "lib/followup/turn-bridge.ts",
  "lib/leads/aviso-de-etapa.handler.ts",
  "lib/leads/risk-seed.ts",
  "workers/media-derive-worker.ts",
]);

const gravadores = arquivosDeCodigo(["app", "lib", "workers"])
  .map((absoluto) => ({ caminho: caminhoRelativo(absoluto), fonte: readFileSync(absoluto, "utf8") }))
  .filter(({ fonte }) => GRAVA_NA_CENTRAL.some((padrao) => padrao.test(fonte)));

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
          !(caminho in SEM_TEXTO_PARA_TRADUZIR) && !PENDENTES_DESTA_PR.has(caminho) && !LE_O_IDIOMA.test(fonte),
      )
      .map(({ caminho }) => caminho)
      .sort();
    expect(semIdioma, `${semIdioma.length} arquivo(s) gravam aviso em português fixo`).toEqual([]);
  });

  it("o andaime desta PR só lista o que ainda grava sem idioma", () => {
    const corrigidos = [...PENDENTES_DESTA_PR].filter(
      (caminho) => !gravadores.some((g) => g.caminho === caminho && !LE_O_IDIOMA.test(g.fonte)),
    );
    expect(corrigidos, "tire da lista o que já lê o idioma").toEqual([]);
  });

  it("a exceção só lista arquivo que ainda grava na Central sem idioma", () => {
    const mortas = Object.keys(SEM_TEXTO_PARA_TRADUZIR).filter(
      (caminho) => !gravadores.some((g) => g.caminho === caminho && !LE_O_IDIOMA.test(g.fonte)),
    );
    expect(mortas).toEqual([]);
  });
});
