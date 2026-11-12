/**
 * A INGESTÃO GRAVA O IDIOMA DO CONTATO — e nunca para por causa dele.
 *
 * `lib/channels/pos-entrada.ts` está no caminho de TODA mensagem que chega.
 * Gravar `contacts.locale` é o enfeite; o opt-out, o lead e o despacho são o
 * trabalho. Os casos (S2a, Task 9):
 *
 *   - certeza e campo vazio → `update({ locale })` com `.is("locale", null)`,
 *     filtrado por organização e contato: o idioma posto à mão nunca é trocado;
 *   - "Merci" → nada é gravado;
 *   - a escrita falha → `logger.warn`, e os outros efeitos seguem — a regra de
 *     saída inclusive;
 *   - contato pessoal → nada é gravado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EntradaDaRecuperacao, EntradaDeMensagem } from "@/lib/channels/pos-entrada";

const garantirLeadDaConversa = vi.fn(async () => ({ criado: true, leadId: "lead-1" }) as never);
const lerPessoalDoContato = vi.fn(async () => ({ pessoal: false, erro: null }) as never);
const warn = vi.fn();

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/leads/encerramento", () => ({
  encerraDemanda: vi.fn(async () => ({ lead: {}, jaEstava: false })),
}));
vi.mock("@/lib/leads/nascimento-do-lead", () => ({
  garantirLeadDaConversa: (...a: unknown[]) => garantirLeadDaConversa(...(a as [])),
}));
vi.mock("@/lib/contacts/contato-pessoal", () => ({
  lerPessoalDoContato: (...a: unknown[]) => lerPessoalDoContato(...(a as [])),
}));
vi.mock("@/lib/escalacao/numero-interno-de-aviso", () => ({
  ehContatoDoNumeroInterno: vi.fn(async () => false),
}));
vi.mock("@/lib/channels/desativado", () => ({
  idsDosCanaisDesativados: vi.fn(async () => []),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: (...a: unknown[]) => warn(...a), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/leads/origem-por-horario", () => ({ casarOrigemPorHorario: vi.fn(async () => {}) }));
vi.mock("@/lib/dev/kick-local-pipeline", () => ({
  acelerarFollowupDoInbound: vi.fn(async () => {}),
  drenarEventosDoInbound: vi.fn(async () => {}),
  acelerarPipelineDeEventos: vi.fn(async () => {}),
  kickLocalPipeline: vi.fn(async () => {}),
}));

type Escrita = { tabela: string; payload: Record<string, unknown>; filtros: Array<[string, string, unknown]> };

/** Toda escrita em qualquer tabela, com os filtros que a acompanharam. */
let escritas: Escrita[] = [];
/** Erro que a escrita do IDIOMA devolve (as outras escritas não falham). */
let erroDoIdioma: { message: string } | null = null;
let rpcs: string[] = [];

/** Builder encadeável e permissivo: toda leitura devolve vazio, o efeito acontece no `await`. */
function cadeia(resultado: () => unknown, escrita?: Escrita): Record<string, unknown> {
  const alvo: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => Promise.resolve(resultado()).then(resolve);
        }
        if (prop === "maybeSingle" || prop === "single") {
          return () => Promise.resolve(resultado());
        }
        return (coluna: unknown, valor: unknown) => {
          if (escrita && typeof coluna === "string") escrita.filtros.push([String(prop), coluna, valor]);
          return alvo;
        };
      },
    },
  ) as Record<string, unknown>;
  return alvo;
}

const admin = {
  from(tabela: string) {
    return {
      update(payload: Record<string, unknown>) {
        const escrita: Escrita = { tabela, payload, filtros: [] };
        escritas.push(escrita);
        const ehIdioma = tabela === "contacts" && "locale" in payload;
        return cadeia(() => ({ data: null, error: ehIdioma ? erroDoIdioma : null }), escrita);
      },
      select() {
        return cadeia(() => ({ data: null, count: 0, error: null }));
      },
      insert() {
        return cadeia(() => ({ data: null, error: null }));
      },
      upsert() {
        return cadeia(() => ({ data: null, error: null }));
      },
    };
  },
  async rpc(nome: string, args: Record<string, unknown>) {
    rpcs.push(String(args?.p_event_type ?? nome));
    return { data: null, error: null };
  },
} as never;

const ENTRADA: EntradaDeMensagem = {
  organizationId: "org-1",
  contactId: "contato-1",
  conversationId: "conversa-1",
  messageId: "msg-1",
  channelSessionId: "sessao-1",
  texto: "Bonjour, je voudrais un rendez-vous",
  nomeDoContato: "Cliente",
  requestId: "req-1",
  origem: "canal_de_teste",
};

async function rodar(over: Partial<EntradaDeMensagem> = {}) {
  const { aplicarEfeitosPosEntrada } = await import("@/lib/channels/pos-entrada");
  await aplicarEfeitosPosEntrada(admin, { ...ENTRADA, ...over });
}

async function rodarRecuperacao(over: Partial<EntradaDaRecuperacao> = {}) {
  const { aplicarEfeitosDaRecuperacao } = await import("@/lib/channels/pos-entrada");
  await aplicarEfeitosDaRecuperacao(admin, {
    ...ENTRADA,
    enviadaEm: "2026-11-01T10:00:00.000Z",
    previa: ENTRADA.texto ?? "",
    ...over,
  });
}

const escritasDeIdioma = () => escritas.filter((e) => e.tabela === "contacts" && "locale" in e.payload);

beforeEach(() => {
  escritas = [];
  erroDoIdioma = null;
  rpcs = [];
  warn.mockClear();
  garantirLeadDaConversa.mockClear();
  lerPessoalDoContato.mockReset();
  lerPessoalDoContato.mockResolvedValue({ pessoal: false, erro: null } as never);
});

describe("pos-entrada grava o idioma do contato", () => {
  it("com certeza e campo vazio: grava só se ainda vazio, filtrado por organização e contato", async () => {
    await rodar();
    const gravadas = escritasDeIdioma();
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]!.payload).toEqual({ locale: "fr" });
    expect(gravadas[0]!.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "organization_id", "org-1"],
        ["eq", "id", "contato-1"],
        ["is", "locale", null],
      ]),
    );
  });

  it('"Merci" não grava idioma nenhum', async () => {
    await rodar({ texto: "Merci" });
    expect(escritasDeIdioma()).toHaveLength(0);
  });

  it("a escrita falha: logger.warn, os outros efeitos seguem e a regra de saída ainda roda", async () => {
    erroDoIdioma = { message: "falha simulada" };
    // Turco com certeza (ı) E pedido de saída inequívoco: os dois caminhos na mesma mensagem.
    await expect(rodar({ texto: "Artık mesaj istemiyorum" })).resolves.toBeUndefined();

    expect(escritasDeIdioma()).toHaveLength(1);
    expect(escritasDeIdioma()[0]!.payload).toEqual({ locale: "tr" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("idioma"), expect.anything());
    // a regra de saída gravou o bloqueio
    expect(escritas.some((e) => e.tabela === "contacts" && e.payload.is_blocked === true)).toBe(true);
    // e o resto do trabalho seguiu: o lead e o despacho do agente
    expect(garantirLeadDaConversa).toHaveBeenCalled();
    expect(rpcs).toContain("ai_agent.dispatch_requested");
  });

  it("contato pessoal: nada é gravado", async () => {
    lerPessoalDoContato.mockResolvedValue({ pessoal: true, erro: null } as never);
    await rodar();
    expect(escritasDeIdioma()).toHaveLength(0);
  });

  it("na recuperação também grava, com a mesma trava", async () => {
    await rodarRecuperacao();
    const gravadas = escritasDeIdioma();
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]!.filtros).toEqual(expect.arrayContaining([["is", "locale", null]]));
  });

  it("na recuperação, contato pessoal: nada é gravado", async () => {
    lerPessoalDoContato.mockResolvedValue({ pessoal: true, erro: null } as never);
    await rodarRecuperacao();
    expect(escritasDeIdioma()).toHaveLength(0);
  });
});
