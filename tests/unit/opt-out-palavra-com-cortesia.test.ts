/**
 * U44 — a palavra de saída com uma palavra de CORTESIA ("STOP svp", "Stop aub",
 * "RET lütfen") bloqueia como a palavra sozinha (decisão do dono, 2026-11-13).
 *
 * A regra da palavra isolada exigia a mensagem inteira = a palavra; o cliente
 * que respondia ao "Antwoord STOP" com "Stop aub" não era bloqueado nem caía no
 * ambíguo, e o assistente seguia conversando. Agora a mensagem feita SÓ da
 * palavra e de cortesias de uma lista FECHADA conta como a palavra sozinha —
 * com duas exceções medidas: `cancelar`, `sair`, `remover`, `salir` e `bajar`
 * com cortesia vão para o AMBÍGUO ("cancelar por favor" depois de um lembrete de
 * consulta quase sempre é a consulta), e `afmelden` continua ambíguo.
 */
import { describe, expect, it } from "vitest";

import { detectHumanHandoffRequest } from "@/lib/agent-engine/agent/human-handoff";
import { ehOptOutProvavel, ehPedidoDeOptOut } from "@/lib/opt-out/deteccao";

const BLOQUEIAM = [
  "STOP svp",
  "Stop aub",
  "Stop a.u.b.!",
  "svp stop",
  "PARAR por favor",
  "BAJA por favor",
  "STOP please",
  "RET lütfen",
  "stop merci 🙏",
  "Uitschrijven alstublieft",
  // As formas da lista fechada, uma por idioma, e mais de uma cortesia.
  "Stop s.v.p.",
  "Stop s'il vous plaît",
  "désabonner s’il te plaît",
  "stop, dank u",
  "Stop dankjewel",
  "unsubscribe thank you",
  "stop pls",
  "Pare, obrigada",
  "descadastrar pfv",
  "baja porfa gracias",
  "ret teşekkürler",
  "RET teşekkür ederim",
  "ret sağol",
  "STOP!!! merci",
  "desinscription bedankt",
  "Stop svp merci",
];

const AMBIGUAS = [
  "cancelar por favor",
  "afmelden aub",
  "sair por favor",
  "Remover, obrigado",
  "salir por favor",
  "bajar gracias",
];

const NADA = [
  "por favor",
  "merci",
  "svp",
  "stop svp je veux juste l'horaire",
  "aub",
  "thank you",
  "lütfen",
];

describe("palavra de saída + cortesia: bloqueia como a palavra sozinha", () => {
  it.each(BLOQUEIAM)("%s → bloqueia", (texto) => {
    expect(ehPedidoDeOptOut(texto)).toBe(true);
    expect(ehOptOutProvavel(texto)).toBe(true);
    expect(detectHumanHandoffRequest(texto)).toBe(false);
  });
});

describe("cancelar/sair/remover/salir/bajar + cortesia: ambíguo, uma pessoa decide", () => {
  it.each(AMBIGUAS)("%s → ambíguo", (texto) => {
    expect(ehPedidoDeOptOut(texto)).toBe(false);
    expect(ehOptOutProvavel(texto)).toBe(true);
    expect(detectHumanHandoffRequest(texto)).toBe(false);
  });

  it.each(["cancelar", "sair", "remover", "salir", "bajar"])(
    "%s sozinha continua como hoje: bloqueia",
    (palavra) => {
      expect(ehPedidoDeOptOut(palavra)).toBe(true);
    },
  );

  it("afmelden sozinha continua ambígua", () => {
    expect(ehPedidoDeOptOut("afmelden")).toBe(false);
    expect(ehOptOutProvavel("afmelden")).toBe(true);
  });
});

describe("cortesia sozinha, ou mais que cortesia: nada", () => {
  it.each(NADA)("%s → nada", (texto) => {
    expect(ehPedidoDeOptOut(texto)).toBe(false);
    expect(ehOptOutProvavel(texto)).toBe(false);
    expect(detectHumanHandoffRequest(texto)).toBe(false);
  });

  it("uma palavra comum com cortesia não vira pedido", () => {
    for (const texto of ["ok merci", "oi por favor", "dank u", "sim obrigado", "parar a dor por favor"]) {
      expect(ehPedidoDeOptOut(texto), texto).toBe(false);
    }
  });

  it("cortesia que não está na lista fechada não conta", () => {
    expect(ehPedidoDeOptOut("stop beaucoup")).toBe(false);
    expect(ehPedidoDeOptOut("stop asap")).toBe(false);
  });
});

describe("revisão do U44: a cortesia não abre caminho para falso positivo", () => {
  // Bloquear é para sempre. Um número na mensagem é conteúdo ("Baja 10% por
  // favor" é pedir desconto), e pedaços separados por cortesia não se colam.
  it.each([
    "Baja 10% por favor",
    "baja 2 por favor",
    "Pare 1 por favor",
    "stop #1 merci",
    "stop $5 thanks",
    "pa re por favor",
    "s top merci",
    "pa por favor re",
  ])("%s → não bloqueia", (texto) => {
    expect(ehPedidoDeOptOut(texto)).toBe(false);
  });

});
