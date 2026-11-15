/**
 * Regras puras do pedido do titular registrado pela tela (U53).
 *
 * A equipe registra, na página do contato, um pedido de acesso/apagamento que
 * chegou por fora do CRM; o administrador aprova ou encerra. Aqui moram só as
 * regras sem I/O — rotas, workers e telas consomem este módulo.
 */

import { z } from "zod";

import { exclusaoForaDoBrasil } from "./atestado-de-anonimizacao";

/** Prazo (dias) de cada tipo de pedido aberto pela tela. */
export const PRAZO_DO_PEDIDO_MANUAL = { data_request: 7, redact: 15 } as const;

export type TipoDoPedidoManual = "data_request" | "redact";

/** Por onde o pedido chegou ao titular → equipe. */
export type CanalDoPedido = "whatsapp_registrado" | "email_registrado" | "outro";

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dia civil existente (rejeita 2026-02-31, que o Date normalizaria). */
function diaValido(dia: string): boolean {
  if (!DIA_RE.test(dia)) return false;
  const d = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
}

/**
 * Corpo aceito por `POST /api/v1/lgpd/requests` vindo da tela. Campos
 * desconhecidos (inclusive `delivery`) são descartados: o endereço de entrega
 * nunca vem do cliente, é fixado pelo servidor a partir do cadastro.
 */
export const novoPedidoSchema = z
  .object({
    contact_id: z.string().uuid(),
    request_type: z.enum(["data_request", "redact"]),
    received_at: z.string().refine(diaValido, "dia inválido (AAAA-MM-DD)"),
    canal: z.enum(["whatsapp_registrado", "email_registrado", "outro"]),
    observacao: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.canal === "outro" && (v.observacao ?? "").length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["observacao"],
        message: "descreva o canal em pelo menos 10 caracteres",
      });
    }
  });

/** Dia civil (AAAA-MM-DD) de um instante, em UTC. */
function diaCivil(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

const CATORZE_HORAS_MS = 14 * 60 * 60 * 1000;

/**
 * O dia informado está no futuro? Compara com o dia civil de `agora + 14 h`,
 * o fuso mais adiantado do mundo (UTC+14): assim "hoje" nunca é recusado,
 * em nenhum país, mesmo quando o dia UTC ainda é o de ontem.
 */
export function diaNoFuturo(dia: string, agora: Date): boolean {
  return dia > diaCivil(new Date(agora.getTime() + CATORZE_HORAS_MS));
}

/** Instante gravado em `received_at`: meio-dia UTC do dia, nunca depois de `agora`. */
export function instanteDoRecebimento(dia: string, agora: Date): Date {
  const meioDia = new Date(`${dia}T12:00:00Z`);
  return meioDia.getTime() < agora.getTime() ? meioDia : agora;
}

function preenchido(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Quais canais o cadastro do contato permite usar (só `wa_lid` já basta para WhatsApp). */
export function canaisDoContato(c: {
  phone_number?: string | null;
  wa_lid?: string | null;
  email?: string | null;
}): { whatsapp: boolean; email: boolean } {
  return {
    whatsapp: preenchido(c.phone_number) || preenchido(c.wa_lid),
    email: preenchido(c.email),
  };
}

/**
 * `request_payload` de um pedido aberto pela tela. Fixa o e-mail do cadastro
 * naquele momento: o relatório vai ao endereço que valia ao abrir o pedido,
 * não a um e-mail alterado ou incluído depois.
 */
export function payloadDoPedidoManual(i: {
  canal: CanalDoPedido;
  observacao: string | null;
  criadoPor: string;
  agora: Date;
  emailDoContato: string | null | undefined;
}): Record<string, unknown> {
  const email = typeof i.emailDoContato === "string" ? i.emailDoContato.trim() : "";
  return {
    origem_manual: {
      canal: i.canal,
      observacao: i.observacao,
      criado_por: i.criadoPor,
      criado_em: i.agora.toISOString(),
    },
    delivery: email ? { address: email, origem: "cadastro_no_pedido" } : null,
  };
}

function textoOuNulo(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Para onde o relatório do pedido vai. Pedido da tela (`origem_manual`) usa só
 * o endereço fixado no payload; pedido antigo (Nuvemshop) mantém a regra de
 * sempre: `delivery.address`, senão o e-mail atual do contato.
 */
export function enderecoDeEntrega(
  payload: unknown,
  emailDoContato: string | null | undefined,
): string | null {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const delivery =
    p.delivery && typeof p.delivery === "object"
      ? (p.delivery as Record<string, unknown>)
      : null;
  const fixado = textoOuNulo(delivery?.address);
  const origemManual = p.origem_manual;
  if (origemManual && typeof origemManual === "object") return fixado;
  return fixado ?? textoOuNulo(emailDoContato);
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
  if (!exclusaoForaDoBrasil(p.requestType, p.paisCodigo)) return false;
  const payload = (p.payload && typeof p.payload === "object" ? p.payload : {}) as Record<string, unknown>;
  return textoOuNulo(p.emailDoContato) === null && textoOuNulo(payload.email) === null;
}

/** Rótulo pt-BR da origem; a tela traduz com `t()`. */
export function rotuloDaOrigem(source: string | null | undefined): string {
  switch (source) {
    case "nuvemshop":
      return "Nuvemshop";
    case "manual":
      return "Pelo painel";
    case "api":
      return "API";
    case "support":
      return "Suporte";
    default:
      return preenchido(source) ? (source as string) : "—";
  }
}
