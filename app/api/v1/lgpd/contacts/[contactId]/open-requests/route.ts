/**
 * GET /api/v1/lgpd/contacts/[contactId]/open-requests (U53)
 *
 * O que o cartão "Pedido do titular" da página do contato lê: os pedidos
 * abertos do contato (só tipo, situação e prazo) e quais canais o cadastro
 * permite. Role >= agent. Nunca devolve e-mail, telefone nem o payload.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { canaisDoContato } from "@/lib/lgpd/pedido-manual";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", {
    requestId,
    resource: "lgpd_requests",
    allowPlatformAdmin: "leitura",
    permiteOrgSuspensa: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const orgId = authz.org.orgId;

  const { contactId } = await params;
  const admin = createAdminClient();

  const { data: contato, error: contatoErr } = await admin
    .from("contacts")
    .select("id, email, phone_number, wa_lid")
    .eq("organization_id", orgId)
    .eq("id", contactId)
    .maybeSingle();
  if (contatoErr) {
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }
  if (!contato) {
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  }

  const { data: pedidos, error: pedidosErr } = await admin
    .from("lgpd_requests")
    .select("request_type, status, due_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .in("status", ["received", "processing", "pending_review"])
    .order("due_at", { ascending: true });
  if (pedidosErr) {
    return fail("internal_error", t("Erro interno. Tente de novo em instantes."), 500, { requestId });
  }

  return ok(
    {
      pedidos: (pedidos ?? []).map((p) => ({
        request_type: p.request_type,
        status: p.status,
        due_at: p.due_at,
      })),
      canais: canaisDoContato(contato),
    },
    { requestId },
  );
}
