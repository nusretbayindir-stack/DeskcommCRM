import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { sincronizarAvisoDoDrain, TITULO_DRAIN_PARADO } from "@/lib/agent-engine/edge/crm/vigilancia-do-drain";
import { sincronizarAvisoDoAgendador, TITULO_DO_AVISO_DO_AGENDADOR } from "@/lib/channels/aviso-do-agendador";
import { sincronizarAvisoDoLacoDeEventLog, TITULO_LACO_EVENT_LOG_DEGRADADO } from "@/lib/event-log/aviso-do-laco";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMAS } from "@/lib/i18n/idiomas";

/**
 * OS AVISOS DA INSTALAÇÃO NO IDIOMA DE CADA EMPRESA (S2a Task 5, U14).
 *
 * Três panes valem para a instalação toda e chegam à Central como uma linha por
 * organização: o laço rápido do event_log degradado, o agendador de pausas que
 * não aplica a batida e o dreno da IA parado. Cada organização recebe a linha no
 * SEU idioma. O título é a chave do dedupe e da resolução, então quem procura o
 * aviso aberto (e quem o fecha) procura o título em todo idioma: o aberto pode
 * ter nascido antes de a empresa trocar de idioma.
 */

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;
const todoIdioma = (titulo: string) => [...new Set(IDIOMAS.map((idioma) => traduzir(titulo, idioma)))];

interface Op {
  tabela: string;
  op: string;
  valores?: unknown;
  filtros: Array<[string, string, unknown]>;
}

/** `organizations` devolve as empresas; `agent_inbox_items` devolve os avisos abertos de `abertas`. */
function adminFalso(orgs: Array<{ id: string; locale: string | null }>, abertas: string[] = []) {
  const ops: Op[] = [];
  const consulta = (tabela: string, op: string, valores?: unknown) => {
    const registro: Op = { tabela, op, valores, filtros: [] };
    ops.push(registro);
    const resultado = () => {
      if (op !== "select") return { data: null, error: null };
      if (tabela === "organizations") return { data: orgs, error: null };
      if (tabela === "agent_inbox_items")
        return { data: abertas.map((id) => ({ id: `aviso-${id}`, organization_id: id })), error: null };
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {};
    for (const f of ["eq", "neq", "in", "is", "limit", "select"]) {
      q[f] = (coluna: string, valor: unknown) => {
        registro.filtros.push([f, coluna, valor]);
        return q;
      };
    }
    q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko);
    return q;
  };
  const admin = {
    from: (tabela: string) => ({
      select: () => consulta(tabela, "select"),
      insert: (v: unknown) => consulta(tabela, "insert", v),
      update: (v: unknown) => consulta(tabela, "update", v),
    }),
  } as never;
  const inseridos = () =>
    ops
      .filter((o) => o.tabela === "agent_inbox_items" && o.op === "insert")
      .flatMap((o) => o.valores as Array<Record<string, unknown>>);
  const filtrosDe = (op: string) =>
    ops.filter((o) => o.tabela === "agent_inbox_items" && o.op === op).flatMap((o) => o.filtros);
  return { admin, inseridos, filtrosDe };
}

const ORGS = [
  { id: "org-tr", locale: "tr" },
  { id: "org-pt", locale: null },
];

describe.each([
  {
    nome: "laço do event_log",
    titulo: TITULO_LACO_EVENT_LOG_DEGRADADO,
    abrir: (admin: never) => sincronizarAvisoDoLacoDeEventLog(admin, "degradado", log),
    fechar: (admin: never) => sincronizarAvisoDoLacoDeEventLog(admin, "saudavel", log),
  },
  {
    nome: "agendador de pausas",
    titulo: TITULO_DO_AVISO_DO_AGENDADOR,
    abrir: (admin: never) => sincronizarAvisoDoAgendador(admin, { estado: "falhou", motivo: "x" }, log),
    fechar: (admin: never) => sincronizarAvisoDoAgendador(admin, { estado: "saudavel" }, log),
  },
])("$nome", ({ titulo, abrir, fechar }) => {
  it("cada organização recebe o aviso no seu idioma", async () => {
    const f = adminFalso(ORGS);
    await abrir(f.admin);
    const porOrg = Object.fromEntries(f.inseridos().map((l) => [l.organization_id, l]));
    expect(porOrg["org-pt"]?.title).toBe(titulo);
    expect(porOrg["org-tr"]?.title).toBe(traduzir(titulo, "tr"));
    expect(porOrg["org-tr"]?.title).not.toBe(titulo);
    expect(porOrg["org-tr"]?.body).not.toBe(porOrg["org-pt"]?.body);
  });

  it("o aviso aberto é procurado pelo título em todo idioma", async () => {
    const f = adminFalso(ORGS, ["org-tr"]);
    await abrir(f.admin);
    expect(f.filtrosDe("select")).toContainEqual(["in", "title", todoIdioma(titulo)]);
    expect(f.inseridos().map((l) => l.organization_id)).toEqual(["org-pt"]);
  });

  it("o fechamento alcança o título em todo idioma", async () => {
    const f = adminFalso(ORGS, ["org-tr"]);
    await fechar(f.admin);
    expect(f.filtrosDe("update")).toContainEqual(["in", "title", todoIdioma(titulo)]);
  });
});

describe("dreno da IA parado (uma instrução SQL)", () => {
  function poolFalso() {
    const consultas: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      async query(sql: string, params: unknown[] = []) {
        consultas.push({ sql, params });
        return { rows: [] };
      },
    } as unknown as pg.Pool;
    return { pool, consultas };
  }

  it("parado: título e corpo em todo idioma, escolhidos pelo idioma de cada organização", async () => {
    const { pool, consultas } = poolFalso();
    await sincronizarAvisoDoDrain(pool, "parado", log);
    const [{ sql, params }] = consultas as [{ sql: string; params: unknown[] }];
    const titulos = JSON.parse(String(params[0])) as Record<string, string>;
    expect(titulos["pt-BR"]).toBe(TITULO_DRAIN_PARADO);
    expect(titulos.tr).toBe(traduzir(TITULO_DRAIN_PARADO, "tr"));
    expect(titulos.tr).not.toBe(TITULO_DRAIN_PARADO);
    expect(sql).toContain("o.locale");
    expect(sql, "o aberto é procurado em todo idioma").toContain("jsonb_each_text($1::jsonb)");
  });

  it("saudável: fecha o título em todo idioma", async () => {
    const { pool, consultas } = poolFalso();
    await sincronizarAvisoDoDrain(pool, "saudavel", log);
    const [{ sql, params }] = consultas as [{ sql: string; params: unknown[] }];
    expect(Object.values(JSON.parse(String(params[0])) as Record<string, string>)).toContain(
      traduzir(TITULO_DRAIN_PARADO, "tr"),
    );
    expect(sql).toContain("jsonb_each_text($1::jsonb)");
  });
});
