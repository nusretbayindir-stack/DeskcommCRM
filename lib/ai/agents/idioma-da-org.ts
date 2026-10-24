/**
 * O idioma da ORGANIZAÇÃO, para quem cria um agente fora da tela do editor.
 *
 * A tela sabe o idioma de quem a abriu; a API por Bearer, o MCP e o worker de
 * Prospecção não têm sessão nenhuma. O agente é dado da empresa (todo mundo
 * dela vê as mesmas palavras de passagem), então quem decide é
 * `organizations.locale`.
 *
 * Nunca lança: idioma é enfeite perto de criar o agente, e um `select` que
 * falhe não pode impedir a criação. O fallback é o idioma do produto, que é o
 * default que o agente já tinha.
 */
import type pg from "pg";

import { IDIOMA_PADRAO, normalizarIdioma, type Idioma } from "@/lib/i18n/idiomas";
import { createAdminClient } from "@/lib/supabase/admin";

type LeitorSupabase = {
  from(tabela: string): {
    select(colunas: string): {
      eq(coluna: string, valor: string): {
        maybeSingle(): PromiseLike<{ data: unknown }>;
      };
    };
  };
};

export async function idiomaDaOrgPeloSupabase(admin: unknown, orgId: string): Promise<Idioma> {
  try {
    const { data } = await (admin as LeitorSupabase)
      .from("organizations")
      .select("locale")
      .eq("id", orgId)
      .maybeSingle();
    return normalizarIdioma((data as { locale?: string | null } | null)?.locale ?? null);
  } catch {
    return IDIOMA_PADRAO;
  }
}

export async function idiomaDaOrgPeloPg(
  db: Pick<pg.PoolClient, "query">,
  orgId: string,
): Promise<Idioma> {
  try {
    const { rows } = await db.query<{ locale: string | null }>(
      "select locale from organizations where id = $1",
      [orgId],
    );
    return normalizarIdioma(rows?.[0]?.locale ?? null);
  } catch {
    return IDIOMA_PADRAO;
  }
}

/**
 * O idioma E o fuso da organização, numa ida só ao banco, para o e-mail que
 * sai em nome dela (o convite de time).
 *
 * Nunca lança, nem quando o cliente de serviço não está configurado: o convite
 * não pode deixar de sair por causa de idioma. Sem resposta, vale o idioma do
 * produto e nenhum fuso (quem usa cai em `FUSO_PADRAO`).
 */
export async function idiomaEFusoDaOrg(
  orgId: string,
): Promise<{ idioma: Idioma; fuso: string | null }> {
  try {
    const { data } = await (createAdminClient() as unknown as LeitorSupabase)
      .from("organizations")
      .select("locale, timezone")
      .eq("id", orgId)
      .maybeSingle();
    const linha = data as { locale?: string | null; timezone?: string | null } | null;
    return { idioma: normalizarIdioma(linha?.locale ?? null), fuso: linha?.timezone || null };
  } catch {
    return { idioma: IDIOMA_PADRAO, fuso: null };
  }
}
