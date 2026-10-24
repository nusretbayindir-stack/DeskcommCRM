/**
 * As palavras que chamam uma pessoa num agente NOVO, no idioma de quem o cria.
 *
 * São palavras do CLIENTE, não da tela: casam por substring com o que ele
 * escreve (`matchesHandoffKeyword`). Um cliente turco nunca escreve "falar com
 * humano", e o agente turco nascia com isso e só isso. O idioma da tela é a
 * aposta de qual idioma o cliente fala — a mesma do prompt padrão do agente.
 *
 * `Record<Idioma, …>`: idioma novo promovido no registro obriga a escolher as
 * palavras aqui. A detecção determinística (`HUMAN_HANDOFF_PATTERNS`) roda de
 * qualquer jeito; estas somam a ela.
 */
import type { Idioma } from "@/lib/i18n/idiomas";

const PALAVRAS_DE_PASSAGEM_PADRAO: Record<Idioma, readonly string[]> = {
  "pt-BR": ["falar com humano", "atendente", "pessoa real"],
  es: ["hablar con un humano", "hablar con una persona", "persona real"],
  // Radicais com o alvo humano já no comitativo: `yetkili` sozinho casaria
  // "yetkili servis" (a assistência técnica autorizada).
  tr: ["yetkiliyle", "yetkili biri", "temsilciyle", "insanla", "gerçek kişi", "canlı destek", "operatör"],
};

export function palavrasDePassagemPadrao(idioma: Idioma): readonly string[] {
  return PALAVRAS_DE_PASSAGEM_PADRAO[idioma];
}
