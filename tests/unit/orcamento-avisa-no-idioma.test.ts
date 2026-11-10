import { beforeEach, describe, expect, it, vi } from "vitest";

import { corpoDoBloqueio, textoDaCentral, type TextoDaCentral } from "@/lib/agent-engine/edge/llm/orcamento";
import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";
import { esquecerMemoDosModulos } from "@/lib/instalacao/modulos";

/**
 * OS AVISOS DE ORÇAMENTO E DE TETO DO PLANO SAEM NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * - O bloqueio (`budget_exceeded`) lê o idioma na hora de gravar.
 * - O aviso (`budget_warning`) nasce dentro do statement do orçamento; ele devolve
 *   o id do aviso que abriu, e só então o idioma é lido e o aviso traduzido —
 *   uma leitura por aviso, não uma por chamada de IA.
 * - Leitura do idioma falhando: o aviso sai em português e é gravado do mesmo jeito.
 */
beforeEach(() => esquecerMemoDosModulos());

const ORG = "44444444-4444-4444-8444-444444444444";
const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000);
const SENTINELA = new Error("o provedor foi alcançado");
const ARMADO_E_ESTOURADO = {
  teto: 1000,
  modo: "bloquear",
  efetivo_em: ONTEM,
  limiar_pct: 80,
  gasto: "1500.0000",
  avisado_antes: true,
};

interface Estado {
  gate?: Record<string, unknown>;
  config?: Record<string, unknown>;
  plano?: { teto: number | null; gasto?: string };
  /** `organizations.locale`; "erro" faz a leitura do idioma lançar. */
  locale?: string | null | "erro";
}

function poolFalso(estado: Estado) {
  const inboxInserts: unknown[][] = [];
  const traducoes: unknown[][] = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("select locale from organizations")) {
      if (estado.locale === "erro") throw new Error("connection reset");
      return { rows: estado.locale === undefined ? [] : [{ locale: estado.locale }] };
    }
    if (sql.includes("fn_cobranca_ligada")) return { rows: [{ ligada: true }] };
    if (sql.includes("fn_limite_do_plano")) {
      const p = estado.plano ?? { teto: null };
      return { rows: [{ teto: p.teto, gasto: p.teto === null ? null : (p.gasto ?? "0") }] };
    }
    if (sql.includes("fn_gasto_de_ia_do_mes")) return { rows: [{ ...ARMADO_E_ESTOURADO, ...(estado.gate ?? {}) }] };
    if (sql.includes("left join ai_budgets")) {
      return {
        rows: [
          {
            llm: { provider: "anthropic", default_model: "claude-padrao", params: {}, enabled_models: [] },
            teto: 1000,
            modo: "bloquear",
            efetivo_em: ONTEM,
            limiar_pct: 80,
            ...(estado.config ?? {}),
          },
        ],
      };
    }
    if (sql.includes("update agent_inbox_items set title")) {
      traducoes.push(params);
      return { rows: [] };
    }
    if (sql.includes("insert into agent_inbox_items")) {
      inboxInserts.push(params);
      return { rows: [] };
    }
    if (sql.includes("insert into llm_calls")) return { rows: [{ id: "call-1" }] };
    return { rows: [] };
  });
  return { pool: { query } as never, inboxInserts, traducoes };
}

function registry() {
  const fabrica = (_chave: string, modelo: string) =>
    ({
      specificationVersion: "v3",
      provider: "anthropic",
      modelId: modelo,
      doGenerate: async () => {
        throw SENTINELA;
      },
    }) as never;
  return { anthropic: fabrica, openai: fabrica, google: fabrica, openrouter: fabrica };
}

async function chamar(estado: Estado) {
  const p = poolFalso(estado);
  try {
    await runModelCall(
      p.pool,
      { anthropicApiKey: "sk-ant-x", cacheTtl: "1h" },
      { tenantId: ORG, messages: [{ role: "user", content: "oi" }] } as never,
      { registry: registry() as never, log: { info: () => {}, warn: () => {}, error: () => {} } as never },
    );
  } catch {
    // a recusa (ou o provedor sentinela) — o que importa aqui é o que foi gravado
  }
  return p;
}

describe("os textos da Central do orçamento", () => {
  it("o corpo do bloqueio em português é o de antes, byte a byte", () => {
    expect(corpoDoBloqueio(1500, 1000)).toBe(
      "O gasto de IA deste mês chegou a US$ 15,00 de um limite de US$ 10,00 (150%), " +
        "e você escolheu que a IA parasse ao chegar nele. " +
        "As conversas que estavam sendo atendidas foram para a FILA DE ATENDIMENTO HUMANO — " +
        "ninguém ficou sem próximo passo, mas alguém precisa responder. " +
        "Aumentar o limite ou desligar a parada em Uso de IA › Orçamento evita paradas NOVAS; " +
        'cada conversa já parada volta ao automático pelo botão "Devolver ao automático" ' +
        "no cabeçalho dela.",
    );
  });

  it("em turco, com os números no lugar", () => {
    const corpo = corpoDoBloqueio(1500, 1000, "tr");
    expect(corpo).toContain("US$ 15,00");
    expect(corpo).toContain("US$ 10,00");
    expect(corpo).toContain("%150");
    expect(corpo).not.toMatch(/[{}]/);
    expect(corpo).not.toBe(corpoDoBloqueio(1500, 1000));
  });

  it.each([
    "avisoTitulo",
    "avisoCorpo",
    "bloqueioTitulo",
    "tetoDoPlanoTitulo",
    "tetoDoPlanoCorpo",
  ] satisfies TextoDaCentral[])("%s tem turco", (chave) => {
    expect(textoDaCentral(chave, "tr")).not.toBe(textoDaCentral(chave));
  });
});

describe("o gate grava os avisos no idioma da empresa", () => {
  it("bloqueio do orçamento da empresa: em turco, com os números", async () => {
    const r = await chamar({ locale: "tr" });
    expect(r.inboxInserts).toHaveLength(1);
    const [, titulo, corpo] = r.inboxInserts[0] as [string, string, string];
    expect(titulo).toBe(textoDaCentral("bloqueioTitulo", "tr"));
    expect(corpo).toBe(corpoDoBloqueio(1500, 1000, "tr"));
  });

  it("leitura do idioma falhando: o bloqueio sai em português e é gravado", async () => {
    const r = await chamar({ locale: "erro" });
    expect(r.inboxInserts).toHaveLength(1);
    const [, titulo] = r.inboxInserts[0] as [string, string];
    expect(titulo).toBe(textoDaCentral("bloqueioTitulo"));
  });

  it("teto do plano: em turco", async () => {
    const r = await chamar({ locale: "tr", plano: { teto: 100, gasto: "500" } });
    const [, titulo, corpo] = r.inboxInserts[0] as [string, string, string];
    expect(titulo).toBe(textoDaCentral("tetoDoPlanoTitulo", "tr"));
    expect(corpo).toBe(textoDaCentral("tetoDoPlanoCorpo", "tr"));
  });

  it("aviso aberto pelo statement: traduzido depois, só ele, pelo id", async () => {
    const aviso = { modo: "avisar", avisado_antes: false, aviso_id: "aviso-1" };
    const r = await chamar({ locale: "tr", gate: aviso, config: { modo: "avisar" } });
    expect(r.traducoes).toEqual([["aviso-1", textoDaCentral("avisoTitulo", "tr"), textoDaCentral("avisoCorpo", "tr")]]);
  });

  it("aviso numa empresa em português: nada a traduzir", async () => {
    const aviso = { modo: "avisar", avisado_antes: false, aviso_id: "aviso-1" };
    const r = await chamar({ locale: "pt-BR", gate: aviso, config: { modo: "avisar" } });
    expect(r.traducoes).toEqual([]);
  });

  it("sem aviso aberto (aviso_id nulo): o idioma nem é lido para isso", async () => {
    const r = await chamar({ locale: "tr", gate: { modo: "avisar", avisado_antes: true, aviso_id: null }, config: { modo: "avisar" } });
    expect(r.traducoes).toEqual([]);
  });
});
