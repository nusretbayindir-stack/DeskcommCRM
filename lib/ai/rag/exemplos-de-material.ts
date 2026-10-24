/**
 * OS EXEMPLOS DO CAMPO DE CONTEÚDO, NO IDIOMA DE QUEM OLHA.
 *
 * O de FAQ usa os marcadores do idioma (`marcadores-de-faq.ts`, a mesma lista
 * que o leitor `faq.ts` casa), então o exemplo ensina um formato que o leitor
 * aceita. O de documento é prosa livre, escrita no idioma. Em pt-BR o texto é o
 * de sempre, letra por letra.
 *
 * Fica aqui, e não no diálogo, para o teste conferir que cada exemplo passa
 * pelo leitor de verdade.
 */
import { marcadoresDaTela } from "@/lib/ai/rag/ingest/marcadores-de-faq";
import type { Idioma } from "@/lib/i18n/idiomas";

interface TextoDoExemplo {
  perguntas: readonly [string, string];
  respostas: readonly [string, string];
  documento: string;
}

const TEXTOS: Record<Idioma, TextoDoExemplo> = {
  "pt-BR": {
    perguntas: ["Qual o prazo de entrega?", "Vocês fazem troca?"],
    respostas: [
      "De 2 a 3 dias úteis após a confirmação do pagamento.",
      "Sim, em até 30 dias, com o produto sem uso.",
    ],
    documento: `# Política de troca

Aceitamos troca em até 30 dias da entrega, com o produto sem uso e na embalagem
original. O frete de devolução é por nossa conta quando o defeito for de fábrica.`,
  },
  es: {
    perguntas: ["¿Cuál es el plazo de entrega?", "¿Hacen cambios?"],
    respostas: [
      "De 2 a 3 días hábiles después de la confirmación del pago.",
      "Sí, hasta 30 días, con el producto sin usar.",
    ],
    documento: `# Política de cambios

Aceptamos cambios hasta 30 días después de la entrega, con el producto sin usar y en su
embalaje original. El envío de la devolución corre por nuestra cuenta cuando el defecto sea de fábrica.`,
  },
  tr: {
    perguntas: ["Teslimat süresi nedir?", "Değişim yapıyor musunuz?"],
    respostas: [
      "Ödemenin onaylanmasından sonra 2 ila 3 iş günüdür.",
      "Evet, ürün kullanılmamış olmak şartıyla 30 gün içinde değişim yapıyoruz.",
    ],
    documento: `# Değişim politikası

Teslimattan sonraki 30 gün içinde, ürün kullanılmamış ve orijinal ambalajında ise değişim kabul ediyoruz.
Kusur üretimden kaynaklanıyorsa iade kargo ücretini biz karşılıyoruz.`,
  },
};

export function exemploDeFaq(idioma: Idioma): string {
  const { pergunta, resposta } = marcadoresDaTela(idioma);
  const { perguntas, respostas } = TEXTOS[idioma];
  return [0, 1]
    .map((i) => `${pergunta} ${perguntas[i]}\n${resposta} ${respostas[i]}`)
    .join("\n\n");
}

export function exemploDeDocumento(idioma: Idioma): string {
  return TEXTOS[idioma].documento;
}
