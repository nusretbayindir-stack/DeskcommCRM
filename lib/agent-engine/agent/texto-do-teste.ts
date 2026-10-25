import type { Idioma } from "@/lib/i18n/idiomas";

import { motivoDoVeto } from "./sugestao-de-resposta";

type Traduzir = (texto: string) => string;

/**
 * Aviso da prévia (não bloqueia o teste). `reason` é o motivo cru do gate e
 * `produto` o código citado por `midia_sem_fotos`: vão à parte do `message` para
 * a tela traduzir o texto. `message` segue como o motor o escreveu.
 */
export type AvisoDoTeste = { code: string; message: string; reason?: string; produto?: string };

/**
 * Códigos de pacing (`decidePacing`): o `reason` do motor é texto dinâmico em
 * português (janela, fuso, data). Na aba Teste vale o texto fixo, sem números.
 * Literais em cada ramo: `t()` não aceita chave montada em variável.
 */
function motivoDePacing(code: string, t: Traduzir): string | null {
  switch (code) {
    case "outside_window":
      return t(
        "Fora da janela de envio permitida: a resposta ficaria agendada para a próxima abertura da janela.",
      );
    case "warmup_cap":
      return t(
        "Este número ainda está em aquecimento e o limite diário de envios foi atingido. A resposta sairia amanhã.",
      );
    case "daily_cap":
      return t("O limite diário de envios do número foi atingido. A resposta sairia amanhã.");
    default:
      return null;
  }
}

/**
 * Textos da aba Teste no idioma do operador.
 *
 * `message` do veto é `verdict.reason`: texto de ENSINO para o modelo, em
 * português e fixado por `semantic.test.ts`. O operador vê o texto de
 * `motivoDoVeto` (o mesmo do painel de revisão), que tem tradução. Código
 * desconhecido mantém o `message`, que continua verdadeiro.
 *
 * Em pt-BR o `message` já está no idioma de quem olha e traz o detalhe (a frase
 * suspeita citada): fica como o motor o escreveu.
 */
export function textoDoImpedimento(
  impedimento: { code: string; message: string },
  t: Traduzir,
  idioma?: Idioma,
): string {
  if (idioma === "pt-BR") return impedimento.message;
  const motivo = motivoDoVeto(impedimento.code);
  return motivo ? t(motivo.texto) : impedimento.message;
}

/**
 * O aviso do sandbox ("Em produção esta resposta não sairia agora (…)") em duas
 * partes traduzíveis. Motivo: `motivoDoVeto`, depois o texto fixo de pacing e,
 * por último (código novo), o `reason` do motor. Sem `reason` devolve o
 * `message`, salvo `midia_sem_fotos`, que é montado a partir do produto.
 *
 * Em pt-BR vale o `message` do motor, com o detalhe (janela de envio, fuso).
 */
export function textoDoAviso(aviso: AvisoDoTeste, t: Traduzir, idioma?: Idioma): string {
  if (idioma === "pt-BR") return aviso.message;
  if (aviso.code === "midia_sem_fotos" && aviso.produto !== undefined)
    return t(
      "O produto {codigo} não tem fotos cadastradas: nenhuma imagem seria enviada no envio real, só o texto.",
    ).replace("{codigo}", aviso.produto);
  if (aviso.reason === undefined) return aviso.message;
  const motivo = motivoDoVeto(aviso.code);
  const detalhe = motivo ? t(motivo.texto) : (motivoDePacing(aviso.code, t) ?? aviso.reason);
  return (
    `${t("Em produção esta resposta não sairia agora")} (${detalhe}). ` +
    t("O teste mostra a resposta mesmo assim; nenhuma mensagem foi enviada.")
  );
}
