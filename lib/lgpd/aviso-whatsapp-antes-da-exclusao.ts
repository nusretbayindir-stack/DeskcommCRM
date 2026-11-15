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
