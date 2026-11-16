/**
 * O DIREITO DE RECLAMAR — art. 12.º, n.º 4 do RGPD: quem não atende o pedido
 * do titular diz POR QUÊ e diz que ele pode reclamar à autoridade de controlo
 * ou ir aos tribunais.
 *
 * ─── Duas bocas, uma frase ──────────────────────────────────────────────────
 *
 * - A RECUSA PRONTA do painel do pedido (U53): o texto que a equipe manda pelo
 *   WhatsApp ao titular sem e-mail. Leva a frase em todo país de fora do Brasil
 *   cujo perfil tem autoridade.
 * - O E-MAIL DE RECUSA do art. 12.º (`avisos-do-artigo-12.ts`, U57). Leva a
 *   frase só nos países de `PAISES_COM_RECLAMACAO_NO_EMAIL` — decisão de produto
 *   de 2026-11-15, opção (b): o texto de Portugal (e o do Brasil, que nem chega
 *   ao aviso) fica como estava até a revisão do advogado.
 *
 * O painel monta a recusa pronta a partir do e-mail; onde o e-mail já traz a
 * frase, o painel não a repete (`reclamacaoVaiNoEmail`).
 *
 * ─── Sem autoridade no perfil, não há frase ─────────────────────────────────
 *
 * A autoridade vem do PERFIL DO PAÍS (`autoridadeDeSupervisao`), e nada é
 * inventado: país sem autoridade revisada não ganha linha. A Turquia está na
 * lista e ainda não tem perfil (M1); quando o perfil turco entrar com a
 * autoridade (Kişisel Verileri Koruma Kurulu), a frase sai sozinha.
 */
import type { Idioma } from "@/lib/i18n/idiomas";
import type { PerfilDoPais } from "@/lib/legal/perfil-do-pais";
import { autoridadeNoIdioma, documentoNoIdioma } from "@/lib/lgpd/idioma-do-documento";

const RECLAMACAO_COM_SITE =
  "Se não concordar com esta decisão, pode apresentar reclamação à {autoridade} ({site}) ou recorrer aos tribunais.";
const RECLAMACAO_SEM_SITE =
  "Se não concordar com esta decisão, pode apresentar reclamação à {autoridade} ou recorrer aos tribunais.";

/** Os países cujo e-mail de recusa traz a frase (U57, opção (b)). */
const PAISES_COM_RECLAMACAO_NO_EMAIL: ReadonlySet<string> = new Set(["BE", "TR"]);

/** A frase do direito de reclamar, no idioma do titular; sem autoridade no perfil, `null`. */
export function linhaDaReclamacao(perfil: PerfilDoPais, idioma: Idioma | undefined): string | null {
  if (!perfil.autoridadeDeSupervisao) return null;
  const autoridade = autoridadeNoIdioma(perfil.autoridadeDeSupervisao, idioma);
  const { t } = documentoNoIdioma(idioma, perfil.codigo);
  return autoridade.site
    ? t(RECLAMACAO_COM_SITE, { autoridade: autoridade.nome, site: autoridade.site })
    : t(RECLAMACAO_SEM_SITE, { autoridade: autoridade.nome });
}

/** O e-mail de recusa deste país traz a frase? Só na lista, e só com autoridade no perfil. */
export function reclamacaoVaiNoEmail(perfil: PerfilDoPais): boolean {
  return PAISES_COM_RECLAMACAO_NO_EMAIL.has(perfil.codigo) && Boolean(perfil.autoridadeDeSupervisao);
}

/** A frase para o e-mail de recusa, ou `null` fora da lista (ou sem autoridade). */
export function linhaDaReclamacaoNoEmail(perfil: PerfilDoPais, idioma: Idioma | undefined): string | null {
  return reclamacaoVaiNoEmail(perfil) ? linhaDaReclamacao(perfil, idioma) : null;
}
