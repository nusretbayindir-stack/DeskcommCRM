// @vitest-environment node
/**
 * U53: O RELATÓRIO DE UM PEDIDO ABERTO PELA TELA SÓ VAI AO ENDEREÇO FIXADO NELE.
 *
 * `processLgpdExport` REAL com o dublê de banco do teste de pedido sem e-mail.
 * Pedido com `origem_manual` não cai no e-mail atual do contato (decisão do dono
 * do produto, 2026-11-15): sem endereço fixado, vai para revisão pendente. O
 * pedido da Nuvemshop (sem `origem_manual`) segue usando o e-mail do contato. Ao
 * concluir, os avisos do pedido na Central são fechados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ModuloDeEnvioPorEmail from "@/lib/lgpd/email-delivery";

type Patch = Record<string, unknown>;
const estado = vi.hoisted(() => ({
  updates: [] as Patch[],
  envios: [] as Array<{ to: string }>,
  pedido: {} as Record<string, unknown>,
  emailDoContato: null as string | null,
}));

vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: "" }) }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/lgpd/repository", () => ({ findLgpdRequest: async () => estado.pedido }));
vi.mock("@/lib/lgpd/export-collector", () => ({
  collectExportData: async () => ({ contact: { email: estado.emailDoContato } }),
}));
vi.mock("@/lib/lgpd/pdf-renderer", () => ({ renderLgpdPdf: async () => Buffer.from("pdf") }));
vi.mock("@/lib/lgpd/pades-signer", () => ({
  isPadesConfigured: () => false,
  signPdfPades: async (b: Buffer) => ({ signed: b, sha256: "abc", signed_pades: false, warning: "pades_key_missing" }),
}));
vi.mock("@/lib/lgpd/copia-do-titular", () => ({ partesDoArquivoDoTitular: function* () {} }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({}) }));
vi.mock("@/lib/legal/perfil-do-pais", () => ({ perfilDaOrganizacao: async () => ({ codigo: "BR" }) }));
vi.mock("@/lib/lgpd/email-delivery", async (original) => {
  const real = await original<typeof ModuloDeEnvioPorEmail>();
  return {
    ...real,
    sendExportEmail: async (args: { to: string }) => {
      estado.envios.push({ to: args.to });
      return { messageId: "m1" };
    },
  };
});
vi.mock("@/lib/lgpd/avisos-do-pedido-manual", () => ({
  resolverAvisosDoPedido: vi.fn(async () => undefined),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (patch: Patch) => {
        estado.updates.push(patch);
        const q = {
          eq: () => q,
          neq: () => q,
          or: () => q,
          select: () => q,
          then: (ok: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ id: "reivindicado" }], error: null }).then(ok),
        };
        return q;
      },
    }),
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/x" }, error: null }),
      }),
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));

import { resolverAvisosDoPedido } from "@/lib/lgpd/avisos-do-pedido-manual";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { processLgpdExport } from "@/workers/lgpd-export-worker";

const ORG = "org-1";
const PEDIDO = "p1";
const evento = {
  id: 1,
  organization_id: ORG,
  entity_id: PEDIDO,
  payload: { request_id: PEDIDO, manually_approved: true, approved_by: "u1" },
} as unknown as EventRow;

const ORIGEM_MANUAL = { canal: "outro", observacao: null, criado_por: "u2", criado_em: "2026-11-10T10:00:00.000Z" };

function pedidoCom(payload: Record<string, unknown>) {
  estado.pedido = {
    id: PEDIDO,
    organization_id: ORG,
    status: "received",
    request_type: "data_request",
    attempts: 0,
    contact_id: null,
    external_customer_id: null,
    request_payload: payload,
  };
}

beforeEach(() => {
  estado.updates = [];
  estado.envios = [];
  estado.emailDoContato = null;
  vi.mocked(resolverAvisosDoPedido).mockClear();
});

describe("lgpd-export-worker: endereço de entrega do pedido aberto pela tela", () => {
  it("pedido pela tela sem e-mail fixado vai para revisão pendente mesmo com e-mail no contato", async () => {
    pedidoCom({ origem_manual: ORIGEM_MANUAL, delivery: null });
    estado.emailDoContato = "incluido-depois@loja.test";

    await processLgpdExport(evento);

    expect(estado.updates).toContainEqual(
      expect.objectContaining({ status: "pending_review", error_message: "no_delivery_email" }),
    );
    expect(estado.envios).toHaveLength(0);
    expect(resolverAvisosDoPedido).not.toHaveBeenCalled();
  });

  it("pedido pela tela entrega no endereço fixado, não no atual", async () => {
    pedidoCom({ origem_manual: ORIGEM_MANUAL, delivery: { address: "antigo@loja.test", origem: "cadastro_no_pedido" } });
    estado.emailDoContato = "novo@loja.test";

    await processLgpdExport(evento);

    expect(estado.envios).toEqual([{ to: "antigo@loja.test" }]);
  });

  it("Nuvemshop sem delivery segue usando o e-mail do contato", async () => {
    pedidoCom({});
    estado.emailDoContato = "cliente@loja.test";

    await processLgpdExport(evento);

    expect(estado.envios).toEqual([{ to: "cliente@loja.test" }]);
  });

  it("concluir a exportação fecha os avisos da Central", async () => {
    pedidoCom({ origem_manual: ORIGEM_MANUAL, delivery: { address: "antigo@loja.test", origem: "cadastro_no_pedido" } });

    await processLgpdExport(evento);

    expect(estado.updates).toContainEqual(expect.objectContaining({ status: "completed" }));
    expect(resolverAvisosDoPedido).toHaveBeenCalledWith(expect.anything(), ORG, PEDIDO);
  });
});
