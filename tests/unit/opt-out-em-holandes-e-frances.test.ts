/**
 * O OPT-OUT EM HOLANDÊS E FRANCÊS (Bélgica), calibrado como o português, o
 * espanhol e o turco.
 *
 * Antes deste arquivo o detector não tinha uma palavra holandesa nem francesa:
 * só "STOP" bloqueava. "Stuur me geen berichten meer" e "ne m'envoyez plus de
 * messages" passavam em branco — e na Bélgica a ingestão (`pos-entrada.ts`) é a
 * ÚNICA rede que grava `is_blocked`.
 *
 * Os corpora seguem a régua de `lib/opt-out/deteccao.ts`:
 *   - BLOQUEIA: a palavra sozinha, ou verbo de cessação com OBJETO DE
 *     COMUNICAÇÃO (berichten, messages, de lijst, la liste);
 *   - ESCALA SEM BLOQUEAR: o sinal que pode ser outra coisa ("laat me met rust",
 *     "ça suffit" sozinho);
 *   - NADA: a fala comum — fatura, lista de espera, cancelar a consulta, parar
 *     de fumar.
 *
 * Cada frase é medida contra as TRÊS funções: as duas do opt-out e o pedido de
 * humano, que não pode disparar em nenhuma delas.
 *
 * O francês chega com o apóstrofo reto (') e com o curvo (’) do telefone, ou
 * sem apóstrofo nenhum ("ne menvoyez plus"); as listas misturam as grafias.
 */
import { describe, expect, it } from "vitest";

import { detectHumanHandoffRequest } from "@/lib/agent-engine/agent/human-handoff";
import { ehOptOutProvavel, ehPedidoDeOptOut } from "@/lib/opt-out/deteccao";

/** Pedidos inequívocos: gravam `is_blocked`. */
const HOLANDES_PEDE_PARA_SAIR = [
  // palavra sozinha
  "Uitschrijven",
  "afmelden",
  "Uitschrijving",
  // frase com objeto de comunicação
  "stuur me geen berichten meer",
  "stuur mij geen berichten meer",
  "ik wil geen berichten meer ontvangen",
  "ik wil me uitschrijven",
  "schrijf me uit",
  "haal me van de lijst",
  "verwijder mij van de lijst",
  "contacteer me niet meer",
];

const FRANCES_PEDE_PARA_SAIR = [
  // palavra sozinha
  "Désabonner",
  "désinscrire",
  "Désabonnement",
  "désinscription",
  // frase com objeto de comunicação
  "ne m'envoyez plus de messages",
  "NE M’ENVOYEZ PLUS",
  "ne menvoyez plus de messages",
  "arrêtez de m'écrire",
  "je ne veux plus recevoir de messages",
  "je veux me désabonner",
  "désinscrivez-moi",
  "retirez-moi de la liste",
  "ne me contactez plus",
];

/** Sinal ambíguo: o agente para e chama uma pessoa; ninguém é bloqueado. */
const HOLANDES_AMBIGUO = [
  "laat me met rust",
  "laat mij gerust",
  "ik heb al gezegd dat ik geen interesse heb",
  "geen interesse meer",
];

const FRANCES_AMBIGUO = [
  "laissez-moi tranquille",
  "fichez-moi la paix",
  "ça suffit",
  "ça ne m'intéresse plus",
  "je vous ai déjà dit que ça ne m'intéresse pas",
];

/** A fala comum: nem bloqueia, nem escala, nem pede humano. */
const HOLANDES_NADA = [
  "ik wil stoppen met roken",
  "ik heb geen bericht ontvangen",
  "ik heb geen berichten meer ontvangen",
  "haal me van de wachtlijst",
  "stuur me geen factuur meer",
  "kan ik mijn afspraak afzeggen?",
  "geen interesse in die wagen, wel in de andere",
];

const FRANCES_NADA = [
  "je veux arrêter de fumer",
  "je ne reçois plus vos messages",
  "je n'ai pas reçu le message",
  "retirez-moi de la liste d'attente",
  "ne m'envoyez plus de factures papier",
  "ça ne m'intéresse pas, merci",
  "ça suffit pour moi, merci",
];

describe("holandês e francês — o pedido inequívoco bloqueia", () => {
  for (const texto of [...HOLANDES_PEDE_PARA_SAIR, ...FRANCES_PEDE_PARA_SAIR]) {
    it(`bloqueia: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(true);
      expect(ehOptOutProvavel(texto)).toBe(true);
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
});

describe("holandês e francês — o sinal ambíguo escala e não bloqueia", () => {
  for (const texto of [...HOLANDES_AMBIGUO, ...FRANCES_AMBIGUO]) {
    it(`escala sem bloquear: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(true);
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
});

describe("holandês e francês — a fala comum não bloqueia nem escala", () => {
  for (const texto of [...HOLANDES_NADA, ...FRANCES_NADA]) {
    it(`nada: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(false);
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
});

// ── Controles da revisão independente ───────────────────────────────────────
//
// Frases genéricas que a revisão do PR mediu contra a primeira versão: pedidos
// reais que escapavam e falas comuns que bloqueavam (o canal de e-mail e o de
// papel, o curso, o técnico, a pessoa da família). Não são do plano; ficam à
// parte para a leitura belga confirmar ou corrigir.

const REVISAO_PEDE_PARA_SAIR = [
  "retirez-moi de la liste de diffusion",
  "retirez-moi de la liste définitivement",
  "enlevez-moi de la liste des destinataires",
  "merci de ne plus m'envoyer de messages",
  "veuillez ne plus me contacter",
  "ne plus me contacter merci",
  "je ne souhaite plus être contacté",
  "arrêtez les messages",
  "gelieve mij niet meer te contacteren",
  "ik wil niet meer gecontacteerd worden",
  "stop met berichten sturen",
  "geen berichten meer aub",
];

const REVISAO_NADA = [
  "stuur me niet meer dan twee dozen",
  "stuur me niets meer op, ik haal het zelf af",
  "contacteer me niet meer na 18u",
  "mail me niet meer, stuur liever een whatsapp",
  "je ne veux plus recevoir de mails, seulement whatsapp",
  "ik wil geen reclame meer in mijn brievenbus",
  "je ne veux plus de publicités dans ma boîte aux lettres",
  "kan ik me uitschrijven voor de yogales van donderdag?",
  "ik wil me uitschrijven uit de cursus",
  "je voudrais me désinscrire du cours de yoga",
  "comment me désinscrire de la formation ?",
  "ne m'envoyez plus le technicien de lundi",
  "ne m'envoyez plus de courrier à cette adresse",
  "ne m'écrivez plus avant 9h",
  "arrêtez de m'envoyer le catalogue papier",
  "vous devez arrêter de contacter mon assurance",
  "arrêtez de harceler ma mère",
  "je vous ai déjà dit que je ne suis pas disponible lundi",
  "je vous ai déjà dit que je ne veux pas le modèle rouge",
  "ça suffit ?",
];

/** O dado pessoal: um humano decide, ninguém é bloqueado (o espelho do turco). */
const REVISAO_AMBIGUO = ["verwijder mij uit uw bestand"];

describe("holandês e francês — controles da revisão", () => {
  for (const texto of REVISAO_PEDE_PARA_SAIR) {
    it(`bloqueia: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(true);
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
  for (const texto of REVISAO_AMBIGUO) {
    it(`escala sem bloquear: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(true);
    });
  }
  for (const texto of REVISAO_NADA) {
    it(`nada: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(false);
      expect(ehOptOutProvavel(texto)).toBe(false);
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
});
