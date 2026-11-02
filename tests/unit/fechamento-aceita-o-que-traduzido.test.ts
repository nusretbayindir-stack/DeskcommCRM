/**
 * O FECHAMENTO aceita `o_what` no lugar de `o_que` — o único nome traduzido MEDIDO.
 *
 * Medido em produção (02/11/2026, Claude Sonnet 5, conta em turco): 3 de 6 turnos
 * tiveram o fechamento recusado, e os três pelo MESMO motivo, lido no log que a
 * U28 passou a escrever:
 *
 *   declaracao.intencoes.0.o_que: invalid_type
 *     (esperado string, veio ausente; campos do objeto: o_what, evidencia)
 *
 * O modelo traduz metade do nome do campo. A correção (`correcaoDoFechamento`)
 * conserta sempre na segunda chamada — mas a segunda chamada é o custo: 1,6–3,3¢
 * e 5–8 s por turno recusado, e o "ensino" não atravessa turnos (o turno seguinte
 * erra igual). Para ESTE apelido, a correção só compra o mesmo resultado que o
 * parser pode dar de graça.
 *
 * O que este arquivo prende:
 * - `o_what` vira `o_que` em intenções e promessas, e o fechamento passa de
 *   primeira (uma chamada só);
 * - o apelido aceito vai para o log — o caminho, nunca o valor (PII da conversa);
 * - o apelido só PREENCHE o que falta: com `o_que` presente, vale o `o_que`;
 * - qualquer outro nome continua recusado e vira correção, como antes: a
 *   tolerância é para o desvio medido, não uma porta aberta.
 */
import { describe, expect, it, vi } from "vitest";

import {
  fecharOTurno,
  FechamentoRecusado,
  parseCheckpointText,
} from "@/lib/agent-engine/agent/abertura/checkpoint";

function fechamento(declaracao: unknown): string {
  return JSON.stringify({
    commitments: [],
    objections: [],
    next_action: "aguardar a escolha do horário",
    rolling_summary: "Cliente quer test drive amanhã.",
    declaracao,
  });
}

// O formato exato do log de 02/11: `campos do objeto: o_what, evidencia`.
const COM_O_WHAT = fechamento({
  intencoes: [{ o_what: "quer fazer test drive amanhã", evidencia: "Yarın test sürüşüne gelebilir miyim?" }],
  promessas: [],
  nada_a_declarar: false,
});

type Extra = Array<{ role: "assistant" | "user"; content: string }>;

function modelo(...respostas: string[]) {
  const chamadas: Extra[] = [];
  const pedir = vi.fn(async (extra: Extra) => {
    chamadas.push(extra);
    const text = respostas[chamadas.length - 1];
    if (text === undefined) throw new Error("chamada a mais do que o esperado");
    return { text, callId: `call-${chamadas.length}` };
  });
  return { pedir, chamadas };
}

describe("fechamento com `o_what` no lugar de `o_que`", () => {
  it("a intenção é aceita, com o texto no `o_que`", () => {
    const content = parseCheckpointText(COM_O_WHAT);

    expect(content.declaracao?.intencoes).toEqual([
      { o_que: "quer fazer test drive amanhã", evidencia: "Yarın test sürüşüne gelebilir miyim?" },
    ]);
  });

  it("a promessa também — o campo tem o mesmo nome nos dois itens", () => {
    const content = parseCheckpointText(
      fechamento({
        intencoes: [],
        promessas: [{ o_what: "test drive confirmado para 03/11 11:00", prazo: null }],
        nada_a_declarar: false,
      }),
    );

    expect(content.declaracao?.promessas).toEqual([
      { o_que: "test drive confirmado para 03/11 11:00", prazo: null },
    ]);
  });

  it("não custa a segunda chamada: o fechamento passa de primeira", async () => {
    const { pedir } = modelo(COM_O_WHAT);

    const r = await fecharOTurno({ pedir, log: { warn: vi.fn() } });

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(r.corrigido).toBe(false);
    expect(r.content.declaracao?.intencoes[0]?.o_que).toBe("quer fazer test drive amanhã");
  });

  it("o apelido aceito fica no log — o caminho, nunca o valor", async () => {
    const warn = vi.fn();
    const { pedir } = modelo(COM_O_WHAT);

    await fecharOTurno({ pedir, log: { warn } });

    expect(warn).toHaveBeenCalledTimes(1);
    const [msg, campos] = warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(msg).toMatch(/nome de campo traduzido/);
    expect(campos).toEqual({ campos: "declaracao.intencoes.0.o_what → o_que" });
    expect(JSON.stringify(campos)).not.toContain("test drive");
    expect(JSON.stringify(campos)).not.toContain("Yarın");
  });

  it("com `o_que` presente, vale o `o_que` — o apelido só preenche o que falta", () => {
    const content = parseCheckpointText(
      fechamento({
        intencoes: [{ o_que: "o certo", o_what: "o traduzido", evidencia: "trecho" }],
        promessas: [],
        nada_a_declarar: false,
      }),
    );

    expect(content.declaracao?.intencoes[0]?.o_que).toBe("o certo");
  });

  it("outro nome traduzido continua recusado — a tolerância é só para o desvio medido", () => {
    const texto = fechamento({
      intencoes: [{ what: "quer test drive", evidencia: "trecho" }],
      promessas: [],
      nada_a_declarar: false,
    });

    expect(() => parseCheckpointText(texto)).toThrow(FechamentoRecusado);
    expect(() => parseCheckpointText(texto)).toThrow(/declaracao\.intencoes\.0\.o_que: invalid_type/);
  });

  it("declaração sem listas de verdade não quebra o apelido — vira a recusa de sempre", () => {
    const texto = fechamento({ intencoes: "quer test drive", promessas: [null, 3], nada_a_declarar: false });

    expect(() => parseCheckpointText(texto)).toThrow(FechamentoRecusado);
  });
});
