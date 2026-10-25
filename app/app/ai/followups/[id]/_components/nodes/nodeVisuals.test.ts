/**
 * O subtítulo do card do nó final passou a sair de `lib/followup/vocabulario.ts`
 * em vez de um mapa próprio deste arquivo — eram duas cópias das mesmas três
 * palavras. A troca só vale se o texto na tela for o MESMO, e "mesmo" aqui é
 * literal: `tests/e2e/followup-journey.spec.ts` confere "Convertido" no card.
 */
import { describe, expect, it } from "vitest";

import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import { RESERVED_BRANCH_IDS, type FlowGraph } from "@/lib/followup/graph-schema";
import { traduzir } from "@/lib/i18n/dicionario";

import { describeNodeConfig, NODE_VISUAL_LIST, NODE_VISUALS, configPadraoDaAcao } from "./nodeVisuals";

/** Em português o dicionário devolve a própria chave — é o `t` do provider na língua da chave. */
const pt = (texto: string) => texto;
const es = (texto: string) => traduzir(texto, "es");

describe("describeNodeConfig — nó final", () => {
  it.each([
    ["converted", "Convertido"],
    ["exhausted", "Esgotado"],
    ["custom", "Personalizado"],
  ] as const)("outcome '%s' aparece no card como '%s'", (outcome, esperado) => {
    expect(describeNodeConfig("end", { outcome }, pt)).toBe(esperado);
  });
});

/**
 * O subtítulo do card de condição anunciava sempre o combinador. No modo
 * uma-saída-por-regra o motor NÃO consulta o combinador — o card estaria
 * afirmando uma coisa que o código ignora, e é no card que o usuário acredita.
 * Achado olhando o screenshot da própria evidência.
 */
describe("NODE_VISUAL_LIST", () => {
  it("oferece match_reply e repeat junto dos demais nós", () => {
    expect(NODE_VISUAL_LIST.map((v) => v.type)).toContain("match_reply");
    expect(NODE_VISUAL_LIST.map((v) => v.type)).toContain("repeat");
    expect(NODE_VISUAL_LIST.map((v) => v.type)).toContain("ai_classify");
  });
});

describe("describeNodeConfig — nó de condição", () => {
  const regras = [
    { id: "regra-1", field: "tag" as const, op: "contains" as const, value: "vip" },
    { id: "regra-2", field: "steps_taken" as const, op: "gte" as const, value: 3 },
  ];

  it("no modo combinado anuncia o combinador, que é o que decide", () => {
    expect(describeNodeConfig("condition", { combinator: "and", checks: regras }, pt)).toBe("2 condições · E");
    expect(describeNodeConfig("condition", { combinator: "or", checks: regras }, pt)).toBe("2 condições · OU");
  });

  it("no modo uma-saída-por-regra NÃO anuncia combinador nenhum", () => {
    const texto = describeNodeConfig("condition", {
      combinator: "and",
      branching: "per_check",
      checks: regras,
    }, pt);
    expect(texto).toBe("2 regras · uma saída por regra");
    expect(texto).not.toMatch(/\bE\b|\bOU\b/);
  });

  it("uma regra só não vira '1 regras' — o plural é de quem lê, não do código", () => {
    expect(describeNodeConfig("condition", { combinator: "and", checks: [regras[0]!] }, pt)).toBe("1 condição · E");
    expect(
      describeNodeConfig("condition", { combinator: "and", branching: "per_check", checks: [regras[0]!] }, pt),
    ).toBe("1 regra · uma saída por regra");
  });
});

/**
 * O card falava o nome do CAMPO do banco ("grace"), que não é palavra nenhuma
 * para o dono de uma loja — e o formulário do mesmo nó já perguntava "Esperar a
 * resposta por (minutos)". A varredura é por TIPO, derivada de NODE_VISUAL_LIST,
 * para que um tipo de nó novo entre nesta conta sem ninguém lembrar.
 */
describe("nenhum card fala a língua do banco", () => {
  const JARGAO = /\b(grace|timeout|class_match|no_reply|branch|steps_taken|lead_stage|per_check)\b/i;

  it.each(NODE_VISUAL_LIST.map((v) => [v.type, v] as const))("o card de '%s' em pt e em es", (_tipo, visual) => {
    for (const idioma of [pt, es]) {
      const texto = describeNodeConfig(visual.type, visual.defaultConfig(), idioma);
      expect(texto, `subtítulo de ${visual.type}: ${texto}`).not.toMatch(JARGAO);
      expect(texto.trim()).not.toBe("");
    }
  });

  it("o tempo de espera aparece com a mesma forma do card de espera: '15 min'", () => {
    expect(
      describeNodeConfig("ai_classify", { classes: ["a", "b"], grace_timeout_ms: 900_000, target: "last_reply" }, pt),
    ).toBe("2 classes · espera 15 min");
    expect(
      describeNodeConfig("ai_classify", { classes: ["a"], grace_timeout_ms: 900_000, target: "last_reply" }, pt),
    ).toBe("1 classe · espera 15 min");
    expect(describeNodeConfig("wait", { mode: "fixed", duration_ms: 600_000 }, pt)).toBe("10 min");
  });

  it("em espanhol o card de repetição e o de casar resposta também traduzem", () => {
    // Os dois chegaram por outra branch chamando `describeNodeConfig` sem `t`, e
    // o padrão identidade escondia o esquecimento de quem só lê em português.
    expect(describeNodeConfig("repeat", { max_count: 12 }, es)).toBe("hasta 12 vueltas");
    expect(describeNodeConfig("repeat", { max_count: 1 }, es)).toBe("hasta 1 vuelta");
    expect(
      describeNodeConfig(
        "match_reply",
        { branches: [{ id: "br_sim", label: "Sim", op: "contains", pattern: "sim" }], grace_timeout_ms: 900_000 },
        es,
      ),
    ).toBe("1 regla · espera 15 min");
  });

  it("em turco o minuto é «dk», não «min»", () => {
    // Medido no canvas da demo: "1 kural · bekleme 2880 min" — a unidade era
    // escrita fora de `t()`.
    const tr = (texto: string) => traduzir(texto, "tr");
    expect(
      describeNodeConfig(
        "match_reply",
        { branches: [{ id: "br_sim", label: "Sim", op: "contains", pattern: "sim" }], grace_timeout_ms: 900_000 },
        tr,
      ),
    ).toBe("1 kural · bekleme 15 dk");
    expect(describeNodeConfig("wait", { mode: "fixed", duration_ms: 600_000 }, tr)).toBe("10 dk");
  });
});

describe("a saída de escape no canvas turco", () => {
  it("«Outros casos» vira «Diğer durumlar» — «vaka» é o caso de atendimento, outra coisa do produto", () => {
    expect(traduzir("Outros casos", "tr")).toBe("Diğer durumlar");
  });
});

describe("o nó de classificação nasce no idioma do operador", () => {
  it("pt-BR: as classes padrão dizem o critério, como sempre", () => {
    const { classes } = NODE_VISUALS.ai_classify.defaultConfig() as { classes: string[] };
    expect(classes).toEqual(["Interessado", "Sem interesse"]);
  });

  it("tr e es: as classes nascem traduzidas (o nó é novo, nenhuma aresta aponta para elas)", () => {
    const tr = (texto: string) => traduzir(texto, "tr");
    const dele = NODE_VISUALS.ai_classify.defaultConfig(tr) as { classes: string[]; branches?: unknown };
    expect(dele.classes).toHaveLength(2);
    for (const classe of dele.classes) expect(["Interessado", "Sem interesse"]).not.toContain(classe);
    // O limite do schema vale para o texto traduzido.
    for (const classe of dele.classes) expect(classe.length).toBeLessThanOrEqual(40);
    const emEs = NODE_VISUALS.ai_classify.defaultConfig(es) as { classes: string[] };
    for (const classe of emEs.classes) expect(["Interessado", "Sem interesse"]).not.toContain(classe);
  });

  it("nenhum nome padrão colide com um ramo reservado do contrato", () => {
    const { classes } = NODE_VISUALS.ai_classify.defaultConfig() as { classes: string[] };
    for (const classe of classes) expect(RESERVED_BRANCH_IDS as readonly string[]).not.toContain(classe);
  });
});

describe("o nó de condição nasce sem decidir sozinho", () => {
  it("a regra padrão está a preencher, e o publish não a deixa passar", () => {
    // Era `passos ≥ 0`: verdadeira para todo lead, com cara de regra pronta no card.
    const config = NODE_VISUALS.condition.defaultConfig();
    const grafo: FlowGraph = {
      nodes: [
        { id: "t1", type: "trigger", label: "t1", position: { x: 0, y: 0 }, config: {} },
        { id: "c1", type: "condition", label: "c1", position: { x: 0, y: 0 }, config } as FlowGraph["nodes"][number],
        { id: "fim", type: "end", label: "fim", position: { x: 0, y: 0 }, config: { outcome: "exhausted" } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1", priority: 0, condition: { type: "always" } },
        { id: "e2", source: "c1", target: "fim", priority: 0, condition: { type: "cond_result", value: true } },
        { id: "e3", source: "c1", target: "fim", priority: 0, condition: { type: "cond_result", value: false } },
      ],
    };
    const r = validateFlowForPublish(grafo);
    expect(r.ok ? [] : r.errors.map((e) => e.code)).toEqual(["empty_check_value"]);
  });
});

describe("configPadraoDaAcao", () => {
  it("gatilho de retorno nasce em texto fixo; os outros, em mensagem da IA", () => {
    expect(configPadraoDaAcao("inbound_after_silence")).toEqual({
      mode: "text",
      body: "Configure esta mensagem.",
    });
    expect(configPadraoDaAcao()).toEqual({ mode: "ai_message", prompt_hint: "Configure esta etapa." });
    expect(NODE_VISUALS.action.defaultConfig()).toEqual({
      mode: "ai_message",
      prompt_hint: "Configure esta etapa.",
    });
  });
});

describe("paleta do follow-up (roteiro de atendimento, #1130)", () => {
  it("não oferece Pergunta nem Skill — o relógio não as executa", () => {
    const tipos = NODE_VISUAL_LIST.map((v) => v.type);
    expect(tipos).not.toContain("collect");
    expect(tipos).not.toContain("skill");
    expect(tipos).toContain("action");
  });
});

describe("padrões de nó novo no idioma do operador", () => {
  const tr = (texto: string) => `tr:${texto}`;

  it("a regra e a pergunta que nascem dentro do nó saem traduzidas", () => {
    const regra = NODE_VISUALS.match_reply.defaultConfig(tr) as { branches: { label: string }[] };
    expect(regra.branches[0]!.label).toBe("tr:Sim");
    const pergunta = NODE_VISUALS.collect.defaultConfig(tr) as { label: string };
    expect(pergunta.label).toBe("tr:Nova pergunta");
  });

  it("o padrão da regra acompanha o rótulo: evet em turco, si em espanhol, sim em pt-BR", () => {
    const pat = (t: (s: string) => string) =>
      (NODE_VISUALS.match_reply.defaultConfig(t) as { branches: { id: string; pattern: string }[] }).branches[0]!;
    expect(pat((s) => traduzir(s, "tr")).pattern).toBe("evet");
    expect(pat(es).pattern).toBe("si");
    expect(pat(pt).pattern).toBe("sim");
    // O id do ramo é estável e não depende do idioma.
    expect(pat((s) => traduzir(s, "tr")).id).toBe("br_sim");
  });

  it("sem tradutor (pt-BR) nada muda", () => {
    const regra = NODE_VISUALS.match_reply.defaultConfig() as { branches: { label: string; pattern: string }[] };
    expect(regra.branches[0]!.pattern).toBe("sim");
    expect(regra.branches[0]!.label).toBe("Sim");
    const pergunta = NODE_VISUALS.collect.defaultConfig() as { label: string };
    expect(pergunta.label).toBe("Nova pergunta");
  });

  it("'Nova regra' tem espanhol e turco no dicionário", () => {
    expect(traduzir("Nova regra", "es")).not.toBe("Nova regra");
    expect(traduzir("Nova regra", "tr")).not.toBe("Nova regra");
  });
});

describe("configPadraoDaAcao no idioma do operador", () => {
  it("com o tradutor turco, os dois padrões saem em turco e não em português", () => {
    const tr = (texto: string) => traduzir(texto, "tr");
    const texto = configPadraoDaAcao("inbound_after_silence", tr) as { mode: string; body: string };
    expect(texto.mode).toBe("text");
    expect(texto.body).not.toBe("Configure esta mensagem.");
    expect(texto.body).toMatch(/[ıİşŞğĞüÜöÖçÇ]|mesaj/i);

    const ia = configPadraoDaAcao(undefined, tr) as { mode: string; prompt_hint: string };
    expect(ia.mode).toBe("ai_message");
    expect(ia.prompt_hint).not.toBe("Configure esta etapa.");
    expect(ia.prompt_hint).toMatch(/[ıİşŞğĞüÜöÖçÇ]|adım/i);
  });

  it("sem tradutor ficam os textos de hoje", () => {
    expect(configPadraoDaAcao("inbound_after_silence")).toEqual({ mode: "text", body: "Configure esta mensagem." });
    expect(configPadraoDaAcao("outro")).toEqual({ mode: "ai_message", prompt_hint: "Configure esta etapa." });
  });

  it("tem espanhol e turco no dicionário", () => {
    for (const chave of ["Configure esta mensagem.", "Configure esta etapa."]) {
      expect(traduzir(chave, "es")).not.toBe(chave);
      expect(traduzir(chave, "tr")).not.toBe(chave);
    }
  });
});
