import { tagDeIdioma } from "@/lib/i18n/datas";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";

import type { AvisoDeContextoCaro } from "./agente-caro";

/**
 * A frase do aviso de contexto caro, depois do nome do agente, no idioma de
 * quem lê (S2a Task 7b, U41). Arquivo do fork.
 *
 * A tela montava "— 12% " + frase + " (5 de 40)." com o "de" do português e o
 * número no formato brasileiro para toda língua. Agora é uma chave com lacunas:
 * o turco põe o % antes ("%12") e conta com barra ("5/40"), o francês põe o
 * espaço antes do % ("12 %"), e os números saem no formato do idioma.
 * O português sai igual a antes.
 */
export function fraseDoContextoCaro(aviso: AvisoDeContextoCaro, idioma: Idioma): string {
  const numero = (n: number) => n.toLocaleString(tagDeIdioma(idioma));
  return preencher(
    traduzir(
      "{percentual}% das chamadas de turno passaram de 100 mil tokens de entrada nos últimos 30 dias ({acima} de {total}).",
      idioma,
    ),
    { percentual: aviso.percentual, acima: numero(aviso.acima_do_limite), total: numero(aviso.chamadas) },
  );
}
