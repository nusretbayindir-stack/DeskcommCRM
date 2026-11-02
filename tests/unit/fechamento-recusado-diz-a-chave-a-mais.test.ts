/**
 * O fechamento recusado por CHAVE A MAIS diz no log o NOME da chave — nunca o valor.
 *
 * Medido em produção (02/11/2026, v1.88.13, conta em turco, Claude Sonnet 5): com
 * o `o_what` já aceito, 1 de 4 turnos ainda teve o fechamento recusado, agora por
 * `declaracao: unrecognized_keys`. O log parou aí: o `.strict()` da declaração
 * achou uma chave que o contrato não tem, e ninguém sabe qual. Sem o nome não dá
 * para escolher o conserto (é um nome traduzido? um campo inventado? a chave de
 * outro bloco do fechamento escrita dentro da declaração?).
 *
 * `paraOModelo` já diz o nome — mas só volta ao próprio modelo, não ao log.
 *
 * O que este arquivo prende:
 * - `unrecognized_keys` passa a dizer, em `problemas` (o log), os nomes das
 *   chaves que não existem;
 * - com o mesmo filtro do `invalid_type`: chave sem forma de nome vira
 *   "(nome fora do padrão)", e a lista para em 12;
 * - nenhum VALOR aparece em `problemas`, na mensagem do erro ou no aviso;
 * - a correção que volta ao modelo NÃO muda (foi medida: 14 de 14).
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
const TRECHO = "yarın görüşürüz";

function fechamento(declaracaoExtra: Record<string, unknown>) {
  return JSON.stringify({
    commitments: [],
    objections: [],
    next_action: null,
    rolling_summary: "resumo",
    declaracao: { intencoes: [], promessas: [], nada_a_declarar: true, ...declaracaoExtra },
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
  for (const valor of [NOME, TELEFONE, TRECHO]) {
    expect(texto).not.toContain(valor);
  }
}

describe("o fechamento recusado por chave a mais diz o nome da chave, nunca o valor", () => {
  it("⭐ a chave que não existe aparece pelo NOME no log", () => {
    const err = recusa(fechamento({ observacoes: `${NOME} confirmou: ${TRECHO}` }));

    expect(err.problemas).toBe("declaracao: unrecognized_keys (campos que não existem: observacoes)");
    expect(err.message).toContain("(campos que não existem: observacoes)");
    semValores(err.problemas);
    semValores(err.message);
  });

  it("chave sem forma de nome não vai para o log", () => {
    const err = recusa(fechamento({ [`${NOME} ${TELEFONE}`]: TRECHO, resumo: "x" }));

    expect(err.problemas).toContain("(campos que não existem: (nome fora do padrão), resumo)");
    semValores(err.problemas);
  });

  it("chaves demais: a lista para em 12 e diz quantas ficaram de fora", () => {
    const muitas = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`extra_${i + 1}`, "x"]));
    const err = recusa(fechamento(muitas));

    expect(err.problemas).toContain("extra_12 e mais 3)");
    expect(err.problemas).not.toContain("extra_13");
  });

  it("a correção que volta ao modelo não muda — só o log ganha os nomes", () => {
    const err = recusa(fechamento({ observacoes: TRECHO }));

    expect(err.paraOModelo).toBe("declaracao: unrecognized_keys (campos que não existem: observacoes)");
  });

  it("o aviso do fechamento recusado leva o nome da chave e nenhum valor", async () => {
    const valido = fechamento({});
    const respostas = [fechamento({ observacoes: `${NOME}: ${TRECHO}` }), valido];
    let n = 0;
    const pedir = vi.fn(async () => ({ text: respostas[n++]!, callId: `call-${n}` }));
    const log = { warn: vi.fn() };

    const r = await fecharOTurno({ pedir, log });

    expect(r.corrigido).toBe(true);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const aviso = JSON.stringify(log.warn.mock.calls[0]);
    expect(aviso).toContain("declaracao: unrecognized_keys (campos que não existem: observacoes)");
    semValores(aviso);
  });
});
