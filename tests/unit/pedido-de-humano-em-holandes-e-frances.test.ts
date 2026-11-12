/**
 * O PEDIDO DE HUMANO EM HOLANDÊS E FRANCÊS (Bélgica).
 *
 * A mesma régua de `HUMAN_HANDOFF_PATTERNS` para o português e o turco: verbo
 * de contato no modo de PEDIDO (infinitivo, imperativo, pergunta) + alvo
 * humano. O relato ("ik heb met een medewerker gesproken", "j'ai parlé à un
 * conseiller") não pede ninguém, e o "conseiller fiscal" é o contador do
 * cliente, não a equipe.
 *
 * Cada frase é medida contra as TRÊS funções: pedir uma pessoa não é pedir
 * para sair, e nenhuma destas pode bloquear nem escalar como opt-out.
 */
import { describe, expect, it } from "vitest";

import { detectHumanHandoffRequest } from "@/lib/agent-engine/agent/human-handoff";
import { ehOptOutProvavel, ehPedidoDeOptOut } from "@/lib/opt-out/deteccao";

const PEDE_HUMANO = [
  // holandês
  "ik wil met een medewerker spreken",
  "kan ik met iemand spreken?",
  "verbind me door met een medewerker",
  "ik wil een echte persoon",
  // francês
  "je veux parler à un conseiller",
  "puis-je parler à quelqu'un ?",
  "passez-moi un conseiller",
  "je veux parler à une vraie personne",
];

const NAO_PEDE_HUMANO = [
  // holandês
  "ik heb met een medewerker gesproken",
  "een medewerker heeft me gebeld",
  // francês
  "j'ai parlé à un conseiller",
  "votre conseiller m'a appelé",
  "je cherche un conseiller fiscal",
];

describe("holandês e francês — o pedido de humano", () => {
  for (const texto of PEDE_HUMANO) {
    it(`pede humano: ${texto}`, () => {
      expect(detectHumanHandoffRequest(texto)).toBe(true);
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(false);
    });
  }

  for (const texto of NAO_PEDE_HUMANO) {
    it(`não pede humano: ${texto}`, () => {
      expect(detectHumanHandoffRequest(texto)).toBe(false);
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(false);
    });
  }
});
