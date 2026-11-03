import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

/**
 * AS RESPOSTAS DO ASSISTENTE NO MÊS (S4, migration 7001): o número que a aba
 * Clientes de /admin/cobranca mostra contra a cota do plano (`respostas_mes`).
 * Só exibição: quem para o assistente é o teto de IA (`teto_ia_usd_cents`); o
 * excedente é faturado à mão, em blocos, no fim do mês (contrato, anexo 1).
 */

/** Respostas por bloco extra (contrato, anexo 1). */
export const TAMANHO_DO_BLOCO = 250;

/** Blocos extras começados no mês; `null` = plano sem cota (não há o que comparar). */
export function blocosExtras(respostas: number, cota: number | null): number | null {
  if (cota === null) return null;
  return Math.ceil(Math.max(0, respostas - cota) / TAMANHO_DO_BLOCO);
}

/**
 * Respostas da org no mês de `agora`, no fuso da org (o SQL calcula o mês).
 * `null` quando a leitura falha: a tela mostra "—" e não cai. O log leva só o
 * código do erro — nem a org, nem a mensagem do banco.
 */
export async function lerRespostasDoMes(db: SupabaseClient, orgId: string, agora: Date): Promise<number | null> {
  try {
    const { data, error } = await db.rpc("fn_respostas_do_assistente_no_mes", { p_org: orgId, p_agora: agora.toISOString() });
    if (error) {
      logger.warn("cobranca.respostas_ilegiveis", { erro: error.code ?? "desconhecido" });
      return null;
    }
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  } catch {
    logger.warn("cobranca.respostas_ilegiveis", { erro: "sem_resposta" });
    return null;
  }
}

/** A célula da aba Clientes: "551 / 300 · +2 blocos extras", "120 / 300", "42" ou "—". */
export function textoDasRespostas(respostas: number | null, cota: number | null, t: (texto: string) => string): string {
  if (respostas === null) return "—";
  if (cota === null) return String(respostas);
  const blocos = blocosExtras(respostas, cota) ?? 0;
  const base = `${respostas} / ${cota}`;
  if (blocos === 0) return base;
  const extra = blocos === 1 ? t("+1 bloco extra") : t("+{n} blocos extras").replace("{n}", String(blocos));
  return `${base} · ${extra}`;
}
