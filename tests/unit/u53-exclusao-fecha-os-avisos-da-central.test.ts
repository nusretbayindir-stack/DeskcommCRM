// @vitest-environment node
/**
 * U53: o worker de exclusão fecha os avisos da Central quando o pedido termina.
 *
 * Varredura do fonte (não um dublê) para não editar o teste upstream
 * `atestado-no-worker.test.ts`, que já tem um dublê fiel do worker — editar
 * arquivo upstream gera conflito na sincronização. A varredura ignora linhas de
 * comentário e exige que cada atualização para `status: "completed"` seja
 * seguida da SUA chamada, com a forma exata usada pelo worker, antes da próxima
 * atualização.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const linhas = readFileSync(resolve(__dirname, "../../workers/lgpd-redact-worker.ts"), "utf8")
  .split("\n")
  .map((texto, i) => ({ texto, numero: i + 1 }))
  .filter(({ texto }) => !/^\s*(\/\/|\*|\/\*)/.test(texto));

const COMPLETED = /status:\s*"completed"/;
const CHAMADA = "await resolverAvisosDoPedido(admin, orgId, requestId);";

describe("lgpd-redact-worker: fecha os avisos da Central", () => {
  it("cada atualização para completed do pedido do contato tem a sua chamada, na forma exata, antes da próxima", () => {
    const completos = linhas.filter(({ texto }) => COMPLETED.test(texto));
    const chamadas = linhas.filter(({ texto }) => texto.trim() === CHAMADA);
    expect(completos).toHaveLength(2);
    expect(chamadas).toHaveLength(completos.length);

    completos.forEach((atual, k) => {
      const proximo = completos[k + 1]?.numero ?? Infinity;
      const dela = chamadas.filter((c) => c.numero > atual.numero && c.numero < proximo);
      expect(dela, `linha ${atual.numero}: sem a sua chamada de resolverAvisosDoPedido`).toHaveLength(1);
    });
  });

  it("importa a função de lgpd/avisos-do-pedido-manual", () => {
    expect(linhas.map((l) => l.texto).join("\n")).toContain(
      'import { resolverAvisosDoPedido } from "@/lib/lgpd/avisos-do-pedido-manual";',
    );
  });
});
