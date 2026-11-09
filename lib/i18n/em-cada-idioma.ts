/**
 * O texto em todo idioma visível, para o SQL escolher pelo idioma da empresa.
 *
 * Para o aviso da Central que nasce no MESMO statement que decide gravá-lo (o job
 * que morre e o alerta dele, atômicos): ali a empresa só é conhecida dentro do
 * SQL, então não há onde ler o idioma antes. O texto vai num jsonb em todo idioma
 * visível, e `noIdiomaDaOrgSql` escolhe pelo `organizations.locale` da linha — o
 * mesmo resultado de `normalizarIdioma`: o código exato, senão o padrão.
 *
 * Recebe uma função, e não o texto, para a frase continuar escrita dentro de um
 * `traduzir("…", idioma)`: é assim que `i18n-espanhol-cobre-a-tela` a encontra e
 * cobra a tradução de cada idioma.
 *
 * Quem pode ler o idioma antes de gravar usa `idiomaDaOrgPeloPg` /
 * `idiomaDaOrgPeloSupabase` e `traduzir` (o padrão de `lib/leads/reactivation.ts`).
 */
import { IDIOMA_PADRAO, IDIOMAS, type Idioma } from "./idiomas";

export function emCadaIdioma(texto: (idioma: Idioma) => string): Record<Idioma, string> {
  return Object.fromEntries(IDIOMAS.map((idioma) => [idioma, texto(idioma)])) as Record<Idioma, string>;
}

/** `coalesce(<param>::jsonb ->> <locale>, <param>::jsonb ->> '<padrão>')`, com `<param>` vindo de `emCadaIdioma`. */
export function noIdiomaDaOrgSql(parametro: string, expressaoDoLocale: string): string {
  return `coalesce(${parametro}::jsonb ->> ${expressaoDoLocale}, ${parametro}::jsonb ->> '${IDIOMA_PADRAO}')`;
}
