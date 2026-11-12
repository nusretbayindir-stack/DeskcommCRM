/**
 * O IDIOMA DE QUEM ESCREVEU — só quando há certeza (S2a, Task 9).
 *
 * As frases são as do plano. O lado `null` é tão obrigatório quanto o outro:
 * um idioma gravado por engano só sai pela mão de alguém da equipe, e "Merci"
 * ou "OK" não podem decidir a língua de ninguém.
 */
import { describe, expect, it } from "vitest";

import { algilarIdioma } from "@/lib/i18n/algila-idioma";

const CASOS: ReadonlyArray<[string, "nl" | "fr" | "tr"]> = [
  ["Goedemorgen, ik wil graag een afspraak maken", "nl"],
  ["Hoeveel kost dat voor mijn wagen?", "nl"],
  ["Dank u wel", "nl"],
  ["Bonjour, ik wil een afspraak", "nl"],
  ["Bonjour, je voudrais un rendez-vous", "fr"],
  ["Merci beaucoup pour votre aide", "fr"],
  ["Combien ça coûte s'il vous plaît ?", "fr"],
  ["Merhaba, randevu almak istiyorum", "tr"],
  ["Fiyat ne kadar acaba", "tr"],
  ["Teşekkür ederim", "tr"],
];

const SEM_CERTEZA = [
  "OK",
  "Merci",
  "Merci voor de info",
  "Bonjour",
  "Hallo",
  "Goedemorgen",
  "Merhaba",
  "Stop",
  "Thanks",
  "Hello, I want an appointment",
  "Bom dia, quero marcar uma consulta para amanhã",
  "Quiero una cita para mañana",
  "https://example.com",
  "12345",
  "",
];

describe("algilarIdioma", () => {
  for (const [texto, idioma] of CASOS) {
    it(`${idioma}: ${texto}`, () => {
      expect(algilarIdioma(texto)).toBe(idioma);
    });
  }

  for (const texto of SEM_CERTEZA) {
    it(`null: ${JSON.stringify(texto)}`, () => {
      expect(algilarIdioma(texto)).toBeNull();
    });
  }

  it("null e undefined não decidem nada", () => {
    expect(algilarIdioma(null)).toBeNull();
    expect(algilarIdioma(undefined)).toBeNull();
  });
});
