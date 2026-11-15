import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/lgpd/requests/[id]/encerrar (U53)
 *
 * O admin fecha um pedido do titular de duas maneiras:
 *  - `entregue_manualmente` (só em `pending_review`): o relatório foi levado ao
 *    titular por fora; o pedido vira `completed`.
 *  - `encerrado` (só em `received`, antes da aprovação): o pedido não segue, com
 *    motivo; vira `failed` com `error_message = encerrado_pelo_responsavel`.
 *
 * Sem Idempotency-Key: a transição acontece uma vez, e a segunda chamada já
 * encontra outro estado e recebe 409. O UPDATE repete o estado esperado no
 * filtro, para duas chamadas simultâneas não passarem juntas.
 *
 * O aviso do art. 12 (recusa) NÃO sai daqui: a tela chama `/art12` antes.
 * A trilha de auditoria leva só códigos e id; a nota fica no `result`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzir } from "@/lib/i18n/dicionario";
import { resolverAvisosDoPedido } from "@/lib/lgpd/avisos-do-pedido-manual";
import { ENCERRADO_PELO_RESPONSAVEL, encerramentoSchema } from "@/lib/lgpd/encerramento";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  const authz = await requireRole("admin", {
    requestId,
    resource: "lgpd_requests",
    allowPlatformAdmin: true,
    permiteOrgSuspensa: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user: authUser, org: activeOrg } = authz;
  const orgId = activeOrg.orgId;

  const { id } = await params;
  if (!UUID.test(id)) {
    return fail("not_found", t("Solicitação não encontrada."), 404, { requestId });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fail("invalid_request", t("Body JSON inválido."), 400, { requestId });
  }

  const parsed = encerramentoSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail("validation_failed", t("Parâmetros inválidos."), 422, {
      details: parsed.error.flatten(),
      requestId,
    });
  }
  const corpo = parsed.data;

  const admin = createAdminClient();

  const { data: pedido, error: leituraErr } = await admin
    .from("lgpd_requests")
    .select("id, status, result")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (leituraErr) {
    logger.error("[lgpd-encerrar] leitura falhou", { requestId, organizationId: orgId });
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }
  if (!pedido) {
    return fail("not_found", t("Solicitação não encontrada."), 404, { requestId });
  }

  const entrega = corpo.acao === "entregue_manualmente";
  const estadoEsperado = entrega ? "pending_review" : "received";
  if (pedido.status !== estadoEsperado) {
    return fail(
      "conflict",
      entrega
        ? t("Só um pedido em revisão pendente pode ser marcado como entregue.")
        : t("Só um pedido recebido, antes da aprovação, pode ser encerrado."),
      409,
      { requestId },
    );
  }

  const agora = new Date().toISOString();
  const resultAtual =
    typeof pedido.result === "object" && pedido.result !== null && !Array.isArray(pedido.result)
      ? (pedido.result as Record<string, unknown>)
      : {};
  const notaDoAdmin = corpo.nota ? corpo.nota : null;

  const mudanca = entrega
    ? {
        status: "completed",
        // O worker parou em `no_delivery_email`; concluído, o pedido não exibe erro
        // (o mesmo que o worker faz ao concluir pelo e-mail).
        error_message: null,
        completed_at: agora,
        updated_at: agora,
        result: { ...resultAtual, entrega_manual: { nota: notaDoAdmin, por: authUser.id, em: agora } },
      }
    : {
        status: "failed",
        error_message: ENCERRADO_PELO_RESPONSAVEL,
        completed_at: agora,
        updated_at: agora,
        result: {
          ...resultAtual,
          encerramento: {
            motivo_codigo: corpo.acao === "encerrado" ? corpo.motivo_codigo : null,
            nota: notaDoAdmin,
            por: authUser.id,
            em: agora,
          },
        },
      };

  const { data: afetadas, error: updateErr } = await admin
    .from("lgpd_requests")
    .update(mudanca)
    .eq("organization_id", orgId)
    .eq("id", id)
    .eq("status", estadoEsperado)
    .select("id");
  if (updateErr) {
    logger.error("[lgpd-encerrar] gravação falhou", { requestId, organizationId: orgId });
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }
  if (!afetadas || afetadas.length === 0) {
    // Outra chamada mudou o estado entre a leitura e a gravação.
    return fail(
      "conflict",
      entrega
        ? t("Só um pedido em revisão pendente pode ser marcado como entregue.")
        : t("Só um pedido recebido, antes da aprovação, pode ser encerrado."),
      409,
      { requestId },
    );
  }

  void audit({
    action: entrega ? "lgpd.export_delivered" : "lgpd.request_closed",
    actorUserId: authUser.id,
    organizationId: orgId,
    resourceType: "lgpd_request",
    resourceId: id,
    requestId,
    metadata: entrega
      ? { delivery: "manual", request_id: id }
      : {
          motivo_codigo: corpo.acao === "encerrado" ? corpo.motivo_codigo : null,
          request_id: id,
        },
  });

  // Não lança: o pedido já está fechado.
  await resolverAvisosDoPedido(admin, orgId, id);

  return ok(
    { request_id: id, status: entrega ? "completed" : "failed" },
    { requestId, status: 200 },
  );
}
