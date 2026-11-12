/**
 * Em que língua vai a mensagem fixa para o CLIENTE: a dele, se é uma língua que
 * o produto serve; senão, a da empresa (D4 do S2a).
 *
 * Um `contacts.locale` que não é visível (`en`, `pt-PT`, ou um idioma ainda em
 * construção) NÃO vira o padrão do produto: cai no idioma da organização. Quem
 * escreve à empresa belga não pode receber português só porque o campo tem um
 * valor que não servimos.
 */
import { IDIOMAS, normalizarIdioma, type Idioma } from "@/lib/i18n/idiomas";

export function idiomaDoDestinatario(
  localeDoContato: string | null | undefined,
  localeDaOrg: string | null | undefined,
): Idioma {
  if (localeDoContato && (IDIOMAS as readonly string[]).includes(localeDoContato)) {
    return localeDoContato as Idioma;
  }
  return normalizarIdioma(localeDaOrg);
}
