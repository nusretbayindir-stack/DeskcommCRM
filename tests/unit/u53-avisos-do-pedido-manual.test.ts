// @vitest-environment node
/**
 * U53: o aviso na Central para cada admin quando um pedido do titular é aberto,
 * e o fechamento dele quando o pedido acaba.
 *
 * O dublê do admin registra cada filtro: o que importa aqui é que o aviso nasce
 * com dono (`para_user_id`), sem dado do titular, e que nada lança.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const estado = {
    locale: "pt-BR",
    membros: [] as Array<{ user_id: string }>,
    erroNoInsert: false,
    filtrosMembros: [] as Array<[string, unknown]>,
    inseridos: [] as Array<Record<string, unknown>>,
    atualizacoes: [] as Array<Record<string, unknown>>,
    filtrosUpdate: [] as Array<[string, unknown]>,
  };

  function criar() {
    return {
      from(tabela: string) {
        let operacao: "select" | "insert" | "update" = "select";
        const cadeia: Record<string, unknown> = {
          select: () => cadeia,
          insert: (linhas: Array<Record<string, unknown>> | Record<string, unknown>) => {
            operacao = "insert";
            estado.inseridos.push(...(Array.isArray(linhas) ? linhas : [linhas]));
            return cadeia;
          },
          update: (valores: Record<string, unknown>) => {
            operacao = "update";
            estado.atualizacoes.push(valores);
            return cadeia;
          },
          eq: (coluna: string, valor: unknown) => {
            if (tabela === "user_organizations") estado.filtrosMembros.push([coluna, valor]);
            if (tabela === "agent_inbox_items" && operacao === "update") estado.filtrosUpdate.push([coluna, valor]);
            return cadeia;
          },
          is: (coluna: string, valor: unknown) => {
            if (tabela === "user_organizations") estado.filtrosMembros.push([coluna, valor]);
            return cadeia;
          },
          maybeSingle: async () => ({ data: tabela === "organizations" ? { locale: estado.locale } : null, error: null }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
            let resposta: { data: unknown; error: unknown } = { data: null, error: null };
            if (tabela === "user_organizations") resposta = { data: estado.membros, error: null };
            if (tabela === "agent_inbox_items" && operacao === "insert" && estado.erroNoInsert) {
              resposta = { data: null, error: { message: "falhou" } };
            }
            return Promise.resolve(resposta).then(res, rej);
          },
        };
        return cadeia;
      },
    };
  }

  return { estado, criar };
});

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { avisarAdminsDoNovoPedido, resolverAvisosDoPedido, tituloDoAvisoDoPedido } from "@/lib/lgpd/avisos-do-pedido-manual";

beforeEach(() => {
  h.estado.locale = "pt-BR";
  h.estado.membros = [];
  h.estado.erroNoInsert = false;
  h.estado.filtrosMembros.length = 0;
  h.estado.inseridos.length = 0;
  h.estado.atualizacoes.length = 0;
  h.estado.filtrosUpdate.length = 0;
});

describe("aviso do pedido do titular na Central (U53)", () => {
  it("um aviso por admin, cada um com dono, sem dado do titular", async () => {
    h.estado.locale = "nl";
    h.estado.membros = [{ user_id: "a1" }, { user_id: "a2" }];
    const r = await avisarAdminsDoNovoPedido(h.criar(), { organizationId: "org-1", requestId: "p1", tipo: "data_request", dueAt: "2026-11-24T00:00:00.000Z" });
    expect(r.avisados).toBe(2);
    expect(h.estado.filtrosMembros).toEqual(expect.arrayContaining([["organization_id", "org-1"], ["role", "admin"], ["revoked_at", null]]));
    expect(h.estado.inseridos).toEqual([
      expect.objectContaining({ organization_id: "org-1", para_user_id: "a1", kind: "other", severity: "warn", ref_kind: "lgpd_request", ref_id: "p1", title: "Nieuw verzoek om inzage in gegevens — uiterlijk 24/11/2026" }),
      expect.objectContaining({ para_user_id: "a2" }),
    ]);
    for (const linha of h.estado.inseridos) expect(linha.body ?? null).toBeNull();
  });

  it("pt-BR byte a byte; nl, fr e tr sem palavra portuguesa", () => {
    expect(tituloDoAvisoDoPedido("redact", "2026-11-24T00:00:00.000Z", "pt-BR")).toBe("Novo pedido de exclusão dos dados — prazo 24/11/2026");
    for (const idioma of ["nl", "fr", "tr"] as const) {
      const titulo = tituloDoAvisoDoPedido("redact", "2026-11-24T00:00:00.000Z", idioma);
      expect(titulo).not.toMatch(/pedido|exclusão|prazo/i);
    }
  });

  it("org sem admin: nenhum aviso, nenhum erro", async () => {
    h.estado.membros = [];
    await expect(avisarAdminsDoNovoPedido(h.criar(), { organizationId: "org-1", requestId: "p1", tipo: "redact", dueAt: "2026-11-24T00:00:00.000Z" })).resolves.toEqual({ avisados: 0 });
  });

  it("falha do insert não lança", async () => {
    h.estado.membros = [{ user_id: "a1" }];
    h.estado.erroNoInsert = true;
    await expect(avisarAdminsDoNovoPedido(h.criar(), { organizationId: "org-1", requestId: "p1", tipo: "redact", dueAt: "2026-11-24T00:00:00.000Z" })).resolves.toEqual({ avisados: 0 });
  });

  it("resolver fecha só os avisos abertos deste pedido nesta org", async () => {
    await resolverAvisosDoPedido(h.criar(), "org-1", "p1");
    expect(h.estado.atualizacoes[0]).toMatchObject({ status: "resolved", resolved_at: expect.any(String) });
    expect(h.estado.filtrosUpdate).toEqual(expect.arrayContaining([["organization_id", "org-1"], ["ref_kind", "lgpd_request"], ["ref_id", "p1"], ["status", "open"]]));
  });
});
