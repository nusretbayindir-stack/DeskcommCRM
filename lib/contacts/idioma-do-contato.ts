/**
 * O idioma da mensagem fixa para um CONTATO, numa ida só ao banco: o
 * `contacts.locale` dele ou, quando vazio ou não servido, o da organização
 * (`idiomaDoDestinatario`).
 *
 * O mesmo desenho de `lib/ai/agents/idioma-da-org.ts`: nunca lança. Idioma é
 * enfeite perto de a mensagem sair; uma leitura que falhe vira log e o padrão
 * do produto.
 *
 * A consulta parte da ORGANIZAÇÃO e traz o contato junto, filtrado pela
 * própria organização: um contato de outra empresa nunca empresta o idioma,
 * e um contato que não existe ainda deixa o idioma da empresa valer.
 */
import type pg from "pg";

import { idiomaDoDestinatario } from "@/lib/i18n/idioma-do-destinatario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";
import { logger } from "@/lib/logger";

type LeitorSupabase = {
  from(tabela: string): {
    select(colunas: string): {
      eq(coluna: string, valor: string): {
        eq(coluna: string, valor: string): {
          maybeSingle(): PromiseLike<{ data: unknown; error?: { message?: string } | null }>;
        };
      };
    };
  };
};

function avisarLeituraFalha(onde: string, motivo: unknown): void {
  logger.warn("[idioma-do-contato] leitura do idioma falhou; usando o padrão", {
    onde,
    detail: (motivo instanceof Error ? motivo.message : String(motivo)).slice(0, 160),
  });
}

export async function idiomaDoContatoPeloSupabase(
  admin: unknown,
  orgId: string,
  contactId: string,
): Promise<Idioma> {
  try {
    const { data, error } = await (admin as LeitorSupabase)
      .from("organizations")
      .select("locale, contacts!contacts_organization_id_fkey(locale)")
      .eq("id", orgId)
      .eq("contacts.id", contactId)
      .maybeSingle();
    if (error) {
      avisarLeituraFalha("supabase", error.message ?? error);
      return IDIOMA_PADRAO;
    }
    const linha = data as { locale?: string | null; contacts?: Array<{ locale?: string | null }> | null } | null;
    return idiomaDoDestinatario(linha?.contacts?.[0]?.locale ?? null, linha?.locale ?? null);
  } catch (err) {
    avisarLeituraFalha("supabase", err);
    return IDIOMA_PADRAO;
  }
}

export async function idiomaDoContatoPeloPg(
  db: Pick<pg.PoolClient, "query">,
  orgId: string,
  contactId: string,
): Promise<Idioma> {
  try {
    const { rows } = await db.query<{ contato: string | null; org: string | null }>(
      `select c.locale as contato, o.locale as org
         from organizations o
         left join contacts c on c.organization_id = o.id and c.id = $2
        where o.id = $1`,
      [orgId, contactId],
    );
    return idiomaDoDestinatario(rows?.[0]?.contato ?? null, rows?.[0]?.org ?? null);
  } catch (err) {
    avisarLeituraFalha("pg", err);
    return IDIOMA_PADRAO;
  }
}
