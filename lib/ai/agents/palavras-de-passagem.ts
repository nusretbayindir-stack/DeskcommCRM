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
 *
 * Só o formulário lê daqui. Agente criado pela API, pelo MCP ou pelo caminho
 * legado ainda nasce com o default português do zod (`validation.ts`) e da
 * coluna — quem cria por lá manda `handoff_keywords` explícito.
 */
import type { Idioma } from "@/lib/i18n/idiomas";

const PALAVRAS_DE_PASSAGEM_PADRAO: Record<Idioma, readonly string[]> = {
  "pt-BR": ["falar com humano", "atendente", "pessoa real"],
  es: ["hablar con un humano", "hablar con una persona", "persona real"],
  // Só frases que JÁ são pedido. O substring não distingue o pedido do relato
  // e da recusa: "yetkiliyle" casaria "yetkiliyle görüştüm" e "yetkiliyle
  // görüşmek istemiyorum", "insanla" casaria "insanlar", "operatör" o operador
  // da escavadeira, "gerçek kişi" a pessoa física da fatura e "operatöre bağla"
  // o "operatöre bağlanamıyorum" do cliente sem internet. A frase inteira é o
  // exemplo que a tela mostra; o pedido turco em si a detecção determinística
  // (`HUMAN_HANDOFF_PATTERNS`) já reconhece, com as variações.
  tr: ["canlı destek", "gerçek bir insan", "yetkiliyle görüşmek istiyorum", "temsilciyle görüşmek istiyorum"],
};

export function palavrasDePassagemPadrao(idioma: Idioma): readonly string[] {
  return PALAVRAS_DE_PASSAGEM_PADRAO[idioma];
}
