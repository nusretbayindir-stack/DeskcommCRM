import type { Metadata } from "next";

import { loadAuthUser } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import type { Idioma } from "@/lib/i18n/idiomas";

/**
 * O TÍTULO DA ABA, NO IDIOMA DE QUEM ABRE A PÁGINA.
 *
 * `export const metadata = { title: "Funis" }` é uma constante: o Next a lê sem
 * saber quem pediu, e a aba ficava em português para todo mundo — "Funis ·
 * Agenterix" sob uma tela inteira em turco. O título passa a sair de
 * `generateMetadata`, com o idioma da MESMA cadeia da tela: quem tem sessão usa
 * `loadAuthUser().idioma` (perfil → organização ativa → padrão); quem não tem,
 * o `Accept-Language` (`idiomaDoVisitante`).
 *
 * `loadAuthUser` é `cache()` por requisição: a página e o layout que já o
 * chamam pagam uma consulta só.
 *
 * Server-only (`next/headers` por baixo): só página e layout importam isto.
 */
export async function idiomaDaRequisicao(): Promise<Idioma> {
  const usuario = await loadAuthUser();
  return usuario ? usuario.idioma : idiomaDoVisitante(null);
}

/** O `t` de quem abre a página, para o `generateMetadata` que monta mais que o título. */
export async function tradutorDaRequisicao(): Promise<(texto: string) => string> {
  const idioma = await idiomaDaRequisicao();
  return (texto) => traduzir(texto, idioma);
}

/**
 * O `generateMetadata` de uma página cujo título é uma frase fixa:
 *
 *   export const generateMetadata = tituloDaAba((t) => t("Funis"));
 *
 * O título vem como `t("…")` literal, e não como texto solto, de propósito: é
 * só literal dentro de `t()` que `tests/unit/i18n-espanhol-cobre-a-tela` cobra
 * e que `scripts/i18n/lotes-para-traduzir.ts` encontra.
 */
export function tituloDaAba(titulo: (t: (texto: string) => string) => string): () => Promise<Metadata> {
  return async () => ({ title: titulo(await tradutorDaRequisicao()) });
}
