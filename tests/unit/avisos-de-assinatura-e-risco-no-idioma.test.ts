import { describe, expect, it, vi } from "vitest";

import type * as ProtecaoFollowup from "@/lib/agenda/protecao-followup";
import {
  avaliarAvisoDaAssinatura,
  corpoDoAvisoDeAssinatura,
  CORPO_DA_RESOLUCAO_DA_ASSINATURA,
  motivoLegivelDaAssinatura,
  TITULO_DO_AVISO_DE_ASSINATURA,
} from "@/lib/ai/credenciais/assinatura-desconectada";
import { sincronizarAvisoDaAssinatura } from "@/lib/ai/credenciais/aviso-da-assinatura";
import { traduzir } from "@/lib/i18n/dicionario";
import { preencher } from "@/lib/i18n/preencher";
import { semeiaEstadosDeRisco } from "@/lib/leads/risk-seed";

// A proteção da agenda tem leitura própria e não é o que este teste mede: aqui
// ela não protege ninguém, e o negócio parado fica parado.
vi.mock("@/lib/agenda/protecao-followup", async (original) => ({
  ...(await original<typeof ProtecaoFollowup>()),
  protecaoAgendaSupabase: async () => new Map(),
}));

/**
 * O AVISO DA ASSINATURA DESCONECTADA E O DO ACERVO EM RISCO SAEM NO IDIOMA DA
 * EMPRESA (S2a Task 5, U14). A Central mostra o texto como foi gravado.
 *
 * O português continua o de antes, byte a byte (os testes da assinatura e do
 * seed seguem comparando com ele), e o idioma só é lido quando há aviso a
 * gravar.
 */

const ROTULOS = [
  "refresh_token_revoked",
  "invalid_grant",
  "token_expired",
  "fetch_failed",
  "timeout",
  "recusado",
  "desconhecido",
];

describe("assinatura desconectada: os textos em todo idioma", () => {
  it("português: o texto de sempre, também sem idioma", () => {
    expect(corpoDoAvisoDeAssinatura("falha:invalid_grant", "pt-BR")).toBe(
      corpoDoAvisoDeAssinatura("falha:invalid_grant"),
    );
    expect(corpoDoAvisoDeAssinatura("falha:invalid_grant")).toBe(
      "A conta do ChatGPT que atende esta empresa foi recusada: a OpenAI recusou o pedido de renovação do login.\n\n" +
        "Enquanto isso, a IA não responde aos clientes que escrevem — as mensagens chegam e ficam sem resposta. " +
        "A cota da assinatura NÃO é o problema.\n\n" +
        "Para voltar: reconecte a conta em IA › Credenciais. Este aviso se fecha sozinho quando o login voltar.",
    );
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: título, corpo, cada motivo e o fechamento traduzidos`, () => {
      const abrir = avaliarAvisoDaAssinatura({ conectada: false, recusa: "falha:token_expired" }, null, idioma);
      if (abrir.acao !== "abrir") throw new Error("não abriu");
      expect(abrir.titulo).toBe(traduzir(TITULO_DO_AVISO_DE_ASSINATURA, idioma));
      expect(abrir.titulo).not.toBe(TITULO_DO_AVISO_DE_ASSINATURA);
      expect(abrir.corpo).not.toContain("A conta do ChatGPT");
      expect(abrir.corpo).toContain(motivoLegivelDaAssinatura("token_expired", idioma));
      // As três partes continuam separadas por linha em branco.
      expect(abrir.corpo.split("\n\n")).toHaveLength(3);

      for (const rotulo of ROTULOS) {
        expect(motivoLegivelDaAssinatura(rotulo, idioma), rotulo).not.toBe(motivoLegivelDaAssinatura(rotulo));
      }

      const resolver = avaliarAvisoDaAssinatura({ conectada: true, recusa: null }, { id: "i", body: "antes" }, idioma);
      if (resolver.acao !== "resolver") throw new Error("não resolveu");
      expect(resolver.corpo).toBe(`antes\n\n${traduzir(CORPO_DA_RESOLUCAO_DA_ASSINATURA, idioma)}`);
      expect(resolver.corpo).not.toContain(CORPO_DA_RESOLUCAO_DA_ASSINATURA);
    });
  }
});

/** O Supabase do aviso: um item aberto (ou nenhum) e o idioma da empresa. */
function supabaseDaAssinatura(locale: string | null, aberto: { id: string; body: string } | null) {
  const lidas: string[] = [];
  const escritas: Array<{ tipo: string; dados: Record<string, unknown> }> = [];
  const builder = (tabela: string) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      limit: () => b,
      maybeSingle: async () =>
        tabela === "organizations" ? { data: { locale }, error: null } : { data: aberto, error: null },
      insert: async (dados: Record<string, unknown>) => {
        escritas.push({ tipo: "insert", dados });
        return { error: null };
      },
      update: (dados: Record<string, unknown>) => {
        escritas.push({ tipo: "update", dados });
        return b;
      },
    });
    return b;
  };
  const db = {
    from: (tabela: string) => {
      lidas.push(tabela);
      return builder(tabela);
    },
  };
  return { db, lidas, escritas };
}

describe("assinatura desconectada: o aviso gravado", () => {
  it("abre no idioma da empresa", async () => {
    const alvo = supabaseDaAssinatura("tr", null);
    const desfecho = await sincronizarAvisoDaAssinatura(alvo.db as never, {
      organizationId: "org-1",
      conectada: false,
      recusa: "falha:invalid_grant",
    });

    expect(desfecho).toBe("aberto");
    expect(alvo.escritas[0]?.dados).toMatchObject({
      title: traduzir(TITULO_DO_AVISO_DE_ASSINATURA, "tr"),
      body: corpoDoAvisoDeAssinatura("falha:invalid_grant", "tr"),
    });
  });

  it("sem aviso a gravar, o idioma nem é lido", async () => {
    const alvo = supabaseDaAssinatura("tr", null);
    const desfecho = await sincronizarAvisoDaAssinatura(alvo.db as never, {
      organizationId: "org-1",
      conectada: true,
      recusa: null,
    });

    expect(desfecho).toBe("sem_mudanca");
    expect(alvo.lidas).not.toContain("organizations");
  });
});

// ─── o acervo em risco ───

const AGORA = new Date("2026-11-10T12:00:00.000Z");

/** O Supabase do seed: negócios parados há meses, numa etapa de um dia. */
function supabaseDoSeed(locale: string | null, negocios: number) {
  const lidas: string[] = [];
  const inseridos: Array<Record<string, unknown>> = [];
  const dados: Record<string, unknown[]> = {
    crm_leads: Array.from({ length: negocios }, (_, i) => ({
      id: `lead-${i + 1}`,
      stage_id: "etapa-1",
      contact_id: `contato-${i + 1}`,
      last_activity_at: "2026-06-01T12:00:00.000Z",
      created_at: "2026-05-01T12:00:00.000Z",
    })),
    crm_stages: [{ id: "etapa-1", expected_duration_hours: 24 }],
    cron_jobs: [],
  };
  const builder = (tabela: string) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      in: () => b,
      gt: () => b,
      gte: () => b,
      lt: () => b,
      lte: () => b,
      neq: () => b,
      is: () => b,
      not: () => b,
      limit: () => b,
      order: () => b,
      range: () => b,
      upsert: async () => ({ error: null }),
      maybeSingle: async () =>
        tabela === "organizations" ? { data: { locale }, error: null } : { data: null, error: null },
      insert: (linha: Record<string, unknown>) => {
        inseridos.push(linha);
        return { select: () => ({ maybeSingle: async () => ({ data: { id: "item-1" }, error: null }) }) };
      },
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
        Promise.resolve({ data: dados[tabela] ?? [], error: null }).then(ok, falha),
    });
    return b;
  };
  const admin = {
    from: (tabela: string) => {
      lidas.push(tabela);
      return builder(tabela);
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { admin, lidas, inseridos };
}

describe("acervo em risco: o aviso gravado", () => {
  it("português: o título de sempre, no singular e no plural", async () => {
    const um = supabaseDoSeed(null, 1);
    await semeiaEstadosDeRisco(um.admin as never, "org-1", AGORA);
    expect(um.inseridos[0]?.title).toBe("Revise 1 negócio parado e decida quais encerrar");

    const dois = supabaseDoSeed(null, 2);
    await semeiaEstadosDeRisco(dois.admin as never, "org-1", AGORA);
    expect(dois.inseridos[0]?.title).toBe("Revise 2 negócios parados e decida quais encerrar");
    expect(String(dois.inseridos[0]?.body)).toMatch(/^\d+ sem resposta há muito tempo e \d+ esfriando\. /);
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: título (singular e plural) e corpo no idioma da empresa`, async () => {
      const um = supabaseDoSeed(idioma, 1);
      await semeiaEstadosDeRisco(um.admin as never, "org-1", AGORA);
      expect(um.inseridos[0]?.title).toBe(
        preencher(traduzir("Revise {n} negócio parado e decida quais encerrar", idioma), { n: 1 }),
      );

      const dois = supabaseDoSeed(idioma, 2);
      await semeiaEstadosDeRisco(dois.admin as never, "org-1", AGORA);
      expect(dois.inseridos[0]?.title).toBe(
        preencher(traduzir("Revise {n} negócios parados e decida quais encerrar", idioma), { n: 2 }),
      );
      expect(dois.inseridos[0]?.title).not.toContain("Revise");
      expect(String(dois.inseridos[0]?.body)).not.toContain("sem resposta há muito tempo");
      expect(String(dois.inseridos[0]?.body)).not.toMatch(/\{\w+\}/);
    });
  }

  it("sem negócio em risco, o idioma nem é lido", async () => {
    const nenhum = supabaseDoSeed("tr", 0);
    await semeiaEstadosDeRisco(nenhum.admin as never, "org-1", AGORA);
    expect(nenhum.inseridos).toEqual([]);
    expect(nenhum.lidas).not.toContain("organizations");
  });
});
