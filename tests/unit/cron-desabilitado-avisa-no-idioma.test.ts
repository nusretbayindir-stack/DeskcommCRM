import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { tickCron, type CronTickConfig } from "@/lib/agent-engine/cron/scheduler";
import type { Logger } from "@/lib/agent-engine/obs/logger";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO } from "@/lib/i18n/idiomas";

/**
 * O CRON DESABILITADO AVISA A EQUIPE NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * O aviso nasce DENTRO da transação que desabilita o cron: uma leitura a mais que
 * falhasse ali abortaria a transação inteira. Então o título vai em todo idioma
 * num jsonb e o próprio insert escolhe pelo `organizations.locale`
 * (`lib/i18n/em-cada-idioma.ts`) — sem query extra, e sem locale o padrão.
 */
const TITULO = "Cron desabilitado após falha de disparo";
const ORG = "00000000-0000-4000-8000-000000000001";
const CRON_ROW = {
  id: "cron-1",
  organization_id: ORG,
  contact_id: "00000000-0000-4000-8000-000000000002",
  kind: "every",
  interval_ms: "60000",
  cron_expr: null,
  tz: "Europe/Brussels",
  job_kind: "followup_turn",
  payload: {},
  next_run_at: new Date("2026-09-17T11:59:00.000Z"),
  enabled: true,
  attempts: 0,
  max_attempts: 5,
  last_error: null,
  created_at: new Date("2026-09-01T00:00:00.000Z"),
  updated_at: new Date("2026-09-01T00:00:00.000Z"),
  operante: true,
};
const LOG: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;
const CFG: CronTickConfig = {
  batchSize: 1,
  staggerWindowMs: 60_000,
  retryBaseMs: 10_000,
  now: () => Date.parse("2026-09-17T12:00:00.000Z"),
};

function cenario() {
  const chamadas: Array<{ sql: string; params: unknown[] }> = [];
  const cliente = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      chamadas.push({ sql: String(sql), params });
      const s = String(sql).toLowerCase();
      if (s.includes("from cron_jobs")) return { rows: [CRON_ROW], rowCount: 1 };
      // 23505: erro permanente — o cron é desabilitado e a equipe avisada.
      if (s.includes("insert into job_queue")) throw Object.assign(new Error("duplicate key"), { code: "23505" });
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => cliente), query: vi.fn(async () => ({ rows: [], rowCount: 0 })) };
  return { chamadas, pool: pool as unknown as pg.Pool };
}

describe("o cron desabilitado avisa no idioma da empresa", () => {
  it("o título vai em todo idioma e o insert escolhe pelo locale da empresa", async () => {
    const { chamadas, pool } = cenario();
    const tick = await tickCron(pool, CFG, LOG);
    expect(tick.disabled).toBe(1);

    const aviso = chamadas.find((c) => c.sql.includes("insert into agent_inbox_items"));
    expect(aviso, "o aviso foi gravado").toBeDefined();
    expect(aviso!.sql).not.toContain(`'${TITULO}'`);
    expect(aviso!.sql).toContain(
      `coalesce($4::jsonb ->> (select o.locale from organizations o where o.id = $1), $4::jsonb ->> '${IDIOMA_PADRAO}')`,
    );
    const titulos = JSON.parse(aviso!.params[3] as string) as Record<string, string>;
    expect(titulos[IDIOMA_PADRAO]).toBe(TITULO);
    expect(titulos.tr).toBe(traduzir(TITULO, "tr"));
    expect(titulos.tr).not.toBe(TITULO);
  });
});
