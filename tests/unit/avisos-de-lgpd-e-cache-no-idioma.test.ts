import { describe, expect, it, vi } from "vitest";

import { escalateLgpdVeto } from "@/lib/agent-engine/guardrails/lgpd/legal-basis";
import { evaluateCacheHitAlert } from "@/lib/agent-engine/obs/metrics";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O AVISO DO VETO DE LGPD E O DO CACHE ABAIXO DO ALVO SAEM NO IDIOMA DA
 * EMPRESA (S2a Task 5, U14). Os dois gravam por SQL; o título e o corpo vão
 * como parâmetros (nenhum português fixo no SQL) e a deduplicação continua
 * por `ref_kind`, que não muda com o idioma.
 *
 * No turco a lei citada é a GDPR (o mesmo do resto do catálogo turco); no
 * espanhol fica LGPD, como nos outros textos espanhóis.
 */

function pgFalso(opcoes: { locale: string | null; runs?: number; media?: number }) {
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      if (/from organizations/.test(sql)) return { rows: [{ locale: opcoes.locale }], rowCount: 1 };
      if (/from metrics/.test(sql)) return { rows: [{ runs: opcoes.runs ?? 40, avg_ratio: opcoes.media ?? 0.2 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }),
  };
  const insert = () => consultas.find((c) => /insert into agent_inbox_items/.test(c.sql));
  return { pool, consultas, insert };
}

const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as never;

const ANON_PT = {
  title: "Contato anonimizado — envio bloqueado por LGPD",
  body:
    "O contato deste lead está anonimizado no CRM (anonimização é irreversível): nenhum envio " +
    "pode ir a ele. Confira o cadastro no CRM — se for engano, reverta a anonimização lá.",
};
const BASE_PT = {
  title: "Base legal ausente/inválida — 1º toque bloqueado por LGPD",
  body:
    "O 1º toque de prospecção a este lead foi bloqueado por falta de base legal válida " +
    '(consent concedido, ou legitimate_interest com LIA; origem "import" exige prova). ' +
    "Registre a base legal no CRM antes de prospectar este contato.",
};

describe("veto de LGPD", () => {
  it("português: título e corpo de sempre, como parâmetros", async () => {
    for (const [code, esperado] of [
      ["lgpd_anonymized", ANON_PT],
      ["lgpd_missing_legal_basis", BASE_PT],
    ] as const) {
      const alvo = pgFalso({ locale: "pt-BR" });
      await escalateLgpdVeto(alvo.pool as never, { tenantId: "org-1", leadId: "lead-1", code }, log);
      expect(alvo.insert()!.params).toEqual(["org-1", esperado.title, esperado.body, "lead-1"]);
    }
  });

  it("turco: traduzido, e a lei citada é a GDPR", async () => {
    for (const [code, pt] of [
      ["lgpd_anonymized", ANON_PT],
      ["lgpd_missing_legal_basis", BASE_PT],
    ] as const) {
      const alvo = pgFalso({ locale: "tr" });
      await escalateLgpdVeto(alvo.pool as never, { tenantId: "org-1", leadId: "lead-1", code }, log);
      const [, title, body] = alvo.insert()!.params as string[];
      expect(title).toBe(traduzir(pt.title, "tr"));
      expect(title).not.toBe(pt.title);
      expect(title).toContain("GDPR");
      expect(title).not.toContain("LGPD");
      expect(body).toBe(traduzir(pt.body, "tr"));
      expect(body).not.toBe(pt.body);
    }
  });

  it("espanhol: traduzido", async () => {
    const alvo = pgFalso({ locale: "es" });
    await escalateLgpdVeto(alvo.pool as never, { tenantId: "org-1", leadId: "lead-1", code: "lgpd_anonymized" }, log);
    const [, title, body] = alvo.insert()!.params as string[];
    expect(title).toBe(traduzir(ANON_PT.title, "es"));
    expect(title).not.toBe(ANON_PT.title);
    expect(body).not.toBe(ANON_PT.body);
  });
});

describe("cache abaixo do alvo", () => {
  const knobs = { windowMs: 3_600_000, cacheHitAlertMinRuns: 10, cacheHitAlertThreshold: 0.5 };

  it("português: o texto de sempre, agora como parâmetro (sem português fixo no SQL)", async () => {
    const alvo = pgFalso({ locale: null, runs: 40, media: 0.2 });
    const r = await evaluateCacheHitAlert(alvo.pool as never, "org-1", knobs);

    expect(r.alerted).toBe(true);
    const insert = alvo.insert()!;
    expect(insert.sql).not.toContain("Cache hit");
    expect(insert.params).toContain("Cache hit de prompt abaixo do alvo — custo por run acima do esperado");
    expect(insert.params).toContain(
      "média de cache_read/input nos últimos 40 runs da janela = 20.0% (alvo ≥ 50%). " +
        "Prefixo do prompt possivelmente abaixo do mínimo cacheável do modelo ou com conteúdo " +
        "volátil antes do último breakpoint — ver CLAUDE.md regra 15 e o smoke de caching.",
    );
  });

  it("turco: título e corpo traduzidos, com os números no lugar", async () => {
    const alvo = pgFalso({ locale: "tr", runs: 40, media: 0.2 });
    await evaluateCacheHitAlert(alvo.pool as never, "org-1", knobs);

    const params = alvo.insert()!.params as string[];
    const titulo = traduzir("Cache hit de prompt abaixo do alvo — custo por run acima do esperado", "tr");
    expect(titulo).not.toBe("Cache hit de prompt abaixo do alvo — custo por run acima do esperado");
    expect(params).toContain(titulo);
    const corpo = params.find((p) => typeof p === "string" && p.includes("20.0"))!;
    expect(corpo).toContain("40");
    expect(corpo).toContain("50");
    expect(corpo).not.toContain("média de cache_read/input");
  });

  it("sem alerta, o idioma nem é lido", async () => {
    const alvo = pgFalso({ locale: "tr", runs: 40, media: 0.9 });
    const r = await evaluateCacheHitAlert(alvo.pool as never, "org-1", knobs);

    expect(r.alerted).toBe(false);
    expect(alvo.consultas.some((c) => /from organizations/.test(c.sql))).toBe(false);
  });
});
