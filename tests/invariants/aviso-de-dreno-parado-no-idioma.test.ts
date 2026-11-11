import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sincronizarAvisoDoDrain, TITULO_DRAIN_PARADO } from "@/lib/agent-engine/edge/crm/vigilancia-do-drain";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O AVISO DO DRENO PARADO SAI NO IDIOMA DE CADA EMPRESA (S2a Task 5, U14).
 *
 * `sincronizarAvisoDoDrain` grava uma linha por organização numa instrução só,
 * com o título e o corpo em todo idioma num jsonb e o SQL escolhendo pelo
 * `organizations.locale` da linha. SQL não se prova com dublê: um erro de
 * sintaxe aqui vira `warn` e o aviso some em silêncio — o pior desfecho para
 * um aviso de pane. Por isso este arquivo roda contra Postgres.
 *
 *   1. empresa em turco recebe o título turco, em neerlandês o neerlandês (nl
 *      visível desde o doc S2a, Task 7); idioma ainda escondido (`en`) e sem
 *      idioma recebem o português — o mesmo de `normalizarIdioma`;
 *   2. o aviso aberto noutro idioma (a empresa trocou de idioma) segura o novo:
 *      um por organização, procurado em todo idioma;
 *   3. a segunda rodada não duplica;
 *   4. saudável fecha o aviso em qualquer idioma.
 */

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db` (scripts/test-db.sh)");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});

const ORG_TR = "d1a90000-0000-4000-8000-000000000001";
const ORG_PT = "d1a90000-0000-4000-8000-000000000002";
const ORG_ESCONDIDO = "d1a90000-0000-4000-8000-000000000003";
const ORG_TROCOU = "d1a90000-0000-4000-8000-000000000004";
const ORG_NL = "d1a90000-0000-4000-8000-000000000005";
const ORGS = [ORG_TR, ORG_PT, ORG_ESCONDIDO, ORG_TROCOU, ORG_NL];

const warn = vi.fn();
const log = { info: vi.fn(), warn, error: vi.fn() } as never;
const TITULO_TR = traduzir(TITULO_DRAIN_PARADO, "tr");
const TITULO_NL = traduzir(TITULO_DRAIN_PARADO, "nl");

async function abertos(org: string): Promise<string[]> {
  const { rows } = await pool.query<{ title: string }>(
    "select title from agent_inbox_items where organization_id = $1 and kind = 'other' and status = 'open' order by created_at",
    [org],
  );
  return rows.map((r) => r.title);
}

beforeAll(async () => {
  for (const [id, slug, locale] of [
    [ORG_TR, "dreno-idioma-tr", "tr"],
    [ORG_PT, "dreno-idioma-pt", "pt-BR"],
    [ORG_ESCONDIDO, "dreno-idioma-en", "en"],
    [ORG_TROCOU, "dreno-idioma-trocou", "tr"],
    [ORG_NL, "dreno-idioma-nl", "nl"],
  ] as const) {
    await pool.query(
      `insert into organizations (id, slug, legal_name, display_name, locale)
       values ($1, $2, 'Org Dreno LTDA', 'Org Dreno', $3)
       on conflict (id) do nothing`,
      [id, slug, locale],
    );
  }
  // A empresa que trocou de idioma: o aviso aberto nasceu em português.
  await pool.query(
    `insert into agent_inbox_items (organization_id, kind, severity, title, body)
     values ($1, 'other', 'warn', $2, 'corpo antigo')`,
    [ORG_TROCOU, TITULO_DRAIN_PARADO],
  );
});

afterAll(async () => {
  await pool.query("delete from agent_inbox_items where organization_id = any($1)", [ORGS]);
  await pool.query("delete from organizations where id = any($1)", [ORGS]);
  await pool.end();
});

describe("aviso do dreno parado, no idioma de cada empresa", () => {
  it("parado: uma linha por empresa, no idioma dela; o aviso antigo noutro idioma segura o novo", async () => {
    expect(TITULO_TR).not.toBe(TITULO_DRAIN_PARADO);
    expect(TITULO_NL).not.toBe(TITULO_DRAIN_PARADO);

    await sincronizarAvisoDoDrain(pool, "parado", log);
    await sincronizarAvisoDoDrain(pool, "parado", log);

    expect(warn, "o SQL falhou e o aviso sumiu em silêncio").not.toHaveBeenCalled();
    expect(await abertos(ORG_TR)).toEqual([TITULO_TR]);
    expect(await abertos(ORG_PT)).toEqual([TITULO_DRAIN_PARADO]);
    expect(await abertos(ORG_NL), "neerlandês visível recebe o neerlandês").toEqual([TITULO_NL]);
    expect(await abertos(ORG_ESCONDIDO), "idioma escondido cai no português").toEqual([TITULO_DRAIN_PARADO]);
    expect(await abertos(ORG_TROCOU)).toEqual([TITULO_DRAIN_PARADO]);

    const { rows } = await pool.query<{ body: string }>(
      "select body from agent_inbox_items where organization_id = $1 and status = 'open'",
      [ORG_TR],
    );
    expect(rows[0]?.body).toBe(
      traduzir(
        "O processamento que transforma as mensagens recebidas em respostas da IA parou de avançar. As mensagens continuam chegando e ficando registradas, mas a IA não responde até o processamento voltar. Quem administra a instalação deve revisar o serviço do worker (log e /healthz) e reiniciá-lo se ele não voltar sozinho.",
        "tr",
      ),
    );
  });

  it("saudável: fecha o aviso em qualquer idioma", async () => {
    await sincronizarAvisoDoDrain(pool, "saudavel", log);
    for (const org of ORGS) expect(await abertos(org), org).toEqual([]);
  });
});
