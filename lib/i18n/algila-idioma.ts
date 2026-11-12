/**
 * O IDIOMA DE QUEM ESCREVEU, só quando há certeza.
 *
 * Serve a UMA decisão: preencher `contacts.locale` quando ele está vazio, para
 * que a mensagem fixa que vai ao cliente (confirmação, lembrete, aviso) saia na
 * língua dele e não na da empresa. Errar aqui é pior que não saber: um idioma
 * errado gravado só sai pela mão de alguém da equipe, enquanto um `null` deixa
 * a empresa decidir. Por isso a regra é conservadora — "OK", "Merci", "Bonjour"
 * ou "Merci voor de info" não dizem nada e devolvem `null`.
 *
 * Pura e sem dependência: nenhuma biblioteca nova, nenhum custo de IA. Cobre
 * só `nl`, `fr` e `tr`, as línguas de quem atende na Bélgica; as outras ficam
 * com o idioma da empresa.
 *
 * ─── O método ───────────────────────────────────────────────────────────────
 *
 *   - minúsculas, acentos mantidos; quebra em tudo que não é letra (o apóstrofo
 *     também quebra: "j'aimerais" → `j`, `aimerais`);
 *   - cada palavra DISTINTA da lista de um idioma vale 1 ponto;
 *   - `ş`, `ğ` ou `ı` no texto valem +2 para o turco;
 *   - saudação e agradecimento sozinhos não contam (não estão nas listas);
 *   - decide só quando o primeiro tem pelo menos 2 pontos E pelo menos 2 a
 *     mais que o segundo. Senão, `null`.
 */

export type IdiomaAlgilado = "nl" | "fr" | "tr";

const PALAVRAS: Readonly<Record<IdiomaAlgilado, ReadonlySet<string>>> = {
  nl: new Set([
    "ik", "een", "het", "niet", "met", "voor", "graag", "dank", "bedankt", "wil", "kan", "mijn",
    "afspraak", "hoeveel", "hebben", "jullie", "zijn", "wanneer", "waar", "ook", "nog", "maar",
    "naar", "wat", "kost", "wagen", "wel", "u",
  ]),
  fr: new Set([
    "je", "vous", "pour", "avec", "est", "une", "des", "les", "pas", "voudrais", "souhaite",
    "combien", "rendez", "nous", "votre", "mon", "sur", "dans", "aussi", "quand", "beaucoup", "plaît",
  ]),
  tr: new Set([
    "istiyorum", "randevu", "fiyat", "kadar", "ederim", "nasil", "nasıl", "icin", "için", "lutfen",
    "lütfen", "tesekkur", "teşekkür", "almak", "acaba", "var", "mi",
  ]),
};

const LETRAS_TURCAS = /[şğı]/u;

export function algilarIdioma(texto: string | null | undefined): IdiomaAlgilado | null {
  if (!texto) return null;
  const minusculo = texto.toLowerCase();
  const palavras = new Set(minusculo.split(/[^\p{L}]+/u).filter((p) => p !== ""));

  const pontos: Record<IdiomaAlgilado, number> = { nl: 0, fr: 0, tr: 0 };
  for (const palavra of palavras) {
    for (const idioma of Object.keys(PALAVRAS) as IdiomaAlgilado[]) {
      if (PALAVRAS[idioma].has(palavra)) pontos[idioma] += 1;
    }
  }
  if (LETRAS_TURCAS.test(minusculo)) pontos.tr += 2;

  const ordenados = (Object.entries(pontos) as Array<[IdiomaAlgilado, number]>).sort((a, b) => b[1] - a[1]);
  const [primeiro, segundo] = ordenados;
  if (primeiro[1] >= 2 && primeiro[1] - segundo[1] >= 2) return primeiro[0];
  return null;
}
