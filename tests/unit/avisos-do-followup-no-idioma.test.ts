import { describe, expect, it, vi } from "vitest";

import { StaleServiceBoundaryError } from "@/lib/atendimento/fronteira";
import {
  avisoDeFluxoParado,
  avisoDeRetornoCancelado,
  avisoDeRetornoSemVaga,
  textoDaRecuperacaoEsgotada,
} from "@/lib/followup/avisos-da-central";
import { avancarEnrollmentAtivo, createSupabaseAdminClient, type AdminClient } from "@/lib/followup/engine";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";
import { createPgAdminClient } from "@/lib/followup/turn-bridge";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

/**
 * OS AVISOS DO ACOMPANHAMENTO SAEM NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * A Central mostra `title`/`body` como foram gravados, então a tradução é na
 * gravação. Três famílias saem do motor de follow-up:
 *
 *   - o fluxo que parou de tentar (`markDead`);
 *   - o retorno programado cancelado (vaga ocupada 7 dias, ou atendimento/agenda
 *     vencidos no meio da espera);
 *   - o cliente que faltou e não respondeu à recuperação (as duas portas, a do
 *     Supabase e a do pg).
 *
 * O português continua byte a byte o de antes: os dublês dos outros testes (e
 * quem lê a Central hoje) não podem notar a mudança.
 */

const VALORES = { nome: "Retorno {id} $& pós-venda", id: "enr-9" };

describe("os textos, em todo idioma", () => {
  it("português: o mesmo texto de antes, byte a byte", () => {
    expect(avisoDeFluxoParado({ ...VALORES, motivo: "max_steps" }, "pt-BR")).toEqual({
      title: "Um fluxo de follow-up parou de tentar",
      body: 'O fluxo "Retorno {id} $& pós-venda" (enrollment enr-9) foi marcado como "dead": max_steps',
    });
    expect(avisoDeRetornoSemVaga(VALORES, "pt-BR")).toEqual({
      title: "Um retorno programado não pôde ser enviado",
      body:
        'O fluxo "Retorno {id} $& pós-venda" esperou 7 dias o outro acompanhamento deste contato terminar, ' +
        "e o envio foi cancelado (enrollment enr-9). " +
        "Fale com o contato por outro caminho se ainda fizer sentido.",
    });
    expect(avisoDeRetornoCancelado({ ...VALORES, causa: "fronteira" }, "pt-BR")).toEqual({
      title: "Um retorno programado não pôde ser enviado",
      body:
        'O fluxo "Retorno {id} $& pós-venda" esperava a data do retorno, mas o atendimento que o originou foi encerrado ou substituído ' +
        "no meio da espera, e o envio foi cancelado " +
        "(enrollment enr-9). Fale com o contato por outro caminho se ainda fizer sentido.",
    });
    expect(avisoDeRetornoCancelado({ ...VALORES, causa: "agenda" }, "pt-BR").body).toContain(
      "mas a agenda do acompanhamento deixou de valer no meio da espera",
    );
    expect(textoDaRecuperacaoEsgotada("pt-BR")).toEqual({
      title: "Cliente faltou e não respondeu à recuperação",
      body:
        "As mensagens de reengajamento pós-falta foram enviadas e o cliente não respondeu. " +
        "Decida o próximo passo e mova o card no funil.",
    });
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: título e corpo traduzidos, com os valores no lugar e crus`, () => {
      const avisos = [
        avisoDeFluxoParado({ ...VALORES, motivo: "max_steps" }, idioma),
        avisoDeRetornoSemVaga(VALORES, idioma),
        avisoDeRetornoCancelado({ ...VALORES, causa: "fronteira" }, idioma),
        avisoDeRetornoCancelado({ ...VALORES, causa: "agenda" }, idioma),
      ];
      const emPortugues = [
        avisoDeFluxoParado({ ...VALORES, motivo: "max_steps" }, "pt-BR"),
        avisoDeRetornoSemVaga(VALORES, "pt-BR"),
        avisoDeRetornoCancelado({ ...VALORES, causa: "fronteira" }, "pt-BR"),
        avisoDeRetornoCancelado({ ...VALORES, causa: "agenda" }, "pt-BR"),
      ];
      avisos.forEach((aviso, i) => {
        expect(aviso.title, `aviso ${i}`).not.toBe(emPortugues[i]!.title);
        expect(aviso.body, `aviso ${i}`).not.toBe(emPortugues[i]!.body);
        // O valor de fora entra como está: nem `{id}` vira o id, nem `$&` vira padrão.
        expect(aviso.body, `aviso ${i}`).toContain('"Retorno {id} $& pós-venda"');
        expect(aviso.body, `aviso ${i}`).toContain("enr-9");
        // Fora o valor de fora (que traz `{id}` de propósito), nenhuma marca ficou sem valor.
        expect(aviso.body.replace(VALORES.nome, ""), `aviso ${i}: marca sem valor`).not.toMatch(
          /\{(nome|id|motivo|causa)\}/,
        );
      });
      expect(avisos[0]!.body).toContain("max_steps");
      // As duas causas não podem sair com a mesma frase: é a distinção do #2709.
      expect(avisos[2]!.body).not.toBe(avisos[3]!.body);

      const recuperacao = textoDaRecuperacaoEsgotada(idioma);
      expect(recuperacao.title).not.toBe(textoDaRecuperacaoEsgotada("pt-BR").title);
      expect(recuperacao.body).not.toBe(textoDaRecuperacaoEsgotada("pt-BR").body);
    });
  }
});

// ─── o motor: os caminhos que abrem o aviso leem o idioma da empresa ───

const NOW = new Date("2026-11-10T12:00:00.000Z");

function inscricao(status: EnrollmentRow["status"], passos = 3): EnrollmentRow {
  return {
    id: "enr-1",
    organization_id: "org-1",
    pointer_id: "ptr-1",
    version_id: "ver-1",
    contact_id: "contact-1",
    conversation_id: "conv-1",
    current_node_id: "wait-3",
    status,
    next_eval_at: NOW.toISOString(),
    claimed_until: null,
    attempts: 0,
    max_attempts: 5,
    last_error: null,
    steps_taken: passos,
    outcome: null,
    cancel_reason: null,
    started_at: "2026-11-01T12:00:00.000Z",
    completed_at: null,
    updated_at: NOW.toISOString(),
  };
}

function motor(opcoes: { idioma?: Idioma; fronteiraVencida?: boolean }) {
  const avisos: Array<{ organization_id: string; title: string; body: string; ref_id: string }> = [];
  const idiomaLido: string[] = [];
  const db = {
    assertAgenda: vi.fn(async () => {}),
    assertServiceBoundary: vi.fn(async () => {
      if (opcoes.fronteiraVencida) throw new StaleServiceBoundaryError();
    }),
    loadFlowGraph: vi.fn(async () => ({ nodes: [], edges: [] })),
    loadLeadFacts: vi.fn(async () => ({ lead_stage: null, tags: [] })),
    loadEnrollmentEvents: vi.fn(async () => []),
    loadFlowPointerName: vi.fn(async () => "Fluxo de retorno"),
    insertEnrollmentEvent: vi.fn(async () => ({ inserted: true })),
    updateEnrollment: vi.fn(async () => {}),
    insertDeadInboxItem: vi.fn(async (item: (typeof avisos)[number]) => {
      avisos.push(item);
    }),
    ...(opcoes.idioma
      ? {
          idiomaDaOrg: vi.fn(async (orgId: string) => {
            idiomaLido.push(orgId);
            return opcoes.idioma!;
          }),
        }
      : {}),
  } as unknown as AdminClient;
  return { deps: { db, clock: () => NOW, enqueueJob: async () => {} }, avisos, idiomaLido };
}

describe("o motor abre o aviso no idioma da empresa", () => {
  it("o fluxo que parou de tentar (markDead)", async () => {
    const m = motor({ idioma: "tr" });
    await avancarEnrollmentAtivo(m.deps, inscricao("active", 100_000));

    expect(m.avisos).toHaveLength(1);
    expect(m.idiomaLido).toEqual(["org-1"]);
    expect(m.avisos[0]!.title).toBe(traduzir("Um fluxo de follow-up parou de tentar", "tr"));
    expect(m.avisos[0]!).toMatchObject(
      avisoDeFluxoParado({ nome: "Fluxo de retorno", id: "enr-1", motivo: "max_steps" }, "tr"),
    );
  });

  it("o retorno cancelado no meio da espera (atendimento encerrado)", async () => {
    const m = motor({ idioma: "es", fronteiraVencida: true });
    await avancarEnrollmentAtivo(m.deps, inscricao("dormente"));

    expect(m.avisos).toHaveLength(1);
    expect(m.avisos[0]!).toMatchObject(
      avisoDeRetornoCancelado({ nome: "Fluxo de retorno", id: "enr-1", causa: "fronteira" }, "es"),
    );
  });

  it("sem leitor de idioma (dublê antigo), o aviso continua em português", async () => {
    const m = motor({});
    await avancarEnrollmentAtivo(m.deps, inscricao("active", 100_000));

    expect(m.avisos[0]!.title).toBe("Um fluxo de follow-up parou de tentar");
  });
});

// ─── os adaptadores reais: leem o idioma e gravam a recuperação traduzida ───

function supabaseFalso(locale: string | null) {
  const inseridos: Array<Record<string, unknown>> = [];
  const lidas: string[] = [];
  const consulta = (tabela: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => {
        if (tabela === "organizations") return { data: { locale }, error: null };
        if (tabela === "calendar_appointments") return { data: { contact_id: "contato-1" }, error: null };
        if (tabela === "contacts") return { data: { is_anonymized: false }, error: null };
        return { data: null, error: null };
      },
      insert: async (linha: Record<string, unknown>) => {
        inseridos.push(linha);
        return { error: null };
      },
    };
    return q;
  };
  const cliente = {
    from: (tabela: string) => {
      lidas.push(tabela);
      return consulta(tabela);
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { cliente, inseridos, lidas };
}

function pgFalso(locale: string | null) {
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      if (/from organizations/.test(sql)) return { rows: [{ locale }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }),
  };
  return { pool, consultas };
}

const RECUPERACAO = {
  organization_id: "org-1",
  appointment_id: "apt-1",
  appointment_revision: 2,
  ref_enrollment_id: "enr-1",
};

describe("os adaptadores de produção leem o idioma da empresa", () => {
  it("Supabase: idiomaDaOrg lê organizations.locale", async () => {
    const alvo = supabaseFalso("tr");
    const admin = createSupabaseAdminClient(alvo.cliente as never);
    expect(await admin.idiomaDaOrg?.("org-1")).toBe("tr");
    expect(alvo.lidas).toContain("organizations");
  });

  it("pg: idiomaDaOrg lê organizations.locale", async () => {
    const alvo = pgFalso("es");
    const admin = createPgAdminClient(alvo.pool as never);
    expect(await admin.idiomaDaOrg?.("org-1")).toBe("es");
  });

  it("Supabase: o aviso da recuperação esgotada sai no idioma da empresa", async () => {
    const alvo = supabaseFalso("tr");
    await createSupabaseAdminClient(alvo.cliente as never).abrirAvisoRecuperacaoEsgotada?.(RECUPERACAO);

    expect(alvo.inseridos).toHaveLength(1);
    expect(alvo.inseridos[0]).toMatchObject({
      kind: "appointment_recovery_review",
      ...textoDaRecuperacaoEsgotada("tr"),
    });
  });

  it("pg: o aviso da recuperação esgotada sai no idioma da empresa, sem português fixo no SQL", async () => {
    const alvo = pgFalso("tr");
    await createPgAdminClient(alvo.pool as never).abrirAvisoRecuperacaoEsgotada?.(RECUPERACAO);

    const insert = alvo.consultas.find((c) => /insert into agent_inbox_items/.test(c.sql));
    expect(insert, "o insert do aviso não rodou").toBeDefined();
    expect(insert!.sql).not.toContain("Cliente faltou");
    const { title, body } = textoDaRecuperacaoEsgotada("tr");
    expect(insert!.params).toEqual(expect.arrayContaining([title, body]));
  });
});
