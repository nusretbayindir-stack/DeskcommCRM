// @vitest-environment node
/**
 * U53: PEDIDO ENCERRADO COM MOTIVO NÃO É EXPORTADO DEPOIS.
 *
 * Um pedido aprovado cujo envio falhou volta a `received` com o evento na fila
 * de retry do dreno. A tela deixa o admin encerrá-lo com motivo (`failed`,
 * `encerrado_pelo_responsavel`). O retry que chega depois não pode montar o
 * relatório, mandar o e-mail nem sobrescrever o encerramento — como o worker de
 * exclusão, que já pula `failed`.
 *
 * `processLgpdExport` REAL; o banco falso aplica os filtros que o PostgREST
 * receberia (`eq`, `neq`, `or(...is.null / lt...)`), e é o único lugar onde a
 * linha muda. O segundo caso prova que a trava é atômica: a leitura ainda viu
 * `received`, mas a linha já foi encerrada quando o worker tenta reivindicá-la.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";

type Linha = Record<string, unknown>;

const d = vi.hoisted(() => ({
  adminAtual: { valor: null as unknown },
  leituras: [] as Array<Record<string, unknown> | null>,
  linhaDoBanco: { valor: null as (() => Record<string, unknown> | null) | null },
  collectExportData: vi.fn(),
  renderLgpdPdf: vi.fn(),
  sendExportEmail: vi.fn(),
  audit: vi.fn(),
  resolver: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => d.adminAtual.valor }));
// A primeira leitura pode ser uma foto antiga da linha; as seguintes leem o banco.
vi.mock("@/lib/lgpd/repository", () => ({
  findLgpdRequest: async () =>
    d.leituras.length > 0 ? d.leituras.shift() : (d.linhaDoBanco.valor?.() ?? null),
}));
vi.mock("@/lib/lgpd/export-collector", () => ({ collectExportData: d.collectExportData }));
vi.mock("@/lib/lgpd/pdf-renderer", () => ({ renderLgpdPdf: d.renderLgpdPdf }));
vi.mock("@/lib/lgpd/pades-signer", () => ({
  isPadesConfigured: () => false,
  signPdfPades: async (b: Buffer) => ({ signed: b, sha256: "abc", signed_pades: false, warning: null }),
}));
vi.mock("@/lib/lgpd/email-delivery", () => ({
  sendExportEmail: d.sendExportEmail,
  hashEmail: (email: string) => `hash:${email}`,
  EmailNotConfigured: class EmailNotConfigured extends Error {},
  EmailSendFailed: class EmailSendFailed extends Error {},
}));
vi.mock("@/lib/audit", () => ({ audit: d.audit }));
vi.mock("@/lib/legal/perfil-do-pais", () => ({
  perfilDaOrganizacao: async () => ({ codigo: "BE", calendario: { feriados: [] } }),
}));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Loja Teste" }) }));
vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: null }) }));
vi.mock("@/lib/lgpd/copia-do-titular", () => ({
  partesDoArquivoDoTitular: () =>
    (async function* () {
      yield "{}";
    })(),
}));
vi.mock("@/lib/lgpd/avisos-do-pedido-manual", () => ({ resolverAvisosDoPedido: d.resolver }));

import { processLgpdExport } from "@/workers/lgpd-export-worker";

const ORG = "11111111-1111-4111-8111-111111111111";
const PEDIDO = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

function criarBancoFalso(inicial: Linha) {
  const linha: Linha = { ...inicial };
  const efeitos = { updates: [] as Linha[], uploads: [] as string[] };

  const avaliarTermo = (p: Linha, termo: string): boolean => {
    const [col = "", op = "", ...resto] = termo.split(".");
    const valor = resto.join(".");
    if (op === "is" && valor === "null") return p[col] === null || p[col] === undefined;
    if (op === "lt") return p[col] != null && String(p[col]) < valor;
    throw new Error(`filtro não suportado no banco falso: ${termo}`);
  };

  class Cadeia {
    ops: Array<(p: Linha) => boolean> = [];
    patch: Linha | null = null;
    eq(col: string, val: unknown) {
      this.ops.push((p) => p[col] === val);
      return this;
    }
    neq(col: string, val: unknown) {
      this.ops.push((p) => p[col] !== val);
      return this;
    }
    or(expr: string) {
      const termos = expr.split(",");
      this.ops.push((p) => termos.some((t) => avaliarTermo(p, t.trim())));
      return this;
    }
    select() {
      return this;
    }
    private executar() {
      const casa = this.ops.every((f) => f(linha));
      if (casa && this.patch) {
        efeitos.updates.push(this.patch);
        Object.assign(linha, this.patch);
      }
      return { data: casa ? [{ ...linha }] : [], error: null };
    }
    then(onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
      return Promise.resolve(this.executar()).then(onF, onR);
    }
  }

  const admin = {
    from(tabela: string) {
      if (tabela !== "lgpd_requests") throw new Error(`tabela inesperada: ${tabela}`);
      return {
        update: (patch: Linha) => {
          const c = new Cadeia();
          c.patch = patch;
          return c;
        },
      };
    },
    rpc: async () => ({ data: null, error: null }),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          efeitos.uploads.push(path);
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/${path}` },
          error: null,
        }),
      }),
    },
  };

  return { admin, efeitos, linha: () => ({ ...linha }) };
}

const ENCERRAMENTO = {
  motivo_codigo: "identidade_nao_confirmada",
  nota: "não apresentou documento",
  por: ADMIN,
  em: "2026-11-15T10:00:00.000Z",
};

/** Pedido aprovado cujo envio falhou e que o admin encerrou com motivo. */
function pedidoEncerrado(): Linha {
  return {
    id: PEDIDO,
    organization_id: ORG,
    request_type: "data_request",
    status: "failed",
    error_message: "encerrado_pelo_responsavel",
    attempts: 1,
    contact_id: null,
    external_customer_id: null,
    export_claimed_at: null,
    request_payload: {
      origem_manual: { canal: "outro", observacao: null, criado_por: ADMIN, criado_em: "2026-11-10T10:00:00.000Z" },
      delivery: { address: "titular@loja.test", origem: "cadastro_no_pedido" },
    },
    result: { encerramento: ENCERRAMENTO },
  };
}

/** Evento da aprovação que ficou na fila de retry depois da falha de envio. */
const eventoDeRetry = {
  id: "e-retry",
  organization_id: ORG,
  event_type: "lgpd.data_request_received",
  entity_kind: "lgpd_request",
  entity_id: PEDIDO,
  payload: { request_id: PEDIDO, manually_approved: true, approved_by: ADMIN },
  metadata: { manually_approved: true },
  consumed_by: [],
  attempts: 1,
} as unknown as EventRow;

beforeEach(() => {
  vi.clearAllMocks();
  d.leituras.length = 0;
  d.collectExportData.mockImplementation(async () => ({ contact: { email: null }, fuso: "Europe/Brussels" }));
  d.renderLgpdPdf.mockImplementation(async () => Buffer.from("%PDF-falso"));
  d.sendExportEmail.mockImplementation(async () => ({ messageId: "m1" }));
  d.audit.mockImplementation(async () => undefined);
  d.resolver.mockImplementation(async () => undefined);
});

describe("lgpd-export-worker: pedido encerrado pelo responsável (U53)", () => {
  it("retry de um pedido encerrado com motivo é pulado, sem e-mail e sem mexer na linha", async () => {
    const banco = criarBancoFalso(pedidoEncerrado());
    d.adminAtual.valor = banco.admin;
    d.linhaDoBanco.valor = banco.linha;

    const resultado = await processLgpdExport(eventoDeRetry);

    expect(resultado).toMatchObject({ status: "skipped", detail: "already_failed" });
    expect(d.collectExportData).not.toHaveBeenCalled();
    expect(d.sendExportEmail).not.toHaveBeenCalled();
    expect(banco.efeitos.updates).toEqual([]);
    expect(banco.efeitos.uploads).toEqual([]);
    expect(banco.linha()).toEqual(pedidoEncerrado());
  });

  it("a trava é atômica: leitura antiga viu received, mas a linha já estava encerrada", async () => {
    const banco = criarBancoFalso(pedidoEncerrado());
    d.adminAtual.valor = banco.admin;
    d.linhaDoBanco.valor = banco.linha;
    // Foto tirada antes do encerramento: aprovado, envio falhou, de volta a received.
    d.leituras.push({
      ...pedidoEncerrado(),
      status: "received",
      error_message: "email_send_failed",
      result: null,
    });

    const resultado = await processLgpdExport(eventoDeRetry);

    expect(resultado).toMatchObject({ status: "skipped", detail: "already_failed" });
    expect(d.collectExportData).not.toHaveBeenCalled();
    expect(d.sendExportEmail).not.toHaveBeenCalled();
    expect(banco.efeitos.updates).toEqual([]);
    expect(banco.linha()).toEqual(pedidoEncerrado());
  });
});
