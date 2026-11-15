/**
 * GET /api/v1/lgpd/requests
 *
 * Lista paginada de lgpd_requests para o tenant ativo.
 * Apenas role >= admin pode acessar (lgpd:execute permission).
 * organization_id sempre resolvido de sessão confiável — nunca do body.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { avisarAdminsDoNovoPedido } from "@/lib/lgpd/avisos-do-pedido-manual";
import { computeSlaBucket } from "@/lib/lgpd/balde-de-sla";
import {
  PRAZO_DO_PEDIDO_MANUAL,
  canaisDoContato,
  diaNoFuturo,
  instanteDoRecebimento,
  novoPedidoSchema,
  payloadDoPedidoManual,
} from "@/lib/lgpd/pedido-manual";
import { createLgpdRequest } from "@/lib/lgpd/repository";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z
    .enum(["received", "processing", "completed", "failed", "pending_review"])
    .optional(),
  type: z
    .enum(["redact", "data_request", "store_redact"])
    .optional(),
  sla_bucket: z.enum(["overdue", "critical", "warning", "ok"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * O BALDE DE SLA da linha é `computeSlaBucket`, de `lib/lgpd/balde-de-sla.ts` —
 * função pura, testada em `tests/unit/lgpd-prazo-e-dia-civil.test.ts`. O motivo
 * de a régua não estar neste arquivo está no cabeçalho de lá.
 */

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("admin", {
    requestId,
    resource: "lgpd_requests",
    allowPlatformAdmin: "leitura",
    permiteOrgSuspensa: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { org: activeOrg } = authz;

  const supabase = await createClient();

  // Parse + validate query params
  const rawParams: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    rawParams[k] = v;
  });
  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    return fail("validation_failed", t("Parâmetros inválidos."), 422, {
      details: parsed.error.flatten(),
      requestId,
    });
  }
  const { status, type, page, limit } = parsed.data;

  const orgId = activeOrg.orgId;
  const offset = (page - 1) * limit;

  // Count query (before sla_bucket filter which is client-side)
  let countQuery = supabase
    .from("lgpd_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (status) countQuery = countQuery.eq("status", status);
  if (type) countQuery = countQuery.eq("request_type", type);
  const { count } = await countQuery;
  const total = count ?? 0;

  // Data query
  let dataQuery = supabase
    .from("lgpd_requests")
    .select(
      "id, organization_id, request_type, source, contact_id, external_customer_id, status, attempts, received_at, due_at, completed_at, emergency, scope, error_message",
    )
    .eq("organization_id", orgId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) dataQuery = dataQuery.eq("status", status);
  if (type) dataQuery = dataQuery.eq("request_type", type);

  const { data: rows, error: dbErr } = await dataQuery;
  if (dbErr) {
    return fail("internal_error", dbErr.message, 500, { requestId });
  }

  // Balde por linha. A régua mora em `lib/lgpd/balde-de-sla.ts` porque é
  // aritmética de DIA CIVIL (`due_at` guarda um dia, não um instante) e
  // aritmética testada precisa ficar onde o teste alcança. A versão que estava
  // neste arquivo comparava milissegundos e marcava "Vencido" 26h antes do prazo.
  const enriched = (rows ?? []).map((r) => ({
    ...r,
    sla_bucket: computeSlaBucket(r.due_at, r.received_at),
  }));

  const filtered = parsed.data.sla_bucket
    ? enriched.filter((r) => r.sla_bucket === parsed.data.sla_bucket)
    : enriched;

  return ok(filtered, {
    requestId,
    meta: {
      total,
      page,
      limit,
      has_more: offset + limit < total,
    },
  });
}

/**
 * POST /api/v1/lgpd/requests (U53)
 *
 * A equipe registra, pela tela do contato, um pedido de acesso ou apagamento
 * que chegou por fora do CRM. Role >= agent, só por sessão de cookie (sem
 * chave de API). O endereço de entrega nunca vem do corpo: é o e-mail do
 * cadastro naquele momento. Abrir NÃO emite evento — quem dispara a execução
 * é a aprovação do admin (`[id]/approve`). A auditoria leva só código e id:
 * nota, e-mail e telefone ficam fora dela, do log e da Central.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("agent", {
    requestId,
    resource: "lgpd_requests",
    allowPlatformAdmin: true,
    permiteOrgSuspensa: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user: authUser, org: activeOrg } = authz;
  const orgId = activeOrg.orgId;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fail("invalid_request", t("Body JSON inválido."), 400, { requestId });
  }

  const parsed = novoPedidoSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail("validation_failed", t("Parâmetros inválidos."), 422, {
      details: parsed.error.flatten(),
      requestId,
    });
  }
  const { contact_id, request_type, received_at, canal } = parsed.data;
  const observacao = parsed.data.observacao ? parsed.data.observacao : null;

  const agora = new Date();
  if (diaNoFuturo(received_at, agora)) {
    return fail(
      "data_no_futuro",
      t("A data de chegada não pode estar no futuro."),
      422,
      { requestId },
    );
  }

  const admin = createAdminClient();

  const { data: contato, error: contatoErr } = await admin
    .from("contacts")
    .select("id, email, phone_number, wa_lid, is_anonymized")
    .eq("organization_id", orgId)
    .eq("id", contact_id)
    .maybeSingle();
  if (contatoErr) {
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }
  if (!contato) {
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  }
  if (contato.is_anonymized) {
    return fail(
      "contato_anonimizado",
      t("Este contato já foi anonimizado."),
      409,
      { requestId },
    );
  }

  const canais = canaisDoContato(contato);
  const canalExiste =
    canal === "whatsapp_registrado"
      ? canais.whatsapp
      : canal === "email_registrado"
        ? canais.email
        : true;
  if (!canalExiste) {
    return fail(
      "canal_incompativel",
      t("Este contato não tem o canal escolhido."),
      422,
      { requestId },
    );
  }

  const { data: aberto, error: abertoErr } = await admin
    .from("lgpd_requests")
    .select("id, due_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contact_id)
    .eq("request_type", request_type)
    .in("status", ["received", "processing", "pending_review"])
    .limit(1)
    .maybeSingle();
  if (abertoErr) {
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }
  if (aberto) {
    return fail(
      "pedido_aberto",
      t("Já existe um pedido aberto deste tipo para este contato."),
      409,
      { details: { due_at: aberto.due_at }, requestId },
    );
  }

  let criado: { id: string; due_at: string };
  try {
    criado = await createLgpdRequest({
      organizationId: orgId,
      requestType: request_type,
      source: "manual",
      contactId: contact_id,
      slaDays: PRAZO_DO_PEDIDO_MANUAL[request_type],
      receivedAt: instanteDoRecebimento(received_at, agora),
      payload: payloadDoPedidoManual({
        canal,
        observacao,
        criadoPor: authUser.id,
        agora,
        emailDoContato: contato.email,
      }),
    });
  } catch (err) {
    logger.error("[lgpd-pedido-manual] pedido não gravado", {
      erro: err instanceof Error ? err.name : "desconhecido",
    });
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }

  void audit({
    action:
      request_type === "data_request"
        ? "lgpd.data_request_received"
        : "lgpd.redact_received",
    actorUserId: authUser.id,
    organizationId: orgId,
    resourceType: "lgpd_request",
    resourceId: criado.id,
    requestId,
    metadata: { source: "manual", canal, request_id: criado.id },
  });

  // Não lança: o pedido já está gravado e um aviso que falha não o desfaz.
  await avisarAdminsDoNovoPedido(admin, {
    organizationId: orgId,
    requestId: criado.id,
    tipo: request_type,
    dueAt: criado.due_at,
  });

  return ok({ id: criado.id, due_at: criado.due_at }, { requestId, status: 201 });
}
