/**
 * O fechamento RECUSADO diz o FORMATO do que veio — nunca o conteúdo.
 *
 * Medido em produção (01/11/2026, conta em turco, `claude-sonnet-5`): 9 de 14
 * turnos tiveram o 1º fechamento recusado, quase sempre com
 * `declaracao.intencoes.0.o_que: invalid_type`. O log só tinha `caminho: código`,
 * e isso não separa as duas hipóteses com consertos opostos:
 * - o campo SUMIU (o modelo traduziu o nome: "ne" no lugar de `o_que`), ou
 * - o campo veio com o TIPO errado (lista, objeto, null).
 *
 * O que este arquivo prende:
 * - `invalid_type` passa a dizer o tipo esperado e o que veio ("ausente" quando a
 *   chave não existe) e os NOMES dos campos do objeto onde o erro está;
 * - nenhum VALOR do JSON aparece em `problemas` nem na mensagem do erro — a
 *   resposta do modelo pode carregar PII da conversa, e é isso que vai para o log;
 * - nome de campo fora do formato de identificador também não vai para o log
 *   (uma "chave" com espaço é texto, não nome);
 * - a correção que volta ao modelo NÃO muda: ela foi medida (14 de 14) e o
 *   conserto de verdade só é escolhido depois de ver este log.
 */
import { describe, expect, it, vi } from "vitest";

import {
  fecharOTurno,
  FechamentoRecusado,
  parseCheckpointText,
} from "@/lib/agent-engine/agent/abertura/checkpoint";

// Valores com cara de PII: nenhum deles pode sair no log.
const NOME = "Ayşe Yılmaz";
const TELEFONE = "+32 485 12 34 56";
const TRECHO = "yarın saat 10 uygun mu";

function fechamento(intencao: unknown, declaracaoExtra: Record<string, unknown> = {}) {
  return JSON.stringify({
    commitments: [],
    objections: [],
    next_action: `ligar para ${NOME}`,
    rolling_summary: `${NOME} (${TELEFONE}) quer remarcar`,
    declaracao: { intencoes: [intencao], promessas: [], nada_a_declarar: false, ...declaracaoExtra },
  });
}

function recusa(texto: string): FechamentoRecusado {
  try {
    parseCheckpointText(texto);
  } catch (err) {
    if (err instanceof FechamentoRecusado) return err;
    throw err;
  }
  throw new Error("o fechamento deveria ter sido recusado");
}

function semValores(texto: string) {
  for (const valor of [NOME, TELEFONE, TRECHO, "quer remarcar", "ligar para"]) {
    expect(texto).not.toContain(valor);
  }
}

describe("o fechamento recusado diz o formato do que veio, nunca o conteúdo", () => {
  it("⭐ `o_que` com o nome traduzido: diz que o campo está AUSENTE e quais campos o item tem", () => {
    const err = recusa(fechamento({ ne: "quer remarcar", evidencia: TRECHO }));

    expect(err.problemas).toBe(
      "declaracao.intencoes.0.o_que: invalid_type (esperado string, veio ausente; campos do objeto: ne, evidencia)",
    );
    expect(err.message).toContain(err.problemas);
    semValores(err.problemas);
    semValores(err.message);
  });

  it("`o_que` com o tipo errado: diz o tipo que veio, não o valor", () => {
    const err = recusa(fechamento({ o_que: ["quer remarcar"], evidencia: TRECHO }));

    expect(err.problemas).toBe(
      "declaracao.intencoes.0.o_que: invalid_type (esperado string, veio array; campos do objeto: o_que, evidencia)",
    );
    semValores(err.problemas);
  });

  it("`o_que: null` aparece como null — não como ausente", () => {
    const err = recusa(fechamento({ o_que: null, evidencia: TRECHO }));
    expect(err.problemas).toContain("(esperado string, veio null;");
  });

  it("a declaração inteira com o tipo errado: o tipo, e os campos do objeto de cima", () => {
    const texto = JSON.stringify({
      commitments: [],
      objections: [],
      next_action: null,
      rolling_summary: "resumo",
      declaracao: `${NOME} quer remarcar`,
    });
    const err = recusa(texto);
    expect(err.problemas).toBe(
      "declaracao: invalid_type (esperado object, veio string; campos do objeto: commitments, objections, next_action, rolling_summary, declaracao)",
    );
    semValores(err.problemas);
  });

  it("nome de campo que não tem forma de nome não vai para o log", () => {
    const err = recusa(fechamento({ [`${NOME} quer remarcar`]: "sim", evidencia: TRECHO }));
    expect(err.problemas).toContain("campos do objeto: (nome fora do padrão), evidencia)");
    semValores(err.problemas);
  });

  it("objeto com campos demais: a lista é cortada e diz quantos ficaram de fora", () => {
    const muitos = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`campo_${i + 1}`, "x"]));
    const err = recusa(fechamento(muitos));
    expect(err.problemas).toContain("campo_12 e mais 3)");
    expect(err.problemas).not.toContain("campo_13");
  });

  it("a correção que volta ao modelo não muda — só o log ganha o formato", () => {
    const err = recusa(fechamento({ ne: "quer remarcar", evidencia: TRECHO }));
    expect(err.paraOModelo).toBe("declaracao.intencoes.0.o_que: invalid_type");
  });

  it("o aviso do fechamento recusado leva o formato e nenhum valor", async () => {
    const valido = JSON.stringify({
      commitments: [],
      objections: [],
      next_action: null,
      rolling_summary: "resumo",
      declaracao: { intencoes: [], promessas: [], nada_a_declarar: true },
    });
    const respostas = [fechamento({ ne: "quer remarcar", evidencia: TRECHO }), valido];
    let n = 0;
    const pedir = vi.fn(async () => ({ text: respostas[n++]!, callId: `call-${n}` }));
    const log = { warn: vi.fn() };

    const r = await fecharOTurno({ pedir, log });

    expect(r.corrigido).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const aviso = JSON.stringify(log.warn.mock.calls[0]);
    expect(aviso).toContain("veio ausente; campos do objeto: ne, evidencia");
    semValores(aviso);
  });
});
