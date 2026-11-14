/**
 * U51 — guardar na conta as pistas do cadastro pelo Google, no modo
 * `com_aprovacao`.
 *
 * No cadastro aberto, a volta do Google entrega o idioma da tela e o fuso do
 * navegador (que vieram na URL, `urlDeRetornoDoGoogle`) e o `Accept-Language`
 * direto ao provisionamento. No com aprovação a empresa só nasce depois, na
 * aprovação do administrador (`app/actions/registration/decide.ts`), que lê a
 * CONTA: sem guardar aqui, as pistas se perdiam e a empresa nascia pt-BR / BRL.
 *
 * Mesmas chaves e mesma régua do `signUp`; nunca sobrescreve pista que a conta
 * já tem (quem se cadastrou por e-mail e depois entrou pelo Google mantém a do
 * cadastro). Falhar ao guardar não tranca ninguém: o pedido segue, e a empresa
 * nasce como nascia antes.
 */
import {
  acceptLanguageParaGuardar,
  CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO,
  CHAVE_FUSO_DO_CADASTRO,
  CHAVE_IDIOMA_DO_CADASTRO,
  pistasParaGuardar,
} from "@/lib/auth/perfil-da-empresa-nova";
import { invalidarUsuario } from "@/lib/auth/cache-curto";
import { logger } from "@/lib/logger";

/** As pistas saneadas que a conta ainda não tem, nas chaves do cadastro. */
export function pistasQueFaltamNaConta(
  metadata: Record<string, unknown> | null | undefined,
  bruto: { idioma?: unknown; fuso?: unknown; acceptLanguage?: unknown },
): Record<string, string> {
  const meta = metadata ?? {};
  const limpas = pistasParaGuardar({ idioma: bruto.idioma, fuso: bruto.fuso });
  const cabecalho = acceptLanguageParaGuardar(bruto.acceptLanguage);
  const faltam: Record<string, string> = {};
  if (limpas.idioma && meta[CHAVE_IDIOMA_DO_CADASTRO] === undefined) faltam[CHAVE_IDIOMA_DO_CADASTRO] = limpas.idioma;
  if (limpas.fuso && meta[CHAVE_FUSO_DO_CADASTRO] === undefined) faltam[CHAVE_FUSO_DO_CADASTRO] = limpas.fuso;
  if (cabecalho && meta[CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO] === undefined) {
    faltam[CHAVE_ACCEPT_LANGUAGE_DO_CADASTRO] = cabecalho;
  }
  return faltam;
}

/** Grava as pistas que faltam pela sessão da própria pessoa. Nunca lança. */
export async function guardarPistasNaConta(
  supabase: { auth: { updateUser: (a: { data: Record<string, string> }) => Promise<{ error: unknown }> } },
  usuario: { id: string; user_metadata?: Record<string, unknown> | null },
  bruto: { idioma?: unknown; fuso?: unknown; acceptLanguage?: unknown },
): Promise<void> {
  const faltam = pistasQueFaltamNaConta(usuario.user_metadata, bruto);
  if (Object.keys(faltam).length === 0) return;
  try {
    const { error } = await supabase.auth.updateUser({ data: faltam });
    invalidarUsuario(usuario.id); // #3696: o metadata da sessão vai para o cache curto
    if (error) throw error;
  } catch (e) {
    logger.warn("cadastro.pistas_nao_guardadas", {
      userId: usuario.id,
      motivo: e instanceof Error ? e.message.slice(0, 200) : "desconhecido",
    });
  }
}
