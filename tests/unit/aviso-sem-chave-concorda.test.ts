import { describe, expect, it } from "vitest";

import {
  fraseModelosSemFerramentas,
  fraseSemChave,
  fraseSemListaDeModelos,
} from "@/app/onboarding/setup-ai/_form";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMAS } from "@/lib/i18n/idiomas";

/**
 * O AVISO "SEM CHAVE DE IA" NÃO DOBRA A PREPOSIÇÃO.
 *
 * O formulário montava a frase com `t("<prefixo>")` + `provedorLegivel()`, e
 * `provedorLegivel()` já começava com a preposição. Com o prefixo "Não achei
 * chave de", a tela dizia "Não achei chave de da Anthropic (Claude)" — e, em
 * espanhol, "No encontré ninguna clave de de la".
 *
 * Desde a v1.88.5 cada aviso é UMA chave com `{provedor}` e a preposição dentro
 * dela (em turco o "da" vira sufixo e muda de lugar). O que este teste guarda
 * continua o mesmo: a frase que sai, em todo idioma, para empresa nomeada e para
 * a "escolhida na instalação", não tem preposição dobrada.
 */

const FRASES = [fraseSemChave, fraseModelosSemFerramentas, fraseSemListaDeModelos];

describe("aviso de onboarding sem chave de IA", () => {
  it.each(IDIOMAS)("%s: nenhuma das três frases dobra a preposição", (idioma) => {
    const t = (texto: string) => traduzir(texto, idioma);
    for (const frase of FRASES) {
      for (const provedor of ["anthropic", null]) {
        expect(frase(provedor, t)).not.toMatch(/\b(de|da|do|del)\s+(de|da|do|del)\b/i);
      }
    }
  });
});
