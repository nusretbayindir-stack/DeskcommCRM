import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import { drainTick } from "@/lib/agent-engine/edge/crm/drain";
import { reprocessarArquivoDeWebhooks } from "@/lib/channels/reprocessar-arquivo-de-webhook";
import { reprocessarEntradasAceitas } from "@/lib/channels/reprocessar-entradas-aceitas";
import {
  avisoDaMensagemDoNumeroOficial,
  avisoDeEventoMorto,
  DETALHE_TECNICO,
  IA_QUE_NAO_RESPONDEU,
  MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU,
  MENSAGEM_DO_NUMERO_OFICIAL_SEM_ATENDIMENTO,
  MENSAGEM_QUE_NAO_ENTROU,
  TITULO_GENERICO,
  tituloEmTodoIdioma,
} from "@/lib/event-log/aviso-de-evento-morto";
import { avisarEventoMorto } from "@/lib/event-log/drain";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O AVISO `event_dead` NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * Quatro lugares abrem `event_dead` na Central: o dreno de handlers
 * (`lib/event-log/drain.ts`), o dreno do despacho da IA
 * (`lib/agent-engine/edge/crm/drain.ts`) e as duas metades do cron
 * `webhook-replay`. O texto é um só (`aviso-de-evento-morto.ts`) e cada um lê o
 * idioma da empresa na hora de gravar.
 *
 * O título é chave de dedupe (índice único da 0491 e as consultas de "já
 * existe aberto"). Por organização o idioma é um só, então continua um aviso
 * aberto por família; quem procura o aviso aberto procura o título em TODO
 * idioma, porque o aberto pode ter nascido antes de a empresa trocar de idioma.
 * Em português o texto é o de antes, byte a byte.
 */

const FAMILIAS = {
  IA_QUE_NAO_RESPONDEU,
  MENSAGEM_QUE_NAO_ENTROU,
  MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU,
  MENSAGEM_DO_NUMERO_OFICIAL_SEM_ATENDIMENTO,
};

const CONSEQUENCIA_GENERICA_PT =
  "Uma tarefa automática do sistema falhou e parou de tentar: o que ela ia fazer não aconteceu, e não será tentado de novo.";
const REARME_GENERICO_PT =
  "Enquanto este aviso estiver aberto, outras tarefas automáticas que pararem de tentar não abrem aviso novo " +
  "(a IA que deixa de responder um cliente abre o seu próprio): " +
  "depois de corrigida a causa, marque-o como resolvido para voltar a ser avisado.";

describe("aviso de evento morto: o português de antes, byte a byte", () => {
  it("família da IA, 5 tentativas", () => {
    expect(
      avisoDeEventoMorto({
        eventType: "ai_agent.dispatch_requested",
        tentativas: 5,
        motivo: "timeout",
        efeito: IA_QUE_NAO_RESPONDEU,
      }),
    ).toEqual({
      title: "A IA deixou de responder uma mensagem de cliente",
      body:
        `${IA_QUE_NAO_RESPONDEU.consequencia} ${IA_QUE_NAO_RESPONDEU.rearme} ` +
        "Detalhe técnico, para quem der suporte: evento ai_agent.dispatch_requested, 5 tentativas; motivo: timeout",
    });
  });

  it("genérico, nenhuma e uma tentativa; o motivo é cortado em 400", () => {
    const longo = "x".repeat(500);
    expect(avisoDeEventoMorto({ eventType: "media.persist_requested", tentativas: 0, motivo: longo })).toEqual({
      title: "Uma tarefa automática parou de tentar",
      body:
        `${CONSEQUENCIA_GENERICA_PT} ${REARME_GENERICO_PT} ` +
        `Detalhe técnico, para quem der suporte: evento media.persist_requested, nenhuma tentativa; motivo: ${"x".repeat(400)}`,
    });
    expect(avisoDeEventoMorto({ eventType: "a.b", tentativas: 1, motivo: "m" }).body).toMatch(
      /evento a\.b, 1 tentativa; motivo: m$/,
    );
  });

  it("número oficial: a quarta família é o padrão de avisoDaMensagemDoNumeroOficial", () => {
    expect(avisoDaMensagemDoNumeroOficial({ eventType: "message", tentativas: 20, motivo: "m" }).title).toBe(
      MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU.titulo,
    );
  });
});

describe("aviso de evento morto: em cada idioma", () => {
  const casos = [
    ...Object.entries(FAMILIAS).map(([nome, efeito]) => ({ nome, efeito })),
    { nome: "genérico", efeito: undefined },
  ];

  for (const idioma of ["tr", "es"] as const) {
    for (const { nome, efeito } of casos) {
      it(`${nome} em ${idioma}: nada do português, o técnico intacto`, () => {
        const pt = avisoDeEventoMorto({ eventType: "media.persist_requested", tentativas: 5, motivo: "boom 23505", efeito });
        const outro = avisoDeEventoMorto(
          { eventType: "media.persist_requested", tentativas: 5, motivo: "boom 23505", efeito },
          idioma,
        );
        expect(outro.title).not.toBe(pt.title);
        const consequencia = efeito?.consequencia ?? CONSEQUENCIA_GENERICA_PT;
        const rearme = efeito?.rearme ?? REARME_GENERICO_PT;
        expect(outro.body).not.toContain(consequencia.slice(0, 40));
        expect(outro.body).not.toContain(rearme.slice(0, 40));
        expect(outro.body).not.toContain(DETALHE_TECNICO);
        expect(outro.body).toContain(traduzir(DETALHE_TECNICO, idioma));
        expect(outro.body).not.toMatch(/tentativa/);
        expect(outro.body).toContain("media.persist_requested");
        expect(outro.body.endsWith("boom 23505"), "o motivo cru fica no fim, sem tradução").toBe(true);
        expect(outro.body).not.toMatch(/\{[a-z]+\}/);
      });
    }
  }

  it("a contagem muda com o número, em turco", () => {
    const corpo = (tentativas: number) =>
      avisoDeEventoMorto({ eventType: "a.b", tentativas, motivo: "m" }, "tr").body;
    expect(new Set([corpo(0), corpo(1), corpo(5)]).size).toBe(3);
    expect(corpo(5)).toContain("5");
  });

  it("o motivo e o tipo entram como estão: nem `$&` nem `{tipo}` viram outra coisa", () => {
    const { body } = avisoDeEventoMorto({ eventType: "x.{motivo}", tentativas: 2, motivo: "a $& b {tipo}" }, "tr");
    expect(body).toContain("x.{motivo}");
    expect(body.endsWith("a $& b {tipo}")).toBe(true);
  });

  it("o título de cada família em todo idioma visível, sem repetição", () => {
    const titulos = tituloEmTodoIdioma(IA_QUE_NAO_RESPONDEU);
    expect(titulos).toContain(IA_QUE_NAO_RESPONDEU.titulo);
    expect(titulos).toContain(traduzir(IA_QUE_NAO_RESPONDEU.titulo, "tr"));
    expect(titulos).toContain(traduzir(IA_QUE_NAO_RESPONDEU.titulo, "es"));
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});

// ─── Os quatro que gravam ─────────────────────────────────────────────────────

interface Op {
  tabela: string;
  op: "insert" | "update" | "select";
  valores?: Record<string, unknown>;
  filtros: Array<[string, unknown]>;
}

/**
 * Supabase dublê: `organizations` devolve o idioma (ou falha), o SELECT de
 * `webhook_events_log` devolve as linhas UMA vez, o de `agent_inbox_items` diz
 * se já há aviso aberto.
 */
function adminFalso(opts: { locale?: string | null; idiomaFalha?: boolean; avisoAberto?: boolean; linhas?: unknown[] }) {
  const ops: Op[] = [];
  let linhas = opts.linhas ?? [];
  const consulta = (tabela: string, op: Op["op"], valores?: Record<string, unknown>) => {
    const registro: Op = { tabela, op, filtros: [], ...(valores ? { valores } : {}) };
    ops.push(registro);
    const resultado = () => {
      if (tabela === "organizations")
        return opts.idiomaFalha
          ? { data: null, error: { message: "banco fora" } }
          : { data: { locale: opts.locale ?? null }, error: null };
      if (op === "insert") return { data: null, error: null };
      if (op === "update") return { data: [{ id: "l1" }], error: null };
      if (tabela === "webhook_events_log") {
        const lidas = linhas;
        linhas = [];
        return { data: lidas, error: null };
      }
      if (tabela === "agent_inbox_items") return { data: opts.avisoAberto ? { id: "aviso-1" } : null, error: null };
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {};
    for (const f of ["eq", "neq", "like", "lt", "gte", "is", "in", "order", "limit", "select"]) {
      q[f] = (coluna: string, valor: unknown) => {
        registro.filtros.push([`${f}:${coluna}`, valor]);
        return q;
      };
    }
    q.maybeSingle = async () => resultado();
    q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko);
    return q;
  };
  const admin = {
    from: (tabela: string) => ({
      insert: (v: Record<string, unknown>) => consulta(tabela, "insert", v),
      update: (v: Record<string, unknown>) => consulta(tabela, "update", v),
      select: () => consulta(tabela, "select"),
    }),
  };
  const avisos = () =>
    ops.filter((o) => o.tabela === "agent_inbox_items" && o.op === "insert").map((o) => o.valores!);
  const dedupe = () => ops.find((o) => o.tabela === "agent_inbox_items" && o.op === "select");
  const leuOIdioma = () => ops.some((o) => o.tabela === "organizations");
  return { admin, avisos, dedupe, leuOIdioma };
}

const ORG = "abcd0000-0000-4000-8000-000000000001";
const EVENTO = { id: "ev-1", organization_id: ORG, event_type: "media.persist_requested", attempts: 4 };

describe("dreno de handlers (lib/event-log/drain.ts)", () => {
  it("empresa em turco → o aviso genérico sai em turco", async () => {
    const f = adminFalso({ locale: "tr" });
    await avisarEventoMorto(f.admin as never, EVENTO, "boom");
    expect(f.avisos()).toEqual([
      expect.objectContaining({ kind: "event_dead", title: traduzir(TITULO_GENERICO, "tr") }),
    ]);
    expect(traduzir(TITULO_GENERICO, "tr")).not.toBe(TITULO_GENERICO);
  });

  it("o dedupe deixa de fora o aviso aberto das outras famílias em TODO idioma", async () => {
    const f = adminFalso({ locale: "tr" });
    await avisarEventoMorto(f.admin as never, EVENTO, "boom");
    const excluidos = f
      .dedupe()!
      .filtros.filter(([filtro]) => filtro === "neq:title")
      .map(([, valor]) => valor);
    for (const efeito of Object.values(FAMILIAS))
      for (const titulo of tituloEmTodoIdioma(efeito)) expect(excluidos).toContain(titulo);
  });

  it("idioma ilegível → português, e o aviso sai mesmo assim", async () => {
    const f = adminFalso({ idiomaFalha: true });
    await avisarEventoMorto(f.admin as never, EVENTO, "boom");
    expect(f.avisos()).toEqual([expect.objectContaining({ title: TITULO_GENERICO })]);
  });

  it("aviso já aberto → nem lê o idioma", async () => {
    const f = adminFalso({ locale: "tr", avisoAberto: true });
    await avisarEventoMorto(f.admin as never, EVENTO, "boom");
    expect(f.avisos()).toEqual([]);
    expect(f.leuOIdioma()).toBe(false);
  });
});

describe("dreno do despacho da IA (edge/crm/drain.ts)", () => {
  const KNOBS = { batchSize: 10, intervalMs: 0, idleIntervalMs: 0, debounceMs: 0, reapTimeoutMs: 60_000 };

  function poolQueFalha(opts: { locale?: string; idiomaFalha?: boolean }) {
    const inserts: unknown[][] = [];
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("returning e.id"))
        return {
          rows: [
            {
              id: "ev-1",
              organization_id: ORG,
              attempts: 5,
              created_at: new Date().toISOString(),
              payload: {
                conversation_id: "11111111-1111-4111-8111-111111111111",
                contact_id: "22222222-2222-4222-8222-222222222222",
                channel_session_id: "33333333-3333-4333-8333-333333333333",
                inbound_message_id: "44444444-4444-4444-8444-444444444444",
              },
            },
          ],
        };
      if (sql.includes("ai_dispatch_mode")) throw new Error("timeout");
      if (sql.includes("select locale from organizations")) {
        if (opts.idiomaFalha) throw new Error("banco fora");
        return { rows: [{ locale: opts.locale ?? null }] };
      }
      if (sql.includes("insert into agent_inbox_items")) {
        inserts.push(params);
        return { rows: [{ id: "aviso-1" }] };
      }
      return { rows: [] };
    });
    return { pool: { query } as unknown as pg.Pool, titulos: () => inserts.map((p) => p[3]) };
  }
  const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

  it("empresa em turco → a IA que não respondeu, em turco", async () => {
    const { pool, titulos } = poolQueFalha({ locale: "tr" });
    await drainTick(pool, KNOBS, log() as never);
    expect(titulos()).toEqual([traduzir(IA_QUE_NAO_RESPONDEU.titulo, "tr")]);
    expect(titulos()[0]).not.toBe(IA_QUE_NAO_RESPONDEU.titulo);
  });

  it("idioma ilegível → português, e o aviso sai mesmo assim", async () => {
    const { pool, titulos } = poolQueFalha({ idiomaFalha: true });
    await drainTick(pool, KNOBS, log() as never);
    expect(titulos()).toEqual([IA_QUE_NAO_RESPONDEU.titulo]);
  });
});

describe("cron webhook-replay: as duas metades", () => {
  const linha = (extra: Record<string, unknown>) => ({
    id: "l1",
    organization_id: ORG,
    channel_session_id: "s1",
    payload_parsed: null,
    raw_body: null,
    attempts: 3,
    error_message: "transitoria: x",
    ...extra,
  });

  it("canal por QR, arquivo sem corpo → a mensagem que não entrou, em turco; o dedupe procura todo idioma", async () => {
    const f = adminFalso({ locale: "tr", linhas: [linha({})] });
    await reprocessarArquivoDeWebhooks(f.admin as never, new Date(), "req");
    expect(f.avisos()).toEqual([
      expect.objectContaining({ title: traduzir(MENSAGEM_QUE_NAO_ENTROU.titulo, "tr") }),
    ]);
    expect(f.avisos()[0]!.title).not.toBe(MENSAGEM_QUE_NAO_ENTROU.titulo);
    expect(f.dedupe()!.filtros).toContainEqual(["in:title", tituloEmTodoIdioma(MENSAGEM_QUE_NAO_ENTROU)]);
  });

  it("número oficial, arquivo sem corpo → em turco; o dedupe procura todo idioma", async () => {
    const f = adminFalso({ locale: "tr", linhas: [linha({})] });
    await reprocessarEntradasAceitas(f.admin as never, new Date());
    expect(f.avisos()).toEqual([
      expect.objectContaining({ title: traduzir(MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU.titulo, "tr") }),
    ]);
    expect(f.avisos()[0]!.title).not.toBe(MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU.titulo);
    expect(f.dedupe()!.filtros).toContainEqual([
      "in:title",
      tituloEmTodoIdioma(MENSAGEM_DO_NUMERO_OFICIAL_QUE_NAO_ENTROU),
    ]);
  });

  it("idioma ilegível → português, e o aviso sai mesmo assim", async () => {
    const f = adminFalso({ idiomaFalha: true, linhas: [linha({})] });
    await reprocessarArquivoDeWebhooks(f.admin as never, new Date(), "req");
    expect(f.avisos()).toEqual([expect.objectContaining({ title: MENSAGEM_QUE_NAO_ENTROU.titulo })]);
  });
});
