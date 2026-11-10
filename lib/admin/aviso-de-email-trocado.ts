import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";

/**
 * O aviso da Central "e-mail de login trocado pelo administrador da
 * plataforma", no idioma de cada empresa (S2a Task 5, U14). Mora fora da rota
 * porque um `route.ts` do Next só exporta os verbos HTTP.
 *
 * Tabela de literais para a guarda de espanhol cobrar es e tr; o português é
 * o de sempre. O nome e a data entram crus (a data já vem formatada no
 * idioma e no fuso da empresa); sem nome, vale o nome de reserva traduzido.
 */
const TEXTOS_DO_AVISO = {
  titulo: "E-mail de login trocado pelo administrador da plataforma",
  corpo: "O e-mail de login de {nome} foi trocado pelo administrador da plataforma em {data}.",
  nomeDeReserva: "uma pessoa da equipe",
} as const;

export function avisoDeEmailTrocado(
  valores: { nome: string | null; data: string },
  idioma: Idioma,
): { title: string; body: string } {
  return {
    title: traduzir(TEXTOS_DO_AVISO.titulo, idioma),
    body: preencher(traduzir(TEXTOS_DO_AVISO.corpo, idioma), {
      nome: valores.nome ?? traduzir(TEXTOS_DO_AVISO.nomeDeReserva, idioma),
      data: valores.data,
    }),
  };
}
