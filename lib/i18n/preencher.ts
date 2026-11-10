/**
 * Troca cada `{nome}` de uma frase já traduzida pelo valor, numa passada só.
 *
 * Numa passada só porque o valor é dado de fora (nome de modelo, motivo do
 * banco): o que ele trouxer — `{outro}`, `$&` — entra como está, sem ser
 * substituído de novo nem lido como padrão do `replace`. Marca sem valor fica
 * como está.
 */
export function preencher(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (marca, nome: string) =>
    Object.prototype.hasOwnProperty.call(valores, nome) ? String(valores[nome]) : marca,
  );
}
