/**
 * U53: o aviso na Central para os admins quando um pedido do titular é aberto
 * pela tela, e o fechamento dele quando o pedido acaba.
 *
 * Um item por admin, cada um com `para_user_id`: o "Marcar todos resolvidos" de
 * um atendente não fecha o aviso de quem decide (a lista, o contador e o
 * resolver da Central já filtram por dono). O título leva só o tipo e o prazo;
 * nome, e-mail, telefone e texto do pedido ficam na tela do pedido, protegida
 * pelo papel, e nunca vão para a Central nem para o log.
 *
 * Nenhuma das duas funções lança: o pedido já foi gravado, e um aviso que
 * falha não pode desfazê-lo.
 */
import { idiomaDaOrgPeloSupabase } from "@/lib/ai/agents/idioma-da-org";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { logger } from "@/lib/logger";

import type { TipoDoPedidoManual } from "./pedido-manual";
import { prazoEmBr } from "./sla";

const REF_KIND = "lgpd_request";

const TITULO: Record<TipoDoPedidoManual, string> = {
  data_request: "Novo pedido de acesso aos dados — prazo {data}",
  redact: "Novo pedido de exclusão dos dados — prazo {data}",
};

interface Banco {
  from(tabela: string): {
    select(colunas: string): {
      eq(coluna: string, valor: string): {
        eq(coluna: string, valor: string): {
          is(coluna: string, valor: null): PromiseLike<{ data: unknown; error?: unknown }>;
        };
      };
    };
    insert(linhas: Array<Record<string, unknown>>): PromiseLike<{ error?: unknown }>;
    update(valores: Record<string, unknown>): {
      eq(coluna: string, valor: string): {
        eq(coluna: string, valor: string): {
          eq(coluna: string, valor: string): {
            eq(coluna: string, valor: string): PromiseLike<{ error?: unknown }>;
          };
        };
      };
    };
  };
}

export function tituloDoAvisoDoPedido(tipo: TipoDoPedidoManual, dueAt: string, idioma: Idioma): string {
  return traduzir(TITULO[tipo], idioma).replace("{data}", prazoEmBr(dueAt) ?? "");
}

export async function avisarAdminsDoNovoPedido(
  admin: unknown,
  i: { organizationId: string; requestId: string; tipo: TipoDoPedidoManual; dueAt: string },
): Promise<{ avisados: number }> {
  try {
    const banco = admin as Banco;
    const { data, error } = await banco
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", i.organizationId)
      .eq("role", "admin")
      .is("revoked_at", null);
    if (error) throw error;
    const donos = ((data ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
    if (donos.length === 0) return { avisados: 0 };

    const idioma = await idiomaDaOrgPeloSupabase(admin, i.organizationId);
    const title = tituloDoAvisoDoPedido(i.tipo, i.dueAt, idioma);
    const linhas = donos.map((dono) => ({
      organization_id: i.organizationId,
      para_user_id: dono,
      kind: "other",
      severity: "warn",
      ref_kind: REF_KIND,
      ref_id: i.requestId,
      status: "open",
      title,
    }));
    const { error: erroInsert } = await banco.from("agent_inbox_items").insert(linhas);
    if (erroInsert) throw erroInsert;
    return { avisados: linhas.length };
  } catch {
    // Só a contagem: o erro do banco pode carregar valores da linha.
    logger.warn("[lgpd-pedido-manual] aviso não gravado", { quantidade: 0 });
    return { avisados: 0 };
  }
}

export async function resolverAvisosDoPedido(admin: unknown, organizationId: string, requestId: string): Promise<void> {
  try {
    const { error } = await (admin as Banco)
      .from("agent_inbox_items")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("ref_kind", REF_KIND)
      .eq("ref_id", requestId)
      .eq("status", "open");
    if (error) throw error;
  } catch {
    logger.warn("[lgpd-pedido-manual] aviso não resolvido", { quantidade: 0 });
  }
}
