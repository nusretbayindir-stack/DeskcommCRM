/**
 * O CARD NOVO DE OUTRO FUNIL COMEÇA NO PASSO DELE.
 *
 * O passo do funil do agente é UM por contato (`lead_state`, chave
 * `organization_id + contact_id`), não por card. Quando o roteador abre um card
 * A MAIS em outro funil de produto (`card_adicional` em `destino-da-intencao.ts`),
 * o contato chega com o passo que andou no OUTRO produto — e o passo só anda para
 * a frente. Medido no demo de 31/10/2026: o contato estava em `negotiating`; o
 * card de İnşaat nasceu em "Yeni talep" e, em cinco turnos e com a visita
 * marcada, não andou: de `negotiating` não há avanço para `qualified` ("Keşif
 * randevusu"), e o agente nem tentou.
 *
 * Aqui o passo do contato volta ao passo da etapa onde o card novo nasceu (o
 * `agent_stage_hint` dela; sem hint, ou com hint fora do vocabulário, `new`).
 *
 * O que NÃO muda, de propósito:
 * - Só o PASSO. O BANT (`qualification`) e a próxima ação ficam: são do contato,
 *   e a próxima ação carrega a autorização humana (`next_action_seq`).
 * - Contato sem linha em `lead_state`: nada a escrever, o padrão já é `new`.
 * - Card ou etapa que não se lê: não se mexe — chutar `new` apagaria o avanço
 *   real do contato por causa de uma leitura que falhou.
 * - A transferência de um funil de ENTRADA (`transferido`) não chama isto: lá é
 *   o mesmo negócio que continua, e o passo dele vale.
 * - Não grava em `lead_state_transitions`: lá mora o que o MODELO avançou (o
 *   painel de evolução conta essas linhas); recomeçar o passo não é avanço.
 *
 * Sem lock, como `applyLeadStateUpdate`: a fila tem lane por contato, e turnos do
 * mesmo contato não correm em paralelo.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getLeadState, LEAD_STAGES, type LeadStage } from './lead-state';
import type { Queryable } from '../queue/queue';

export type AlinhamentoDoPasso =
  | { status: 'alinhado'; de: LeadStage; para: LeadStage }
  | { status: 'ja_alinhado' | 'sem_estado' | 'sem_card' };

/** O passo que a etapa declara; sem hint, ou com hint que não é passo (banco antigo), `new`. */
function passoDaEtapa(hint: unknown): LeadStage {
  return typeof hint === 'string' && (LEAD_STAGES as readonly string[]).includes(hint)
    ? (hint as LeadStage)
    : 'new';
}

export async function alinhaPassoAoCardNovo(
  admin: SupabaseClient,
  db: Queryable,
  input: { organizationId: string; contactId: string; cardId: string },
): Promise<AlinhamentoDoPasso> {
  const { data: card, error: cardErr } = await admin
    .from('crm_leads')
    .select('stage_id')
    .eq('organization_id', input.organizationId)
    .eq('id', input.cardId)
    .maybeSingle();
  const stageId = (card as { stage_id?: string | null } | null)?.stage_id;
  if (cardErr || typeof stageId !== 'string') return { status: 'sem_card' };

  const { data: etapa, error: etapaErr } = await admin
    .from('crm_stages')
    .select('agent_stage_hint')
    .eq('organization_id', input.organizationId)
    .eq('id', stageId)
    .maybeSingle();
  if (etapaErr || etapa === null) return { status: 'sem_card' };
  const para = passoDaEtapa((etapa as { agent_stage_hint?: unknown }).agent_stage_hint);

  const atual = await getLeadState(db, input.organizationId, input.contactId);
  if (atual === null) return { status: 'sem_estado' };
  if (atual.stage === para) return { status: 'ja_alinhado' };

  await db.query(
    'update lead_state set stage = $3, updated_at = now() where organization_id = $1 and contact_id = $2',
    [input.organizationId, input.contactId, para],
  );
  return { status: 'alinhado', de: atual.stage, para };
}
