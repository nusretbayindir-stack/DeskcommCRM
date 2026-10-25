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
 * Lê daqui o formulário e as cinco entradas que não passam por ele: a rota de
 * versões, a ação do MCP, o criador de rascunho canônico (`create-draft.ts`), o
 * `POST /ai/agents` e o agente da Prospecção. Elas usam o idioma da
 * ORGANIZAÇÃO, e só quando o corpo NÃO trouxe a chave: o
 * default do zod (`validation.ts`) e o da coluna continuam em português, e
 * quem manda `handoff_keywords` (até `[]`) é obedecido como mandou.
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

/**
 * O corpo CRU (antes do zod) trouxe `handoff_keywords`? O zod preenche o que
 * falta com o default português, então depois do `parse` já não dá para
 * distinguir "não mandou" de "mandou isto". `[]` explícito é uma escolha.
 */
export function enviouPalavrasDePassagem(versaoBruta: unknown): boolean {
  return (
    typeof versaoBruta === "object" &&
    versaoBruta !== null &&
    (versaoBruta as { handoff_keywords?: unknown }).handoff_keywords !== undefined
  );
}
