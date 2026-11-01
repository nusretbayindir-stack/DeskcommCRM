import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { emitAgentActivityForContact } from "@/lib/leads/agent-activity";

/**
 * U23 (demo de 31/10/2026): o contato tinha cards abertos em Oto galeri, Emlak e
 * İnşaat. O assistente do Emlak respondeu e a nota do turno (`ai_turn`) foi para o
 * card do Oto galeri — o mais recentemente ativo. Como `ai_turn` renova o
 * `last_activity_at` do card (trigger da 0079), o card errado continuava "o mais
 * recente" e recebia também as notas seguintes.
 *
 * O fake responde às três consultas de `emitAgentActivityForContact` e guarda o
 * que foi gravado em `crm_lead_activities`: a asserção é sobre o CARD que recebeu
 * a linha, que é o que o dono vê.
 */
const ORG = "org-1";
const CONTATO = "contato-1";
const EMLAK = "pipe-emlak";
const GALERI = "pipe-galeri";
const DEMO = "pipe-demo";

const card = (id: string, pipeline_id: string, last_activity_at: string) => ({
  id,
  organization_id: ORG,
  pipeline_id,
  status: "open",
  last_activity_at,
  created_at: "2026-10-28T00:00:00Z",
});

function fakePool(leads: ReturnType<typeof card>[]) {
  const gravadas: unknown[][] = [];
  const pool = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("from crm_leads")) return { rows: leads };
      if (sql.includes("from crm_pipelines")) return { rows: [{ id: DEMO }] };
      if (sql.includes("insert into crm_lead_activities")) {
        gravadas.push(params);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { pool: pool as any, gravadas };
}

const nota = {
  organizationId: ORG,
  contactId: CONTATO,
  type: "ai_turn" as const,
  sourceModule: "agent",
  reason: "Próxima ação: aguardar o orçamento",
  agentId: "agente-emlak",
};

describe("emitAgentActivityForContact — a nota vai para o card do funil do assistente", () => {
  it("com card aberto no funil dele, a nota vai para ESSE card, mesmo que outro seja mais recente", async () => {
    const { pool, gravadas } = fakePool([
      card("galeri", GALERI, "2026-10-31T18:44:00Z"),
      card("emlak", EMLAK, "2026-10-30T12:57:00Z"),
    ]);

    const r = await emitAgentActivityForContact({ ...nota, pool, pipelineIds: [EMLAK] });

    expect(r).toEqual({ routed: true, leadId: "emlak" });
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]![1]).toBe("emlak"); // $2 = lead_id
  });

  it("sem a lista de funis (chamadores fora do turno), a regra de antes vale", async () => {
    const { pool } = fakePool([
      card("galeri", GALERI, "2026-10-31T18:44:00Z"),
      card("emlak", EMLAK, "2026-10-30T12:57:00Z"),
    ]);

    const r = await emitAgentActivityForContact({ ...nota, pool });

    expect(r).toEqual({ routed: true, leadId: "galeri" });
  });
});

/**
 * A preferência só existe se o TURNO passar a lista. Cerca de fonte: toda nota
 * que o turno grava em nome do assistente (`agentId` vindo de `agentConfig`)
 * leva também os funis dele. Sem isto, a função acima ficaria certa e o produto
 * continuaria escrevendo no card errado.
 */
describe("inbound-turn passa os funis do assistente para as notas do turno", () => {
  const fonte = readFileSync("lib/agent-engine/agent/inbound-turn.ts", "utf8");
  const chamadas = fonte
    .split("emitAgentActivityForContact({")
    .slice(1)
    .map((resto) => resto.slice(0, resto.indexOf("});")));
  const doAssistente = chamadas.filter((c) => c.includes("agentConfig?.agentId"));

  it("há notas do assistente no turno (a cerca não está vazia)", () => {
    expect(doAssistente.length).toBeGreaterThanOrEqual(2);
  });

  it("cada uma leva pipelineIds de agentConfig", () => {
    for (const c of doAssistente) {
      expect(c).toMatch(/pipelineIds:\s*agentConfig\.pipelineIds/);
    }
  });
});
