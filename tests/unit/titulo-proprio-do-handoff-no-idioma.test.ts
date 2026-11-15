/**
 * U55 — os títulos PRÓPRIOS da Central (suspeita de opt-out, teto de gasto) no
 * idioma da organização.
 *
 * O título padrão da passagem já saía por `traduzir(...)` no idioma da empresa
 * (`titulo-do-handoff-no-idioma.test.ts`), mas o `inboxTitle` de quem chama
 * passava cru: numa empresa belga a Central dizia "Suspeita de opt-out — assumir
 * a conversa e pedir ao cliente a palavra que a regra reconhece". A Central
 * mostra o título como foi gravado (nunca passa por t() na tela), então quem
 * grava tem de gravar traduzido. O pt-BR fica byte a byte.
 */
import { describe, expect, it, vi } from "vitest";

import { performHumanHandoff } from "@/lib/agent-engine/agent/human-handoff";
import {
  TITULO_DO_HANDOFF_POR_ORCAMENTO,
  TITULO_DO_HANDOFF_POR_SUSPEITA_DE_OPT_OUT,
} from "@/lib/agent-engine/agent/inbound-turn";
import { montarBriefingDaPassagem } from "@/lib/escalacao/briefing-da-passagem";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";

const ORG = "55555555-1111-4111-8111-111111111111";
const LEAD = "55555555-2222-4222-8222-222222222222";
const CONVERSA = "55555555-3333-4333-8333-333333333333";

const TITULOS = [
  { titulo: TITULO_DO_HANDOFF_POR_SUSPEITA_DE_OPT_OUT, origem: "opt_out_provavel", motivoCodigo: "suspected_optout" },
  { titulo: TITULO_DO_HANDOFF_POR_ORCAMENTO, origem: "teto_de_gasto", motivoCodigo: "orcamento_de_ia" },
] as const;

/** Todo idioma servido fora do pt-BR: um idioma que vire visível entra na régua sozinho. */
const OUTROS = IDIOMAS.filter((idioma) => idioma !== "pt-BR");

/** Palavras que só o português do título tem — o espanhol "gasto"/"conversación" não entra. */
const PORTUGUES = /\b(assumir|suspeita|teto|atingido|regra|reconhece)\b/i;

async function tituloGravado(
  { titulo, origem, motivoCodigo }: (typeof TITULOS)[number],
  idioma: Idioma,
): Promise<unknown> {
  const chamadas: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    chamadas.push({ sql, params });
    return { rows: [], rowCount: 0 };
  });
  await performHumanHandoff(
    { query } as never,
    { tenantId: ORG, leadId: LEAD, conversationId: CONVERSA },
    {
      reason: "teste",
      conversationSummary: "resumo",
      inboxTitle: titulo,
      passagem: {
        origem,
        motivoCodigo,
        briefing: montarBriefingDaPassagem({
          checkpoint: { commitments: [], objections: [], next_action: "", rolling_summary: "" },
        }),
        idioma,
      },
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    },
  );
  const central = chamadas.find((c) => c.sql.includes("insert into agent_inbox_items"));
  expect(central, "a passagem grava o item da Central").toBeDefined();
  // $2 do insert é o título (o corpo é o $3).
  return central?.params[1];
}

describe("U55 — título próprio da Central no idioma da organização", () => {
  it("a régua alcança os idiomas de hoje (o verde abaixo não é vacuidade)", () => {
    expect(OUTROS).toEqual(expect.arrayContaining(["tr", "nl", "fr", "es"]));
  });

  for (const caso of TITULOS) {
    it(`pt-BR: "${caso.titulo}" byte a byte`, async () => {
      expect(await tituloGravado(caso, "pt-BR")).toBe(caso.titulo);
    });

    it.each(OUTROS)(`%s: "${caso.titulo}" sai traduzido, sem português`, async (idioma) => {
      const gravado = await tituloGravado(caso, idioma);
      expect(gravado).toBe(traduzir(caso.titulo, idioma));
      expect(gravado).not.toBe(caso.titulo);
      expect(String(gravado)).not.toMatch(PORTUGUES);
    });
  }
});
