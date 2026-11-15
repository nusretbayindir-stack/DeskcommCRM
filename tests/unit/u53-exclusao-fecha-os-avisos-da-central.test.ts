// @vitest-environment node
/**
 * U53: o worker de exclusão fecha os avisos da Central quando o pedido termina.
 *
 * O worker de exclusão é pesado demais para um dublê fiel (cascata, atestado,
 * aviso ao titular, callback). Em vez disso, uma varredura do fonte: cada
 * atualização para `status: "completed"` do pedido do contato tem, nas 30 linhas
 * seguintes, a chamada de `resolverAvisosDoPedido(`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(resolve(__dirname, "../../workers/lgpd-redact-worker.ts"), "utf8").split("\n");

describe("lgpd-redact-worker: fecha os avisos da Central", () => {
  it("toda atualização para completed do pedido do contato é seguida de resolverAvisosDoPedido", () => {
    // `finalStatus` (escopo da empresa) não é pedido aberto pela tela: fica de fora.
    const completos = fonte
      .map((linha, i) => (/status:\s*"completed"/.test(linha) ? i : -1))
      .filter((i) => i >= 0);
    expect(completos.length).toBeGreaterThanOrEqual(2);
    for (const i of completos) {
      const janela = fonte.slice(i, i + 31).join("\n");
      expect(janela, `linha ${i + 1}: sem resolverAvisosDoPedido logo após o completed`).toContain(
        "resolverAvisosDoPedido(",
      );
    }
  });

  it("importa a função de lgpd/avisos-do-pedido-manual", () => {
    expect(fonte.join("\n")).toContain('from "@/lib/lgpd/avisos-do-pedido-manual"');
  });
});
