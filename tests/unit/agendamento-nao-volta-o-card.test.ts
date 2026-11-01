/**
 * O agendamento nunca leva o card para TRÁS (U27 do demo de 01/11/2026).
 *
 * `moverLeadParaEtapaDeAgendamento` leva o card para a etapa de slug
 * `agendado` quando o horário é confirmado. Em funil onde há etapa aberta
 * DEPOIS da de agendamento ("Keşif randevusu" → "Teklif verildi"), um segundo
 * horário puxava de volta o card que já estava na proposta. A régua é a mesma
 * do espelho do agente (`card_a_frente`, PR #15): etapa de destino com
 * `position` menor que a do card não é destino.
 *
 * O fake devolve SÓ as colunas pedidas no `select`, como o PostgREST: sem
 * `position` no select, a guarda fica cega e o primeiro teste fica vermelho.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { moverLeadParaEtapaDeAgendamento } from "@/lib/leads/appointment-stage-move";

vi.mock("@/lib/leads/activity-emitter", async (orig) => ({
  ...(await orig<typeof import("@/lib/leads/activity-emitter")>()),
  emitLeadActivity: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/atendimento/origem", () => ({
  observeServiceOrigin: vi.fn(async () => null),
}));

const ORG = "org-1";

interface Etapa {
  id: string;
  name: string;
  slug: string;
  position: number | null;
  is_won: boolean;
  is_lost: boolean;
  is_archived: boolean;
}

const ETAPAS: Etapa[] = [
  { id: "s-novo", name: "Yeni talep", slug: "novo", position: 1000, is_won: false, is_lost: false, is_archived: false },
  { id: "s-agendado", name: "Keşif randevusu", slug: "agendado", position: 2750, is_won: false, is_lost: false, is_archived: false },
  { id: "s-proposta", name: "Teklif verildi", slug: "teklif-verildi", position: 3000, is_won: false, is_lost: false, is_archived: false },
];

function soAsColunas(linha: Record<string, unknown>, colunas: string): Record<string, unknown> {
  const pedidas = colunas.split(",").map((c) => c.trim());
  return Object.fromEntries(pedidas.filter((c) => c in linha).map((c) => [c, linha[c]]));
}

interface Opcoes {
  stageDoCard: string;
  etapas?: Etapa[];
  falhaNaOrigem?: boolean;
}

function fakeAdmin(o: Opcoes, updates: Array<Record<string, unknown>>) {
  const etapas = o.etapas ?? ETAPAS;
  const lead = {
    id: "lead-1",
    pipeline_id: "pipe-1",
    stage_id: o.stageDoCard,
    contact_id: "contato-1",
    status: "open",
    custom_fields: {},
    won_reason: null,
  };
  return {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      let colunas = "*";
      let atualizacao: Record<string, unknown> | null = null;
      const b = {
        select: (cols?: string) => {
          if (typeof cols === "string") colunas = cols;
          return b;
        },
        update: (v: Record<string, unknown>) => {
          atualizacao = v;
          return b;
        },
        eq: (k: string, v: unknown) => {
          filtros[k] = v;
          return b;
        },
        maybeSingle: () => {
          if (tabela === "crm_leads") return Promise.resolve({ data: soAsColunas(lead, colunas), error: null });
          if (tabela === "crm_pipelines") return Promise.resolve({ data: { settings: null }, error: null });
          if (tabela === "crm_stages") {
            if ("slug" in filtros) {
              const e = etapas.find((x) => x.slug === filtros.slug && !x.is_archived);
              return Promise.resolve({ data: e ? soAsColunas({ ...e }, colunas) : null, error: null });
            }
            if (o.falhaNaOrigem) return Promise.resolve({ data: null, error: { message: "boom" } });
            const e = etapas.find((x) => x.id === filtros.id);
            return Promise.resolve({ data: e ? soAsColunas({ ...e }, colunas) : null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          if (atualizacao !== null) {
            updates.push({ set: atualizacao, onde: { ...filtros } });
            return Promise.resolve({ data: [{ id: lead.id }], error: null }).then(onF, onR);
          }
          return Promise.resolve({ data: [], error: null }).then(onF, onR);
        },
      };
      return b;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function mover(o: Opcoes) {
  const updates: Array<Record<string, unknown>> = [];
  const r = await moverLeadParaEtapaDeAgendamento(fakeAdmin(o, updates), {
    organizationId: ORG,
    leadId: "lead-1",
    transicao: "confirmed",
  });
  return { r, updates };
}

describe("o agendamento não leva o card para trás", () => {
  beforeEach(() => vi.mocked(emitLeadActivity).mockClear());

  it("card já na proposta (depois da etapa de agendamento): fica onde está", async () => {
    const { r, updates } = await mover({ stageDoCard: "s-proposta" });
    expect(r).toEqual({ moveu: false, motivo: "card_a_frente" });
    expect(updates).toHaveLength(0);
    expect(vi.mocked(emitLeadActivity)).not.toHaveBeenCalled();
  });

  it("card antes da etapa de agendamento: anda para ela", async () => {
    const { r, updates } = await mover({ stageDoCard: "s-novo" });
    expect(r).toEqual({ moveu: true, motivo: "movido" });
    expect(updates).toEqual([{ set: { stage_id: "s-agendado" }, onde: expect.objectContaining({ id: "lead-1", stage_id: "s-novo" }) }]);
  });

  it("card já na etapa de agendamento: ja_esta_la, como antes", async () => {
    const { r, updates } = await mover({ stageDoCard: "s-agendado" });
    expect(r).toEqual({ moveu: false, motivo: "ja_esta_la" });
    expect(updates).toHaveLength(0);
  });

  it("position como texto (numeric fora do PostgREST): a guarda vale igual", async () => {
    const etapas = ETAPAS.map((e) => ({ ...e, position: String(e.position) as unknown as number }));
    const { r, updates } = await mover({ stageDoCard: "s-proposta", etapas });
    expect(r).toEqual({ moveu: false, motivo: "card_a_frente" });
    expect(updates).toHaveLength(0);
  });

  it("etapa sem position: a regra de antes (move)", async () => {
    const etapas = ETAPAS.map((e) => (e.id === "s-agendado" ? { ...e, position: null } : e));
    const { r } = await mover({ stageDoCard: "s-proposta", etapas });
    expect(r).toEqual({ moveu: true, motivo: "movido" });
  });

  it("leitura da etapa do card falhou: a regra de antes (move) — uma leitura que falha não trava o agendamento", async () => {
    const { r } = await mover({ stageDoCard: "s-proposta", falhaNaOrigem: true });
    expect(r).toEqual({ moveu: true, motivo: "movido" });
  });
});
