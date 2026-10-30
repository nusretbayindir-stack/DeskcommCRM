/**
 * As mensagens de um turno chegam ao cliente NA ORDEM em que o modelo as escreveu.
 *
 * Defeito medido ao vivo (2026-10-30, demo da Agenterix): a resposta de três
 * partes chegou com a 2ª antes da 1ª, as três no mesmo minuto. O modelo chamou
 * `send_message` três vezes no MESMO passo e o SDK executa as tool calls de um
 * passo juntas (`Promise.all`). Cada `execute` passa pela cadeia `before_send`
 * (gates com chamada de modelo, de duração variável) e só então toma o lock do
 * número: sai primeiro quem termina primeiro. A pausa humana, ainda por cima, só
 * é paga pela primeira chamada que chega (`jaEsperouComoHumano`) — as outras
 * passam na frente dela.
 *
 * O `split_messages` ligado contorna (o motor manda UM `send_message` e fatia ele
 * mesmo), mas um agente com o ajuste desligado seguia exposto. A fila vale para
 * qualquer agente: as ferramentas que ENVIAM saem uma depois da outra, na ordem
 * de chegada; as de leitura seguem em paralelo (`turno-le-em-paralelo.test.ts`).
 *
 * A fila mora no seam (`run-model-call.ts`), POR FORA de `guardServiceTools`: a
 * guarda consulta o banco antes de cada envio, e consultas paralelas voltam em
 * qualquer ordem — uma fila por dentro dela receberia as chamadas já embaralhadas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { generateText, tool, type ToolSet } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  FERRAMENTAS_QUE_ENVIAM,
  enviosEmOrdemDeChegada,
} from "@/lib/agent-engine/edge/llm/envios-em-ordem";

const USO = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Modelo que, no primeiro passo, chama as ferramentas dadas TODAS no mesmo passo. */
function modeloQueChamaNoMesmoPasso(chamadas: Array<{ toolName: string; input: object }>) {
  let passo = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      passo += 1;
      if (passo > 1) {
        return {
          content: [{ type: "text" as const, text: "fim" }],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage: USO,
          warnings: [],
        };
      }
      return {
        content: chamadas.map((c, i) => ({
          type: "tool-call" as const,
          toolCallId: `c${i + 1}`,
          toolName: c.toolName,
          input: JSON.stringify(c.input),
        })),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage: USO,
        warnings: [],
      };
    },
  });
}

const TRES_PARTES = [
  { toolName: "send_message", input: { body: "1. Agenterix önce işletmenizin sürecini anlar." } },
  { toolName: "send_message", input: { body: "2. Sonra süreci yeniden tasarlar." } },
  { toolName: "send_message", input: { body: "3. En son AI çalışanlarını kurar." } },
];

/**
 * `send_message` que imita o turno real: a 1ª chamada a chegar paga a pausa
 * humana (a mais longa); as outras passam só pela cadeia, mais curta e variável.
 */
function ferramentasDeEnvio(enviados: string[]): ToolSet {
  let jaEsperouComoHumano = false;
  const cadeia = [0, 15];
  return {
    send_message: tool({
      description: "envia",
      inputSchema: z.object({ body: z.string() }),
      execute: async ({ body }) => {
        if (!jaEsperouComoHumano) {
          jaEsperouComoHumano = true;
          await esperar(40);
        } else {
          await esperar(cadeia.shift() ?? 0);
        }
        enviados.push(body);
        return { ok: true };
      },
    }),
  };
}

describe("a causa: o SDK executa as tool calls do mesmo passo juntas", () => {
  it("sem a fila, a parte que termina a cadeia primeiro sai primeiro", async () => {
    const enviados: string[] = [];
    await generateText({
      model: modeloQueChamaNoMesmoPasso(TRES_PARTES),
      tools: ferramentasDeEnvio(enviados),
      prompt: "oi",
    });
    // Exatamente o que o cliente viu ao vivo: a 1ª parte depois das outras.
    expect(enviados).toEqual([
      "2. Sonra süreci yeniden tasarlar.",
      "3. En son AI çalışanlarını kurar.",
      "1. Agenterix önce işletmenizin sürecini anlar.",
    ]);
  });
});

describe("enviosEmOrdemDeChegada", () => {
  it("as três partes saem na ordem em que o modelo as escreveu", async () => {
    const enviados: string[] = [];
    await generateText({
      model: modeloQueChamaNoMesmoPasso(TRES_PARTES),
      tools: enviosEmOrdemDeChegada(ferramentasDeEnvio(enviados)),
      prompt: "oi",
    });
    expect(enviados).toEqual(TRES_PARTES.map((c) => c.input.body));
  });

  /**
   * Imita `guardServiceTools`: antes de cada execute de efeito, uma consulta ao
   * banco de duração variável. Aqui a 1ª chamada é a mais lenta a voltar.
   */
  function guardaQueConsultaOBanco(tools: ToolSet): ToolSet {
    const consultas = [20, 0, 10];
    return Object.fromEntries(
      Object.entries(tools).map(([nome, def]) => {
        const execute = def.execute!;
        return [
          nome,
          {
            ...def,
            execute: async (...args: Parameters<typeof execute>) => {
              await esperar(consultas.shift() ?? 0);
              return execute(...args);
            },
          },
        ];
      }),
    ) as ToolSet;
  }

  it("por dentro da guarda do banco, a fila recebe as chamadas já embaralhadas", async () => {
    const enviados: string[] = [];
    await generateText({
      model: modeloQueChamaNoMesmoPasso(TRES_PARTES),
      tools: guardaQueConsultaOBanco(enviosEmOrdemDeChegada(ferramentasDeEnvio(enviados))!),
      prompt: "oi",
    });
    expect(enviados).not.toEqual(TRES_PARTES.map((c) => c.input.body));
  });

  it("por fora da guarda do banco, a ordem se mantém", async () => {
    const enviados: string[] = [];
    await generateText({
      model: modeloQueChamaNoMesmoPasso(TRES_PARTES),
      tools: enviosEmOrdemDeChegada(guardaQueConsultaOBanco(ferramentasDeEnvio(enviados))),
      prompt: "oi",
    });
    expect(enviados).toEqual(TRES_PARTES.map((c) => c.input.body));
  });

  it("um envio só começa depois que o anterior terminou, inclusive entre send_message e send_template", async () => {
    let emAndamento = 0;
    let maximo = 0;
    const ordem: string[] = [];
    const medir = (nome: string, ms: number) => async () => {
      emAndamento += 1;
      maximo = Math.max(maximo, emAndamento);
      await esperar(ms);
      ordem.push(nome);
      emAndamento -= 1;
      return { ok: true };
    };
    const tools: ToolSet = {
      send_message: tool({ inputSchema: z.object({}), execute: medir("mensagem", 30) }),
      send_template: tool({ inputSchema: z.object({}), execute: medir("modelo", 0) }),
    };
    await generateText({
      model: modeloQueChamaNoMesmoPasso([
        { toolName: "send_message", input: {} },
        { toolName: "send_template", input: {} },
      ]),
      tools: enviosEmOrdemDeChegada(tools),
      prompt: "oi",
    });
    expect(maximo).toBe(1);
    expect(ordem).toEqual(["mensagem", "modelo"]);
  });

  it("um envio que falha não trava os seguintes e devolve o próprio erro", async () => {
    const enviados: string[] = [];
    const tools = enviosEmOrdemDeChegada({
      send_message: tool({
        inputSchema: z.object({ body: z.string() }),
        execute: async ({ body }) => {
          await esperar(5);
          if (body === "quebra") throw new Error("canal caiu");
          enviados.push(body);
          return { ok: true };
        },
      }),
    })!;
    const executar = tools.send_message!.execute!;
    const opcoes = { toolCallId: "x", messages: [] };
    const [primeiro, segundo] = await Promise.allSettled([
      executar({ body: "quebra" }, opcoes),
      executar({ body: "segue" }, opcoes),
    ]);
    expect(primeiro.status).toBe("rejected");
    expect((primeiro as PromiseRejectedResult).reason).toEqual(new Error("canal caiu"));
    expect(segundo).toEqual({ status: "fulfilled", value: { ok: true } });
    expect(enviados).toEqual(["segue"]);
  });

  it("as ferramentas de leitura seguem em paralelo", async () => {
    let emAndamento = 0;
    let maximo = 0;
    const ler = async () => {
      emAndamento += 1;
      maximo = Math.max(maximo, emAndamento);
      await esperar(10);
      emAndamento -= 1;
      return { ok: true };
    };
    const tools: ToolSet = {
      get_lead_context: tool({ inputSchema: z.object({}), execute: ler }),
      search_knowledge: tool({ inputSchema: z.object({}), execute: ler }),
    };
    await generateText({
      model: modeloQueChamaNoMesmoPasso([
        { toolName: "get_lead_context", input: {} },
        { toolName: "search_knowledge", input: {} },
      ]),
      tools: enviosEmOrdemDeChegada(tools),
      prompt: "oi",
    });
    expect(maximo).toBe(2);
  });

  it("a fila não é global: o envio de uma conversa não espera o de outra", async () => {
    const ordem: string[] = [];
    const turno = (nome: string, ms: number) =>
      enviosEmOrdemDeChegada({
        send_message: tool({
          inputSchema: z.object({}),
          execute: async () => {
            await esperar(ms);
            ordem.push(nome);
            return { ok: true };
          },
        }),
      })!;
    const opcoes = { toolCallId: "x", messages: [] };
    await Promise.all([
      turno("lento", 30).send_message!.execute!({}, opcoes),
      turno("rapido", 0).send_message!.execute!({}, opcoes),
    ]);
    expect(ordem).toEqual(["rapido", "lento"]);
  });

  it("devolve um ToolSet novo e não mexe no original nem em quem não tem execute", () => {
    const original: ToolSet = {
      send_message: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
      sem_execute: tool({ inputSchema: z.object({}) }),
    };
    const executeOriginal = original.send_message!.execute;
    const envolvidas = enviosEmOrdemDeChegada(original)!;
    expect(envolvidas).not.toBe(original);
    expect(original.send_message!.execute).toBe(executeOriginal);
    expect(envolvidas.send_message!.execute).not.toBe(executeOriginal);
    expect(envolvidas.sem_execute).toBe(original.sem_execute);
  });

  it("mantém a ordem das ferramentas — o prefixo do cache de prompt depende dela", () => {
    const original: ToolSet = {
      get_lead_context: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
      send_message: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
      search_knowledge: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
      send_template: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
    };
    expect(Object.keys(enviosEmOrdemDeChegada(original)!)).toEqual(Object.keys(original));
  });

  it("sem ferramentas, devolve sem ferramentas (mesmo contrato de guardServiceTools)", () => {
    expect(enviosEmOrdemDeChegada(undefined)).toBeUndefined();
  });

  it("as ferramentas que enviam são as duas que falam com o cliente", () => {
    expect([...FERRAMENTAS_QUE_ENVIAM].sort()).toEqual(["send_message", "send_template"]);
  });
});

describe("o seam entrega ao modelo as ferramentas com a fila", () => {
  const FONTE = readFileSync(
    join(process.cwd(), "lib/agent-engine/edge/llm/run-model-call.ts"),
    "utf8",
  );

  it("a fila é o envoltório mais externo, por fora da guarda de atendimento", () => {
    // Por FORA de `guardServiceTools` (e, por tabela, do traço e do breaker do
    // turno): a guarda de cada envio só consulta o banco depois que o anterior
    // terminou — se o operador assumiu no meio, a parte seguinte já vê.
    expect(FONTE).toMatch(/tools: enviosEmOrdemDeChegada\(guardServiceTools\(prefix\.tools\)\),/);
  });
});
