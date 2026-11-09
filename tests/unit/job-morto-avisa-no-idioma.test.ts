import { describe, expect, it } from "vitest";

import { failJob, reapExpiredJobs } from "@/lib/agent-engine/queue/queue";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO } from "@/lib/i18n/idiomas";

/**
 * O JOB QUE MORRE AVISA A EQUIPE NO IDIOMA DA EMPRESA.
 *
 * O alerta `job_dead` nasce no mesmo statement que mata o job (atômico): o título
 * e o rótulo "Motivo:" vão em todo idioma num jsonb, e o SQL escolhe pelo
 * `organizations.locale` da própria linha (`lib/i18n/em-cada-idioma.ts`). Sem
 * locale conhecido, o padrão — e o alerta é gravado do mesmo jeito.
 */
const TITULO = "Job descartado após esgotar tentativas";
const LOCALE_DA_LINHA = (tabela: string) =>
  `(select o.locale from organizations o where o.id = ${tabela}.organization_id)`;

function bancoQueGuarda() {
  const chamadas: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      chamadas.push({ sql, params });
      return { rows: [] };
    },
  };
  return { chamadas, db };
}

describe("o alerta do job morto sai no idioma da empresa", () => {
  it("failJob: título e 'Motivo:' em todo idioma, escolhidos pelo locale da empresa", async () => {
    const { chamadas, db } = bancoQueGuarda();
    await failJob(db as never, "job-1", "worker-1", new Error("falhou"));
    const { sql, params } = chamadas[0]!;
    const titulos = JSON.parse(params[4] as string) as Record<string, string>;
    const motivos = JSON.parse(params[5] as string) as Record<string, string>;
    expect(titulos[IDIOMA_PADRAO]).toBe(TITULO);
    expect(titulos.tr).toBe(traduzir(TITULO, "tr"));
    expect(titulos.tr).not.toBe(TITULO);
    expect(motivos.tr).toBe(traduzir("Motivo:", "tr"));
    expect(sql).toContain(`coalesce($5::jsonb ->> ${LOCALE_DA_LINHA("updated")}, $5::jsonb ->> '${IDIOMA_PADRAO}')`);
    expect(sql).toContain(`coalesce($6::jsonb ->> ${LOCALE_DA_LINHA("updated")}, $6::jsonb ->> '${IDIOMA_PADRAO}')`);
    expect(sql).not.toContain(`'${TITULO}'`);
  });

  it("reapExpiredJobs: o mesmo alerta, no idioma da empresa", async () => {
    const { chamadas, db } = bancoQueGuarda();
    await reapExpiredJobs(db as never, { visibilityTimeoutMs: 1000 });
    const { sql, params } = chamadas[0]!;
    const titulos = JSON.parse(params[1] as string) as Record<string, string>;
    expect(titulos.tr).toBe(traduzir(TITULO, "tr"));
    expect(sql).toContain(`coalesce($2::jsonb ->> ${LOCALE_DA_LINHA("expired")}, $2::jsonb ->> '${IDIOMA_PADRAO}')`);
    expect(sql).toContain(`coalesce($3::jsonb ->> ${LOCALE_DA_LINHA("expired")}, $3::jsonb ->> '${IDIOMA_PADRAO}')`);
    expect(sql).not.toContain(`'${TITULO}'`);
  });
});
