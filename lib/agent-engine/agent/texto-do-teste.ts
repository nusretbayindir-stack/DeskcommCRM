import { motivoDoVeto } from "./sugestao-de-resposta";

type Traduzir = (texto: string) => string;

/**
 * Textos da aba Teste no idioma do operador.
 *
 * `message` do veto é `verdict.reason`: texto de ENSINO para o modelo, em
 * português e fixado por `semantic.test.ts`. O operador vê o texto de
 * `motivoDoVeto` (o mesmo do painel de revisão), que tem tradução. Código
 * desconhecido mantém o `message`, que continua verdadeiro.
 */
export function textoDoImpedimento(
  impedimento: { code: string; message: string },
  t: Traduzir,
): string {
  const motivo = motivoDoVeto(impedimento.code);
  return motivo ? t(motivo.texto) : impedimento.message;
}

/**
 * O aviso do sandbox ("Em produção esta resposta não sairia agora (…)") em duas
 * partes traduzíveis. Sem `reason` (avisos que não vêm de um gate) devolve o
 * `message`. O motivo dinâmico de pacing (horário, limites) segue como o motor o
 * escreveu.
 */
export function textoDoAviso(
  aviso: { code: string; message: string; reason?: string },
  t: Traduzir,
): string {
  if (aviso.reason === undefined) return aviso.message;
  const motivo = motivoDoVeto(aviso.code);
  const detalhe = motivo ? t(motivo.texto) : aviso.reason;
  return (
    `${t("Em produção esta resposta não sairia agora")} (${detalhe}). ` +
    t("O teste mostra a resposta mesmo assim; nenhuma mensagem foi enviada.")
  );
}
