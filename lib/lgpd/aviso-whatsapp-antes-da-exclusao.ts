/**
 * Regra do aviso pelo WhatsApp antes de aprovar uma exclusão (U53).
 *
 * Mora fora de `pedido-manual.ts` de propósito: ela precisa de
 * `exclusaoForaDoBrasil`, do módulo do atestado, que é só de servidor
 * (`node:crypto`). `pedido-manual.ts` é importado por componentes de cliente e
 * tem de continuar importando apenas `zod`.
 */
import { exclusaoForaDoBrasil } from "./atestado-de-anonimizacao";

function preenchido(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * A aprovação desta exclusão exige que a equipe já tenha avisado o titular pelo
 * WhatsApp? Sim quando é exclusão fora do Brasil e não há e-mail para o aviso e
 * o atestado. Mesma ordem de endereço do worker de exclusão: e-mail do contato
 * primeiro, depois `request_payload.email`.
 */
export function exigeAvisoNoWhatsapp(p: {
  requestType: string;
  paisCodigo: string;
  emailDoContato: string | null | undefined;
  payload: unknown;
}): boolean {
  // `store_redact` é da loja, sem pessoa a avisar: só o pedido de exclusão de contato conta.
  if (p.requestType !== "redact" || !exclusaoForaDoBrasil(p.requestType, p.paisCodigo)) return false;
  const payload = (p.payload && typeof p.payload === "object" ? p.payload : {}) as Record<string, unknown>;
  return !preenchido(p.emailDoContato) && !preenchido(payload.email);
}

/**
 * Esta aprovação pode exigir o aviso? Só pedido de exclusão de uma PESSOA (com
 * contato) fora do Brasil; nos demais casos o e-mail do contato nem precisa ser
 * lido. A rota de aprovação usa isto para decidir se lê o contato.
 */
export function podeExigirAvisoAntesDaAprovacao(p: {
  contactId: string | null | undefined;
  requestType: string;
  paisCodigo: string;
}): boolean {
  return p.requestType === "redact" && Boolean(p.contactId) && exclusaoForaDoBrasil(p.requestType, p.paisCodigo);
}

/**
 * A regra ÚNICA do "exige o aviso antes de aprovar": a rota de aprovação a usa
 * para recusar (422) e o painel do detalhe a usa para mostrar a caixa. Se os
 * dois divergissem, a tela esconderia a caixa onde o servidor a cobra e o admin
 * nunca conseguiria aprovar.
 */
export function exigeAvisoAntesDaAprovacao(p: {
  contactId: string | null | undefined;
  requestType: string;
  paisCodigo: string;
  emailDoContato: string | null | undefined;
  payload: unknown;
}): boolean {
  return podeExigirAvisoAntesDaAprovacao(p) && exigeAvisoNoWhatsapp(p);
}
