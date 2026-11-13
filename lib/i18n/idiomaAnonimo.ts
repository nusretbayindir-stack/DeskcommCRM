import { headers } from "next/headers";

import {
  IDIOMA_PADRAO,
  idiomaDoTexto,
  normalizarIdioma,
  parseAcceptLanguage,
  type Idioma,
} from "@/lib/i18n/idiomas";
import { valorDaInstalacao } from "@/lib/instalacao/config";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";

/**
 * O idioma de quem ainda não tem sessão (ou cujo perfil não tem `locale`
 * salvo) — as telas públicas (login, signup, convite, legal) ficam fora de
 * `app/app/layout.tsx`: sem `IdiomaProvider`, sem membership, sem
 * organização de quem consultar.
 *
 * Cadeia: preferência salva → `Accept-Language` do navegador → idioma do país
 * da instalação → padrão pt-BR. O header é só um SINAL de primeira visita,
 * nunca sobrepõe uma preferência já salva — inclusive um valor antigo
 * desconhecido nela (esse caso já degrada pro padrão dentro de
 * `normalizarIdioma`, e é um problema diferente do que este arquivo resolve:
 * visitante que NUNCA teve conta).
 *
 * Server-only de propósito (`next/headers`): `lib/i18n/idiomas.ts` continua
 * puro porque componente cliente (`SeletorDeIdioma.tsx`) o importa.
 */
export async function idiomaDoVisitante(
  localeBruto: string | null | undefined,
): Promise<Idioma> {
  if (localeBruto) return normalizarIdioma(localeBruto);
  const hdrs = await headers();
  return parseAcceptLanguage(hdrs.get("accept-language")) ?? (await idiomaDoPaisDaInstalacao());
}

/**
 * O último recurso antes do padrão: a língua do país onde a instalação opera
 * (S2a, decisão D6). Numa instalação belga, quem chega com o navegador em
 * inglês — ou sem cabeçalho nenhum — vê holandês, e não português, que ninguém
 * ali lê.
 *
 * Vem do PERFIL do país (`perfilDoPais(...).idioma`, a mesma fonte que já
 * decide a língua legal), e não de um `if (BE)`: Brasil e Portugal seguem em
 * pt-BR (`pt-PT` degrada para o português servido em `idiomaDoTexto`), e um
 * país novo traz a sua língua junto com o perfil.
 *
 * Só é lido quando o navegador não casou: o login é a tela mais aberta do
 * produto, e uma leitura de configuração por visita que não muda a resposta é
 * custo sem retorno. `valorDaInstalacao` já degrada sozinha quando o banco
 * falha (cai no `.env`); o `catch` é a rede para o que sobra — uma tela de
 * login nunca quebra por causa do idioma.
 */
async function idiomaDoPaisDaInstalacao(): Promise<Idioma> {
  try {
    const { valor } = await valorDaInstalacao("PAIS_DA_INSTALACAO");
    return idiomaDoTexto(perfilDoPais(valor).idioma);
  } catch (erro) {
    console.warn(
      "[i18n/idiomaAnonimo] país da instalação ilegível — usando o idioma padrão.",
      erro instanceof Error ? erro.message : String(erro),
    );
    return IDIOMA_PADRAO;
  }
}
