import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

/**
 * As mensagens de documento que o perfil do país põe nos schemas
 * (`mensagemInvalido` em `lib/legal/perfil-do-pais.ts`). Cada uma entra em
 * `traduzir()` por LITERAL: o dicionário só recebe chave escrita no código,
 * nunca texto calculado (`tests/unit/i18n-espanhol-cobre-a-tela.test.ts`).
 */
function traduzirMensagem(mensagem: string, idioma: Idioma): string {
  switch (mensagem) {
    case "CPF inválido":
      return traduzir("CPF inválido", idioma);
    case "NIF inválido":
      return traduzir("NIF inválido", idioma);
    case "Número KBO/BCE inválido":
      return traduzir("Número KBO/BCE inválido", idioma);
    default:
      return mensagem;
  }
}

/**
 * Traduz as mensagens de `details.fieldErrors` (o que `validateRequest` devolve)
 * para o idioma de quem chamou. A mensagem nasce em português dentro do schema,
 * e sem este passo o texto chegava cru a quem usa a interface em outra língua.
 * Mensagem fora da lista passa como veio — nunca quebra a resposta.
 */
export function traduzirErrosDeCampo(details: unknown, idioma: Idioma): unknown {
  if (!details || typeof details !== "object" || idioma === "pt-BR") return details;
  const fe = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fe || typeof fe !== "object") return details;
  const traduzidos: Record<string, unknown> = {};
  for (const [campo, msgs] of Object.entries(fe as Record<string, unknown>)) {
    traduzidos[campo] = Array.isArray(msgs)
      ? msgs.map((m) => (typeof m === "string" ? traduzirMensagem(m, idioma) : m))
      : msgs;
  }
  return { ...(details as object), fieldErrors: traduzidos };
}
