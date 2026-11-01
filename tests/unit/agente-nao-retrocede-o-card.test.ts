/**
 * O ASSISTENTE NÃO LEVA UM CARD PARA TRÁS.
 *
 * O passo do agente é por contato (`lead_state`) e só anda para a frente; o card
 * é por negócio. Quando os dois descasam — o card novo de outro produto que
 * recomeça o passo do contato (U25), ou um humano que levou o card adiante —, o
 * espelho levava o card para a etapa do passo, mesmo que ela viesse ANTES: o
 * card de Oto galeri em "Pazarlıkta" voltava para "İletişimde" porque o contato
 * recomeçou o passo no card de İnşaat.
 *
 * Etapa anterior (pela `position` do funil) não é destino: o card fica, e o
 * espelho registra como estado legítimo (warn-only), não como incidente. Ganho
 * fecha de qualquer ponto; perda segue a regra dela (`perda_sem_motivo`).
 */
import { describe, expect, it, vi } from "vitest";

import type * as Emissor from "@/lib/leads/activity-emitter";

vi.mock("@/lib/leads/activity-emitter", async (orig) => ({
  ...(await orig<typeof Emissor>()),
  emitLeadActivity: vi.fn(async () => ({ ok: true })),
}));

import {
  avisoDoEspelhoRecusado,
  MIRROR_WARN_ONLY,
  mirrorLeadStageToCrm,
} from "@/lib/agent-engine/edge/crm/move-lead-stage";
import {
  resolveDestinoDoAgente,
  sincronizaEstagioDoAgente,
  type EstagioCandidato,
} from "@/lib/leads/agent-stage-sync";

const FUNIL: EstagioCandidato[] = [
  { id: "e1", name: "Yeni talep", agent_stage_hint: "new", is_archived: false, position: 0 },
  { id: "e2", name: "İletişimde", agent_stage_hint: "contacted", is_archived: false, position: 1 },
  { id: "e3", name: "Pazarlıkta", agent_stage_hint: "negotiating", is_archived: false, position: 3 },
  { id: "e4", name: "Kazanıldı", agent_stage_hint: "won", is_archived: false, is_won: true, position: 4 },
];

describe("resolveDestinoDoAgente", () => {
  it("o passo aponta para uma etapa ANTES da do card: não move", () => {
    expect(resolveDestinoDoAgente(FUNIL, "contacted", "e3")).toEqual({
      move: false,
      motivo: "card_a_frente",
      passo: "contacted",
    });
  });

  it("para a frente continua movendo", () => {
    expect(resolveDestinoDoAgente(FUNIL, "negotiating", "e2")).toEqual({
      move: true,
      stageId: "e3",
      stageName: "Pazarlıkta",
    });
  });

  it("a etapa de ganho fecha de qualquer ponto, mesmo posicionada antes", () => {
    const funil: EstagioCandidato[] = [
      { id: "g", name: "Kazanıldı", agent_stage_hint: "won", is_archived: false, is_won: true, position: 0 },
      { id: "e3", name: "Pazarlıkta", agent_stage_hint: "negotiating", is_archived: false, position: 3 },
    ];
    expect(resolveDestinoDoAgente(funil, "won", "e3")).toMatchObject({ move: true, stageId: "g" });
  });

  it("sem posição (linha sem a coluna): a regra de antes, move", () => {
    const semPosicao = FUNIL.map(({ position: _p, ...e }) => e);
    expect(resolveDestinoDoAgente(semPosicao, "contacted", "e3")).toMatchObject({ move: true, stageId: "e2" });
  });
});

/**
 * O fake devolve SÓ as colunas pedidas no `select` de `crm_stages`, como o
 * PostgREST: se a produção não pedir `position`, a guarda fica cega aqui como
 * ficaria no banco.
 */
function admin(etapaDoCard: string) {
  const updates: string[] = [];
  const cliente = {
    rpc: async () => ({ data: null, error: null }),
    from(tabela: string) {
      let colunas = "*";
      let ehUpdate = false;
      const b = {
        select(c?: string) {
          if (!ehUpdate && c) colunas = c;
          return b;
        },
        update() {
          ehUpdate = true;
          updates.push(tabela);
          return b;
        },
        eq: () => b,
        in: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: async () => ({ data: { name: "Funil" }, error: null }),
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          let r: unknown;
          if (ehUpdate) r = { data: [{ id: "n1" }], error: null };
          else if (tabela === "crm_leads")
            r = {
              data: [
                {
                  id: "n1",
                  organization_id: "org-1",
                  pipeline_id: "p1",
                  stage_id: etapaDoCard,
                  status: "open",
                  created_at: "2026-01-01T00:00:00Z",
                  last_activity_at: null,
                },
              ],
              error: null,
            };
          else if (tabela === "crm_stages") {
            const pedidas = colunas.split(",").map((s) => s.trim());
            r = {
              data: FUNIL.map((e) =>
                Object.fromEntries(Object.entries(e).filter(([k]) => pedidas.includes(k))),
              ),
              error: null,
            };
          } else r = { data: null, error: null };
          return Promise.resolve(r).then(onF, onR);
        },
      };
      return b;
    },
  };
  return { cliente: cliente as never, updates };
}

describe("sincronizaEstagioDoAgente", () => {
  it("lê a posição das etapas e não escreve nada quando o card já está à frente", async () => {
    const { cliente, updates } = admin("e3");
    const r = await sincronizaEstagioDoAgente(cliente, {
      organizationId: "org-1",
      contactId: "contato-1",
      passo: "contacted",
    });
    expect(r).toMatchObject({ moveu: false, motivo: "card_a_frente", leadId: "n1" });
    expect(updates).toEqual([]);
  });
});

describe("o espelho", () => {
  it("card à frente é estado legítimo: warn-only, sem aviso na Central", async () => {
    const sync = vi.fn(async () => ({ moveu: false as const, motivo: "card_a_frente" as const, leadId: "n1" }));
    const r = await mirrorLeadStageToCrm(
      {} as never,
      { supabase: {} as never } as never,
      { tenantId: "org-1", leadId: "contato-1", toStage: "contacted" as never },
      { sync: sync as never },
    );
    expect(r).toMatchObject({ ok: false, reason: "card_a_frente", negocioId: "n1" });
    if (r.ok) return;
    expect(MIRROR_WARN_ONLY.has(r.reason)).toBe(true);
    expect(avisoDoEspelhoRecusado({ motivo: r.reason, detalhe: r.detail, etapaDeDestino: "contacted" })).toBeNull();
  });
});
