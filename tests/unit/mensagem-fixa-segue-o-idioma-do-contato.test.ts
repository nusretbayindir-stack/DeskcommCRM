/**
 * A MENSAGEM FIXA PARA O CLIENTE SEGUE O IDIOMA DELE (S2a, Task 11).
 *
 * O texto que o SISTEMA escreve ao cliente — o aviso de que uma pessoa vai
 * assumir (motor e CRM), o lembrete da agenda, a entrega do compromisso, a
 * oferta da vaga que abriu e o `{{contact_locale}}` do prompt — sai no idioma
 * do CONTATO (`contacts.locale`) quando é um idioma que o produto serve; senão,
 * no da EMPRESA (`idiomaDoDestinatario`, D4 do S2a). Um `en`, que o produto
 * ainda não serve, não vira português: cai no idioma da empresa.
 *
 * Os três casos de cada lugar, numa empresa em holandês:
 *   - contato em francês → francês;
 *   - contato sem idioma → holandês;
 *   - contato `en` → holandês.
 *
 * O que NÃO muda: o texto que a EMPRESA escreveu (molde do lembrete, modelo
 * aprovado) não escolhe idioma — a data dentro dele segue o idioma em que ele
 * foi escrito, o da empresa. E o que vai à EQUIPE continua no idioma da
 * empresa (os testes de `human-handoff`, `events-bridge` e `reactivation`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as EntregaDaAgenda from "@/lib/agenda/meet-delivery";

const m = vi.hoisted(() => ({
  corpoDoMotor: null as string | null,
  enviar: vi.fn(),
  contato: null as string | null,
  org: "nl" as string | null,
  molde: null as string | null,
}));

// ── O que sai pela cadeia do motor (aviso de passagem, entrega da agenda) ──
vi.mock("@/lib/agent-engine/guardrails/before-send", () => ({
  runBeforeSend: vi.fn(async (args: { body: string }) => {
    m.corpoDoMotor = args.body;
    return { status: "sent", outcome: { kind: "sent" }, trace: [] };
  }),
}));
// ── O que sai pela porta do CRM (aviso de passagem, lembrete da agenda) ──
vi.mock("@/app/api/v1/messages/_handler", () => ({
  sendMessageHandler: (...args: unknown[]) => m.enviar(...args),
}));
vi.mock("@/lib/escalacao/disponibilidade", () => ({
  expectativaDeAtendimento: vi.fn(async () => ({ quem: null, frase: "" })),
}));
vi.mock("@/lib/escalacao/atendentes", () => ({
  carregarRosterDeAtendimento: vi.fn(async () => []),
  podeAssumirAgora: vi.fn(() => false),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
// ── O cron do lembrete (o arnês de `lembrete-carimbo-antes-do-envio.test.ts`) ──
vi.mock("@/lib/auth/cron-auth", () => ({ autorizaCron: () => true }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/automation/start-conversation", () => ({ ensureConversation: async () => "conversa-1" }));
vi.mock("@/lib/automation/janela-do-canal", () => ({ adiarAteAJanelaAbrir: async () => null }));
vi.mock("@/lib/automation/throttle", () => ({ espacarEnvio: async () => {} }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminDoLembrete() }));
// ── A entrega do compromisso: só o texto importa aqui ──
vi.mock("@/lib/atendimento/fronteira-server", () => ({
  withServiceJob: async (_pool: unknown, _job: unknown, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/agenda/meet-delivery", async (original) => ({
  ...(await original<typeof EntregaDaAgenda>()),
  assertMeetingDeliveryPg: async () => ({ humanCommand: false }),
  assertMeetingDeliveryReceiptPg: async () => {},
}));
vi.mock("@/lib/agent-engine/edge/crm/send-ledger", () => ({ reconcileAcceptedSend: async () => false }));

import { createMeetDeliveryHandler } from "@/lib/agent-engine/agent/meet-delivery";
import { avisarLeadDaEscalacao } from "@/lib/agent-engine/agent/aviso-de-escalacao";
import { GET as rodadaDoLembrete, montarLembrete } from "@/app/api/v1/cron/agenda-reminder/route";
import { oferecerVagaQueAbriu, type PortaDoEncaixe } from "@/lib/agenda/encaixe";
import { textoDaOferta, type ServicoDaEspera, type VagaAberta } from "@/lib/agenda/lista-de-espera";
import { textoDoCompromisso } from "@/lib/agenda/texto-do-compromisso";
import { avisarLeadDoCrm } from "@/lib/ai/handoff/aviso-ao-lead";
import { renderSystemPrompt } from "@/lib/ai/render-system-prompt";
import type { BotContext } from "@/lib/ai/types";
import { motivoDoAviso, textoDoAviso } from "@/lib/escalacao/aviso-ao-lead";
import type { Idioma } from "@/lib/i18n/idiomas";

const ORG = "11111111-1111-4111-8111-111111111111";
const LEAD = "22222222-2222-4222-8222-222222222222";
const CONVERSA = "33333333-3333-4333-8333-333333333333";
const FUSO = "Europe/Brussels";

/** Os três casos de cada lugar: [idioma do contato, idioma que deve sair]. */
const CASOS: ReadonlyArray<readonly [string | null, Idioma]> = [
  ["fr", "fr"],
  [null, "nl"],
  ["en", "nl"],
];

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

beforeEach(() => {
  m.corpoDoMotor = null;
  m.contato = null;
  m.org = "nl";
  m.molde = null;
  m.enviar.mockReset();
  m.enviar.mockResolvedValue({ id: "msg-1", status: "sent", error_code: null });
});

/** O corpo da última mensagem que saiu pela porta do CRM. */
function corpoDoCrm(): string {
  const chamada = m.enviar.mock.calls.at(-1);
  return (chamada?.[2] as { body: string }).body;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Aviso de passagem — motor (`pg`)
// ─────────────────────────────────────────────────────────────────────────

/** O banco do motor: só a leitura do idioma (contato + empresa) importa. */
function poolDoMotor() {
  return {
    query: vi.fn(async (sql: string) => {
      if (/from organizations/.test(sql)) return { rows: [{ contato: m.contato, org: m.org }] };
      return { rows: [] };
    }),
  };
}

describe("aviso de passagem, motor (`avisarLeadDaEscalacao`)", () => {
  for (const [contato, esperado] of CASOS) {
    it(`contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, async () => {
      m.contato = contato;
      const desfecho = await avisarLeadDaEscalacao(
        poolDoMotor() as never,
        { tenantId: ORG, leadId: LEAD, conversationId: CONVERSA, channelSessionId: "sessao", jobId: "job" },
        {
          motivo: "pediu_humano",
          channel: {} as never,
          optedOutThisTurn: false,
          now: new Date("2026-11-12T10:00:00Z"),
          log: log as never,
        },
      );
      expect(desfecho).toEqual({ avisado: true });
      expect(m.corpoDoMotor).toBe(textoDoAviso("pediu_humano", null, LEAD, esperado));
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Aviso de passagem — CRM (supabase-js)
// ─────────────────────────────────────────────────────────────────────────

/**
 * O supabase-js do CRM: `organizations` com o contato embutido (a leitura de
 * `idiomaDoContatoPeloSupabase`) e, para as guardas de `avisarLeadDoCrm`, uma
 * fala da IA sem aviso anterior — o caso em que o aviso sai.
 */
function adminDoCrm() {
  return {
    from: (tabela: string) => {
      if (tabela === "messages") {
        const falas = { data: [{ metadata: null, created_at: new Date().toISOString() }], error: null };
        const cadeia = { select: () => cadeia, eq: () => cadeia, order: () => cadeia, limit: async () => falas };
        return cadeia;
      }
      if (tabela !== "organizations") throw new Error(`tabela inesperada: ${tabela}`);
      const linha = { locale: m.org, contacts: m.contato === null ? [] : [{ locale: m.contato }] };
      const cadeia = { select: () => cadeia, eq: () => cadeia, maybeSingle: async () => ({ data: linha, error: null }) };
      return cadeia;
    },
  };
}

describe("aviso de passagem, CRM (`avisarLeadDoCrm`)", () => {
  const SEM_EQUIPE = { total: 0, disponiveis: 0 };
  for (const [contato, esperado] of CASOS) {
    it(`contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, async () => {
      m.contato = contato;
      const desfecho = await avisarLeadDoCrm(adminDoCrm() as never, {
        organizationId: ORG,
        conversationId: CONVERSA,
        contactId: LEAD,
        reason: "requested_human",
      });
      expect(desfecho).toEqual({ avisado: true });
      expect(corpoDoCrm()).toBe(textoDoAviso(motivoDoAviso("requested_human"), SEM_EQUIPE, LEAD, esperado));
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Lembrete da agenda (cron)
// ─────────────────────────────────────────────────────────────────────────

const INICIO_DO_COMPROMISSO = new Date(Date.now() + 30 * 60_000).toISOString();

function compromisso() {
  return {
    id: "c-1", organization_id: ORG, contact_id: LEAD, title: "Retorno",
    starts_at: INICIO_DO_COMPROMISSO, created_at: null, location_details: null,
    reminder_sent_offsets_minutes: null, organizations: { status: "active" },
    calendar_event_types: {
      name: "Consulta", reminder_enabled: true, reminder_minutes_before: 60, reminder_extra_offsets_minutes: null,
      reminder_template_name: null, reminder_body: m.molde, reminder_bodies: null, location_details: null,
    },
  };
}

/** O PostgREST falso de `lembrete-carimbo-antes-do-envio.test.ts`, com os dois idiomas. */
function adminDoLembrete() {
  return {
    rpc: async () => ({ data: 0, error: null }),
    from: (tabela: string) => {
      const unico: Record<string, unknown> = {
        contacts: {
          id: LEAD, name: "Ana", display_name: null, phone_number: "+32470000000", is_blocked: false, locale: m.contato,
        },
        channel_sessions: { id: "canal-1", provider: "waha", status: "WORKING", archived_at: null },
        organizations: { timezone: FUSO, locale: m.org },
      };
      let ehCarimbo = false;
      const c: Record<string, unknown> = {};
      for (const f of ["select", "eq", "not", "gt", "lte", "order", "limit", "is", "or"]) c[f] = () => c;
      c.update = () => {
        if (tabela === "calendar_appointments") ehCarimbo = true;
        return c;
      };
      c.maybeSingle = async () => ({ data: unico[tabela] ?? null, error: null });
      c.then = (r: (v: unknown) => unknown) =>
        Promise.resolve(
          ehCarimbo
            ? { data: null, error: null }
            : {
                data:
                  tabela === "calendar_appointments"
                    ? [compromisso()]
                    : tabela === "channel_sessions"
                      ? [unico.channel_sessions]
                      : null,
                error: null,
              },
        ).then(r);
      return c;
    },
  };
}

function lembreteEsperado(idioma: Idioma, molde: string | null = null): string {
  return montarLembrete({
    nomeDoContato: "Ana",
    titulo: "Retorno",
    quando: new Date(INICIO_DO_COMPROMISSO),
    timezone: FUSO,
    local: null,
    idioma,
    tipoNome: "Consulta",
    molde,
  });
}

async function rodarLembrete(): Promise<string> {
  const resposta = await rodadaDoLembrete(new Request("http://localhost/api/v1/cron/agenda-reminder") as never);
  const { data } = await resposta.json();
  expect(data.enviados).toBe(1);
  return corpoDoCrm();
}

describe("lembrete da agenda (`agenda-reminder`)", () => {
  for (const [contato, esperado] of CASOS) {
    it(`frase padrão: contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, async () => {
      m.contato = contato;
      expect(await rodarLembrete()).toBe(lembreteEsperado(esperado));
    });
  }

  it("a frase em francês não é a holandesa (o caso de cima mede alguma coisa)", () => {
    expect(lembreteEsperado("fr")).not.toBe(lembreteEsperado("nl"));
  });

  // O molde é texto da EMPRESA, escrito no idioma dela: a data dentro dele
  // segue esse idioma. Um "dinsdag" no meio da frase da empresa em holandês
  // não pode virar "mardi" porque o cliente fala francês.
  it("molde da empresa: a data segue o idioma da empresa, mesmo com contato em francês", async () => {
    m.contato = "fr";
    m.molde = "Hallo {{nome}}, tot {{quando}}.";
    const corpo = await rodarLembrete();
    expect(corpo).toBe(lembreteEsperado("nl", m.molde));
    expect(corpo).not.toBe(lembreteEsperado("fr", m.molde));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Entrega do compromisso (motor)
// ─────────────────────────────────────────────────────────────────────────

const INICIO_DA_ENTREGA = "2026-11-17T09:00:00.000Z";

function poolDaEntrega() {
  return {
    query: vi.fn(async (sql: string) => {
      if (/from calendar_appointments/.test(sql)) {
        return {
          rows: [
            {
              meeting_url: null,
              location_kind: "in_person",
              starts_at: INICIO_DA_ENTREGA,
              time_zone: FUSO,
              source: "whatsapp",
              consent: null,
              is_anonymized: false,
              contact_locale: m.contato,
              organization_locale: m.org,
              channel_session_id: "sessao",
              daily_message_limit: null,
              archived_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    }),
  };
}

describe("entrega do compromisso (`createMeetDeliveryHandler`)", () => {
  for (const [contato, esperado] of CASOS) {
    it(`contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, async () => {
      m.contato = contato;
      const entregar = createMeetDeliveryHandler({
        crmCfg: {} as never,
        log: log as never,
        channel: () => ({ send: vi.fn() }) as never,
      });
      await entregar(
        {
          id: "job-1",
          organization_id: ORG,
          contact_id: LEAD,
          kind: "transactional_delivery",
          locked_by: "worker-1",
          claim_acquired_at: "2026-11-12T10:00:00.000Z",
          payload: {
            appointment_id: "compromisso-1",
            service_boundary: {
              organization_id: ORG,
              contact_id: LEAD,
              conversation_id: CONVERSA,
              service_revision: 1,
              demanda_id: null,
              demanda_revision: null,
            },
          },
        } as never,
        poolDaEntrega() as never,
      );
      expect(m.corpoDoMotor).toBe(
        textoDoCompromisso({ startsAt: INICIO_DA_ENTREGA, timeZone: FUSO, url: null, idioma: esperado }),
      );
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Oferta da vaga que abriu (lista de espera)
// ─────────────────────────────────────────────────────────────────────────

/** Terça 17/11/2026, 10:00 em Bruxelas; a oferta vale até 09:00. */
const VAGA: VagaAberta = {
  appointmentId: "vaga-1",
  startsAt: new Date("2026-11-17T09:00:00.000Z"),
  endsAt: new Date("2026-11-17T10:00:00.000Z"),
  ownerUserId: null,
  timeZone: FUSO,
};
const SERVICO: ServicoDaEspera = { eventTypeId: "limpeza", nome: "Reiniging", duracaoMinutos: 60, avisoMinimoMinutos: 0 };
const AGORA = new Date("2026-11-17T06:30:00.000Z");
const EXPIRA = new Date("2026-11-17T08:00:00.000Z");

describe("o texto da oferta no idioma do cliente (`textoDaOferta`)", () => {
  it("sem idioma: a frase de sempre, em português", () => {
    expect(textoDaOferta(VAGA, SERVICO, EXPIRA)).toContain("Me responde SIM até 09:00");
  });

  const PALAVRA: Record<Exclude<Idioma, "pt-BR">, string> = { es: "SÍ", tr: "EVET", nl: "JA", fr: "OUI" };
  for (const [idioma, palavra] of Object.entries(PALAVRA) as Array<[Exclude<Idioma, "pt-BR">, string]>) {
    it(`${idioma}: pede ${palavra}, com o dia, a hora e o prazo no fuso da agenda`, () => {
      const texto = textoDaOferta(VAGA, SERVICO, EXPIRA, idioma);
      expect(texto).toContain(palavra);
      expect(texto).toContain("Reiniging");
      expect(texto).toContain("60");
      expect(texto).toContain("10:00");
      expect(texto).toContain("09:00");
      expect(texto).not.toContain("SIM");
      expect(texto).not.toContain(" às ");
    });
  }

  it("nl: o dia da semana sai em holandês", () => {
    expect(textoDaOferta(VAGA, SERVICO, EXPIRA, "nl")).toContain("dinsdag 17/11");
  });
  it("fr: o dia da semana sai em francês", () => {
    expect(textoDaOferta(VAGA, SERVICO, EXPIRA, "fr")).toContain("mardi 17/11");
  });
});

/** Uma porta mínima: uma pessoa na fila, a vaga livre e o aviso registrado. */
function portaDaOferta(): { porta: PortaDoEncaixe; avisos: string[] } {
  const avisos: string[] = [];
  const nunca = async () => {
    throw new Error("não usado neste teste");
  };
  const porta: PortaDoEncaixe = {
    config: async () => ({ ativa: true, prazo_maximo_minutos: 90, margem_antes_minutos: 10, prazo_minimo_minutos: 20 }),
    vaga: async () => VAGA,
    fila: async () => [
      {
        id: "espera-1",
        contactId: LEAD,
        eventTypeId: "limpeza",
        ownerUserId: null,
        janelas: [],
        antecedenciaMinimaHoras: 0,
        validoAte: null,
        urgencia: 0,
        createdAt: new Date("2026-11-10T10:00:00.000Z"),
      },
    ],
    servico: async () => SERVICO,
    podeAvisar: async () => true,
    ofertar: async () => ({ ok: true, compromissoId: "segurado-1" }),
    avisar: async (_org, _contato, texto) => {
      avisos.push(texto);
      return true;
    },
    idioma: async () => {
      if (m.contato === "fr") return "fr";
      return "nl";
    },
    oferta: nunca,
    ofertasVencidas: nunca,
    soltar: nunca,
    situar: nunca,
  };
  return { porta, avisos };
}

describe("a oferta sai no idioma que a porta devolve para o contato (`oferecerVagaQueAbriu`)", () => {
  for (const [contato, esperado] of CASOS) {
    it(`contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, async () => {
      m.contato = contato;
      const { porta, avisos } = portaDaOferta();
      const r = await oferecerVagaQueAbriu(porta, { organizationId: ORG, appointmentId: "vaga-1", agora: AGORA });
      expect(r.ofertada).toBe(true);
      expect(avisos).toHaveLength(1);
      const expiraEm = (r as { expiraEm: Date }).expiraEm;
      expect(avisos[0]).toBe(textoDaOferta(VAGA, SERVICO, expiraEm, esperado));
    });
  }

  it("porta sem idioma (as portas de teste antigas): a frase de sempre", async () => {
    const { porta, avisos } = portaDaOferta();
    delete (porta as { idioma?: unknown }).idioma;
    const r = await oferecerVagaQueAbriu(porta, { organizationId: ORG, appointmentId: "vaga-1", agora: AGORA });
    expect(avisos[0]).toBe(textoDaOferta(VAGA, SERVICO, (r as { expiraEm: Date }).expiraEm));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. `{{contact_locale}}` no prompt do agente (worker legado)
// ─────────────────────────────────────────────────────────────────────────

function contexto(localeDoContato: string | null, localeDaOrg: string | null): BotContext {
  return {
    organization_id: ORG,
    organization_locale: localeDaOrg,
    conversation_id: CONVERSA,
    contact_id: LEAD,
    channel_session_id: "sessao",
    message_id: "msg-1",
    inbound_body: "hallo",
    recent_messages: [],
    agent: {
      paused_at: null,
      id: "agente-1",
      model: "m",
      system_prompt: "",
      config: {},
      guardrails: {},
      active_kb_version_id: null,
    },
    contact: { id: LEAD, name: "Ana", display_name: null, locale: localeDoContato },
    retrieved_chunks: [],
  };
}

describe("`{{contact_locale}}` no prompt", () => {
  for (const [contato, esperado] of CASOS) {
    it(`contato ${contato ?? "sem idioma"}, empresa nl → ${esperado}`, () => {
      expect(renderSystemPrompt("Antwoord in {{contact_locale}}.", contexto(contato, "nl"))).toBe(
        `Antwoord in ${esperado}.`,
      );
    });
  }

  it("contato sem idioma: o da empresa, não pt-BR", () => {
    expect(renderSystemPrompt("{{contact_locale}}", contexto(null, "fr"))).toBe("fr");
  });
});
