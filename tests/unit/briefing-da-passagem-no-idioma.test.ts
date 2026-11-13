/**
 * U46 — o resumo da IA no cartão da passagem sai no idioma da EMPRESA.
 *
 * O cartão que a equipe recebe quando a IA passa a conversa tinha os títulos
 * dele traduzidos (`cartao-da-passagem.ts`), mas o corpo — o resumo montado por
 * `montarBriefingDaPassagem` — saía com os rótulos em português ("Por que a IA
 * passou", "Compromissos", "Próxima ação"…), num painel em holandês de uma
 * empresa turca. Texto para a equipe é no idioma da organização
 * (`organizations.locale`), não no do contato nem no de quem lê.
 *
 * Três provas: (1) a montagem em tr/nl/fr/es não tem rótulo português; (2) em
 * português o texto é o MESMO de antes, byte a byte (`__snapshots__/`, gravado
 * da `main` antes da mudança); (3) os dois motores que gravam a linha da
 * passagem passam o idioma da organização — com o fio cortado, o teste cai.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { montarBriefingDaPassagem, type EntradaDoBriefing } from "@/lib/escalacao/briefing-da-passagem";

const estado = vi.hoisted(() => ({
  localeDaOrg: "tr" as string | null,
  inseridos: [] as Array<{ tabela: string; linha: Record<string, unknown> }>,
}));

vi.mock("@/lib/ai/handoff/aviso-ao-lead", () => ({ avisarLeadDoCrm: vi.fn(async () => ({ avisado: true })) }));
vi.mock("@/lib/ai/elegibilidade/consulta-supabase", () => ({
  decidirElegibilidadeDaConversaViaSupabase: vi.fn(async () => ({
    permite: true,
    motivo: "autorizado",
    bloqueioPorAllowlist: false,
  })),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(), isServiceRoleConfigured: () => false }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const from = (tabela: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        update: () => chain,
        insert: (linha: Record<string, unknown>) => {
          estado.inseridos.push({ tabela, linha });
          return Promise.resolve({ data: null, error: null });
        },
        eq: () => chain,
        gt: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          if (tabela === "conversations") {
            return Promise.resolve({
              data: {
                id: CONVERSA,
                organization_id: ORG,
                contact_id: LEAD,
                last_handoff_at: null,
                last_handoff_reason: null,
                last_outbound_at: null,
              },
              error: null,
            });
          }
          if (tabela === "organizations") return Promise.resolve({ data: { locale: estado.localeDaOrg }, error: null });
          if (tabela === "lead_checkpoints") {
            return Promise.resolve({
              data: {
                commitments: ["enviar o orçamento"],
                objections: [],
                next_action: "ligar amanhã",
                rolling_summary: "Quer remarcar a entrega.",
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then: (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r),
      };
      return chain;
    };
    return {
      from,
      rpc: () => Promise.resolve({ error: null }),
      channel: () => ({ send: async () => undefined }),
      removeChannel: async () => undefined,
    };
  },
}));

import { performHumanHandoff } from "@/lib/agent-engine/agent/human-handoff";
import { triggerHandoff } from "@/lib/ai/handoff/orchestrator";

const ORG = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const CONVERSA = "33333333-3333-4333-8333-333333333333";

/** Uma passagem com TODOS os blocos, para nenhum rótulo escapar da medida. */
const COMPLETA: EntradaDoBriefing = {
  checkpoint: {
    commitments: ["enviar o orçamento"],
    objections: ["achou caro"],
    next_action: "ligar amanhã",
    rolling_summary: "Quer remarcar a entrega.",
    declaracao: {
      intencoes: [{ o_que: "remarcar para sexta", evidencia: "dá pra mudar pra sexta?" }],
      promessas: [{ o_que: "confirmar o horário", prazo: "amanhã" }],
    } as never,
  },
  declaradoPeloModelo: {
    tentativas: [{ o_que: "ofereci quinta", desfecho: "recusou" }, { o_que: "ofereci sábado" }],
    cliente_quer: "trocar a data da entrega",
  },
  pendentesDoCliente: ["dá pra mudar pra sexta?"],
  motivo: { codigo: "low_sentiment", texto: "cliente irritado", percebidoPeloJev: true },
  caso: { titulo: "Entrega 123", summary: "Pedido atrasado", blocker: "sem estoque", razaoHumana: "precisa de gerente" },
  camposColetados: { CEP: "01000-000" },
};

/** Os rótulos que a montagem escrevia em português, um por bloco. */
const ROTULOS_EM_PORTUGUES = [
  "Por que a IA passou",
  "Quem passou escreveu",
  "O que o cliente quer (segundo a IA — confira)",
  "O que a IA já tentou",
  "Últimas mensagens do cliente",
  "Contexto acumulado",
  "Compromissos",
  "Objeções",
  "Próxima ação",
  "Dados coletados",
  "Bloqueio",
  "A pessoa que escalou escreveu",
  "O que a pessoa quer",
  "Prometido a ela",
  "Caso:",
  "O cliente demonstrou irritação",
  "percebido pelo Jev",
  "Sem resumo acumulado",
];

/** Rótulos que se escrevem igual em espanhol — não são português que sobrou. */
const IGUAIS_EM_ESPANHOL = new Set(["Contexto acumulado", "Caso:"]);

const rotulosEmPortugues = (texto: string, idioma?: string) =>
  ROTULOS_EM_PORTUGUES.filter((r) => texto.includes(r) && !(idioma === "es" && IGUAIS_EM_ESPANHOL.has(r)));

describe("a montagem no idioma da empresa", () => {
  it.each(["tr", "nl", "fr", "es"] as const)("%s: nenhum rótulo em português, e as palavras do cliente intactas", (idioma) => {
    const { body } = montarBriefingDaPassagem({ ...COMPLETA, idioma });
    expect(rotulosEmPortugues(body, idioma)).toEqual([]);
    // O que é DADO segue como veio: a fala do cliente, o texto de quem passou.
    expect(body).toContain('"dá pra mudar pra sexta?"');
    expect(body).toContain('"cliente irritado"');
    expect(body).toContain("Quer remarcar a entrega.");
    expect(body).toContain("01000-000");
  });

  it.each(["tr", "nl", "fr", "es"] as const)("%s: sem contexto nenhum, o piso também no idioma", (idioma) => {
    const { body } = montarBriefingDaPassagem({ checkpoint: null, idioma });
    expect(rotulosEmPortugues(body)).toEqual([]);
    expect(body.length).toBeGreaterThan(20);
  });

  it("turco: os rótulos saem em turco", () => {
    const { body } = montarBriefingDaPassagem({ ...COMPLETA, idioma: "tr" });
    expect(body).toContain("AI konuşmayı neden devretti: ");
    expect(body).toContain("Sonraki adım: ligar amanhã");
  });

  it("francês: espaço inseparável antes dos dois-pontos, como o catálogo", () => {
    const { body } = montarBriefingDaPassagem({ ...COMPLETA, idioma: "fr" });
    expect(body).toContain("Prochaine action : ligar amanhã");
  });
});

describe("português: o texto não muda", () => {
  it("sem idioma e com pt-BR, o mesmo texto de antes, byte a byte", async () => {
    const entradas: Array<[string, EntradaDoBriefing]> = [
      ["completa", COMPLETA],
      ["vazia", { checkpoint: null }],
      ["legado", { checkpoint: COMPLETA.checkpoint }],
      ["campos", { checkpoint: null, camposColetados: { CEP: "01000-000" }, motivo: { codigo: "verificacao_manual" } }],
    ];
    for (const [nome, entrada] of entradas) {
      const semIdioma = montarBriefingDaPassagem(entrada);
      const emPortugues = montarBriefingDaPassagem({ ...entrada, idioma: "pt-BR" });
      const { entrada: _a, ...semA } = emPortugues;
      const { entrada: _b, ...semB } = semIdioma;
      expect(semA).toEqual(semB);
      await expect(`${semIdioma.body}\n--title--\n${semIdioma.title}`).toMatchFileSnapshot(
        `./__snapshots__/briefing-da-passagem-pt-${nome}.txt`,
      );
    }
  });
});

describe("os dois motores gravam no idioma da organização", () => {
  beforeEach(() => {
    estado.localeDaOrg = "tr";
    estado.inseridos.length = 0;
  });

  function poolComLocale(locale: string | null) {
    const chamadas: Array<{ sql: string; params: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      chamadas.push({ sql, params });
      if (/select\s+locale\s+from\s+organizations/i.test(sql)) return { rows: [{ locale }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    return { pool: { query } as never, chamadas };
  }
  const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) as never;
  const corpoGravado = (chamadas: Array<{ sql: string; params: unknown[] }>) => {
    const insert = chamadas.find((c) => c.sql.includes("insert into passagens_de_atendimento"));
    return insert?.params.find((p) => typeof p === "string" && p.includes("ligar amanhã")) as string | undefined;
  };

  it("motor de conversa: o briefing montado em português é gravado no idioma da empresa", async () => {
    const { pool, chamadas } = poolComLocale("nl");
    const briefing = montarBriefingDaPassagem(COMPLETA);
    await performHumanHandoff(
      pool,
      { tenantId: ORG, leadId: LEAD, conversationId: CONVERSA },
      {
        reason: "requested_human",
        conversationSummary: briefing.body,
        passagem: { origem: "pedido_explicito", motivoCodigo: "requested_human", briefing },
        log: log(),
      },
    );
    const corpo = corpoGravado(chamadas);
    expect(corpo).toBeDefined();
    expect(rotulosEmPortugues(corpo!)).toEqual([]);
    expect(corpo).toContain("Volgende actie: ligar amanhã");
  });

  it("motor de conversa: empresa em português grava o mesmo texto de antes", async () => {
    const { pool, chamadas } = poolComLocale("pt-BR");
    const briefing = montarBriefingDaPassagem(COMPLETA);
    await performHumanHandoff(
      pool,
      { tenantId: ORG, leadId: LEAD, conversationId: CONVERSA },
      {
        reason: "requested_human",
        conversationSummary: briefing.body,
        passagem: { origem: "pedido_explicito", motivoCodigo: "requested_human", briefing },
        log: log(),
      },
    );
    expect(corpoGravado(chamadas)).toBe(briefing.body);
  });

  it("motor do CRM: a passagem por sentimento sai no idioma da empresa", async () => {
    estado.localeDaOrg = "tr";
    await triggerHandoff({ conversationId: CONVERSA, organizationId: ORG, reason: "low_sentiment", origem: "sentimento" });
    const linha = estado.inseridos.find((i) => i.tabela === "passagens_de_atendimento");
    const corpo = String(linha?.linha.body);
    expect(rotulosEmPortugues(corpo)).toEqual([]);
    expect(corpo).toContain("AI konuşmayı neden devretti: ");
  });
});
