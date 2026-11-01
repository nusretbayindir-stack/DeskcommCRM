import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { alinhaPassoAoCardNovo } from "@/lib/agent-engine/agent/passo-do-card-novo";

/**
 * O CARD NOVO DE OUTRO FUNIL COMEÇA NO PASSO DELE (U25).
 *
 * O passo do funil do agente é UM por contato (`lead_state`), não por card.
 * Medido no demo de 31/10/2026: o contato já estava em `negotiating` por conta
 * de outro produto; o roteador abriu o card de İnşaat em "Yeni talep" e, em
 * cinco turnos e com a visita marcada, o card não andou — de `negotiating` não
 * há avanço para `qualified` ("Keşif randevusu"). O agente nem tentou.
 *
 * Quando o roteador abre um card A MAIS em outro funil de produto
 * (`card_adicional`), o passo do contato volta ao passo da etapa onde o card
 * nasceu (o `agent_stage_hint` dela; sem hint, `new`). Só o passo: o BANT e a
 * próxima ação ficam. A transferência de um funil de entrada NÃO mexe: lá é o
 * mesmo negócio que continua.
 */

const ORG = "org-1";
const CONTATO = "contato-1";
const CARD = "card-novo";

type Linha = Record<string, unknown> | null | Error;

function supabase(tabelas: { crm_leads?: Linha; crm_stages?: Linha }) {
  const filtros: Array<{ tabela: string; coluna: string; valor: unknown }> = [];
  const cliente = {
    from(tabela: "crm_leads" | "crm_stages") {
      const q = {
        select: () => q,
        eq: (coluna: string, valor: unknown) => {
          filtros.push({ tabela, coluna, valor });
          return q;
        },
        maybeSingle: async () => {
          const v = tabelas[tabela];
          if (v instanceof Error) return { data: null, error: { message: v.message } };
          return { data: v ?? null, error: null };
        },
      };
      return q;
    },
  };
  return { admin: cliente as never, filtros };
}

function banco(passoAtual: string | null) {
  const updates: unknown[][] = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      if (/^\s*select \* from lead_state/i.test(sql)) {
        return { rows: passoAtual === null ? [] : [{ stage: passoAtual, contact_id: CONTATO }] };
      }
      if (/^\s*update lead_state/i.test(sql)) {
        updates.push(params);
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  return { db: db as never, updates };
}

const INPUT = { organizationId: ORG, contactId: CONTATO, cardId: CARD };

describe("alinhaPassoAoCardNovo", () => {
  it("o caso do demo: contato em negotiating, card novo numa etapa `new` → o passo volta a new", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: { agent_stage_hint: "new" } });
    const { db, updates } = banco("negotiating");
    expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toEqual({
      status: "alinhado",
      de: "negotiating",
      para: "new",
    });
    expect(updates).toEqual([[ORG, CONTATO, "new"]]);
  });

  it("o card nasce numa etapa mapeada para outro passo: o contato vai para ESSE passo", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e2" }, crm_stages: { agent_stage_hint: "contacted" } });
    const { db, updates } = banco("won");
    expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toMatchObject({ status: "alinhado", para: "contacted" });
    expect(updates).toEqual([[ORG, CONTATO, "contacted"]]);
  });

  it("etapa sem hint: o passo é new", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: { agent_stage_hint: null } });
    const { db, updates } = banco("qualified");
    await alinhaPassoAoCardNovo(admin, db, INPUT);
    expect(updates).toEqual([[ORG, CONTATO, "new"]]);
  });

  it("hint fora do vocabulário (banco antigo): o passo é new, nunca o texto cru", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: { agent_stage_hint: "proposta" } });
    const { db, updates } = banco("qualified");
    await alinhaPassoAoCardNovo(admin, db, INPUT);
    expect(updates).toEqual([[ORG, CONTATO, "new"]]);
  });

  it("o passo já é o do card: não escreve", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: { agent_stage_hint: "new" } });
    const { db, updates } = banco("new");
    expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toEqual({ status: "ja_alinhado" });
    expect(updates).toEqual([]);
  });

  it("contato sem lead_state: não cria linha (o padrão já é new)", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e2" }, crm_stages: { agent_stage_hint: "contacted" } });
    const { db, updates } = banco(null);
    expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toEqual({ status: "sem_estado" });
    expect(updates).toEqual([]);
  });

  it("o card não foi lido (erro ou sumiu): não mexe no passo", async () => {
    for (const crm_leads of [new Error("timeout"), null]) {
      const { admin } = supabase({ crm_leads, crm_stages: { agent_stage_hint: "new" } });
      const { db, updates } = banco("negotiating");
      expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toEqual({ status: "sem_card" });
      expect(updates).toEqual([]);
    }
  });

  it("a etapa não foi lida: não mexe no passo (não chuta new)", async () => {
    const { admin } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: new Error("timeout") });
    const { db, updates } = banco("negotiating");
    expect(await alinhaPassoAoCardNovo(admin, db, INPUT)).toEqual({ status: "sem_card" });
    expect(updates).toEqual([]);
  });

  it("as duas leituras do CRM filtram pela organização", async () => {
    const { admin, filtros } = supabase({ crm_leads: { stage_id: "e1" }, crm_stages: { agent_stage_hint: "new" } });
    const { db } = banco("negotiating");
    await alinhaPassoAoCardNovo(admin, db, INPUT);
    expect(filtros).toEqual(
      expect.arrayContaining([
        { tabela: "crm_leads", coluna: "organization_id", valor: ORG },
        { tabela: "crm_leads", coluna: "id", valor: CARD },
        { tabela: "crm_stages", coluna: "organization_id", valor: ORG },
        { tabela: "crm_stages", coluna: "id", valor: "e1" },
      ]),
    );
  });
});

describe("a fiação no turno", () => {
  const turno = readFileSync(join(process.cwd(), "lib/agent-engine/agent/inbound-turn.ts"), "utf8");

  it("o turno alinha o passo quando o destino abriu um card a mais — e só aí", () => {
    // O bloco do destino da intenção chama a função com o card novo, guardado
    // pelo status `card_adicional` (a transferência não mexe no passo).
    const bloco = turno.slice(turno.indexOf("await aplicaDestinoDaIntencao("));
    const ate = bloco.slice(0, bloco.indexOf("// Knobs por-turno"));
    expect(ate).toMatch(/destino\.status === 'card_adicional'/);
    expect(ate).toMatch(/alinhaPassoAoCardNovo\(\s*deps\.crmCfg\.supabase,\s*pool,/);
  });
});
