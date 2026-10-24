/**
 * O grafo do catálogo nasce em português (é código nosso), mas o dono de uma
 * clínica turca abre o construtor e lê os NOMES dos nós — "Início", "Espera 3
 * dias", "Fim: respondeu". Aqui se prova que a instalação entrega esses nomes no
 * idioma de quem instalou, sem tocar no que o paciente lê (`config.body`) e sem
 * estourar os limites do schema (um rótulo turco mais longo que o português
 * faria o `draft_graph` falhar só na hora de abrir o construtor).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { flowGraphSchema, type FlowGraph } from "@/lib/followup/graph-schema";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import { DICIONARIO } from "@/lib/i18n/dicionario";

import { MODELOS_DE_FOLLOWUP } from "./index";
import { rotuloDaEspera } from "./escada";
import { traduzirGrafoDoModelo } from "./traduzir-grafo";

const TR = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "i18n", "traducoes", "tr.json"), "utf8"),
) as Record<string, string>;

/** Tudo que a pessoa lê no construtor e que o catálogo escreve: nome de nó, de ramo e nota do fim. */
function textosDoConstrutor(grafo: FlowGraph): string[] {
  return grafo.nodes.flatMap((n) => {
    const config = n.config as { branches?: { label: string }[]; note?: string };
    return [n.label, ...(config.branches?.map((b) => b.label) ?? []), ...(config.note ? [config.note] : [])];
  });
}

describe.each(MODELOS_DE_FOLLOWUP.map((m) => [m.id, m] as const))("%s traduzido", (_id, modelo) => {
  it("em pt-BR devolve o grafo idêntico", () => {
    expect(traduzirGrafoDoModelo(modelo.grafo, "pt-BR")).toEqual(modelo.grafo);
  });

  it("em turco nenhum nome, ramo ou nota fica em português", () => {
    const tr = traduzirGrafoDoModelo(modelo.grafo, "tr");
    const pt = new Set(textosDoConstrutor(modelo.grafo));
    const sobrou = textosDoConstrutor(tr).filter((texto) => pt.has(texto));
    expect(sobrou).toEqual([]);
  });

  it.each(["tr", "es"] as const)("em %s o grafo continua passando no schema e no publish", (idioma) => {
    const traduzido = traduzirGrafoDoModelo(modelo.grafo, idioma);
    const parsed = flowGraphSchema.safeParse(traduzido);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    expect(validateFlowForPublish(parsed.success ? parsed.data : traduzido).ok).toBe(true);
  });

  it("não mexe na estrutura nem no texto que vai para o paciente", () => {
    const tr = traduzirGrafoDoModelo(modelo.grafo, "tr");
    expect(tr.edges).toEqual(modelo.grafo.edges);
    expect(tr.nodes.map((n) => [n.id, n.type, n.position])).toEqual(
      modelo.grafo.nodes.map((n) => [n.id, n.type, n.position]),
    );
    const corpo = (g: FlowGraph) => g.nodes.map((n) => (n.config as { body?: string }).body);
    expect(corpo(tr)).toEqual(corpo(modelo.grafo));
    const espera = (g: FlowGraph) => g.nodes.map((n) => (n.config as { duration_ms?: number }).duration_ms);
    expect(espera(tr)).toEqual(espera(modelo.grafo));
  });

  it("o nome do modelo, os rótulos e as notas têm espanhol e turco no dicionário", () => {
    const chaves = [modelo.nome, ...textosDoConstrutor(modelo.grafo)];
    // A espera leva número: a chave é o molde, não o texto montado.
    const moldes = chaves.map((c) => c.replace(/^Espera (\d+) (dias|horas)$/, "Espera {n} $2"));
    const semEs = moldes.filter((c) => !DICIONARIO[c]?.es);
    const semTr = moldes.filter((c) => !TR[c]);
    expect({ semEs, semTr }).toEqual({ semEs: [], semTr: [] });
  });
});

describe("rótulo da espera", () => {
  const DIA = 86_400_000;
  const HORA = 3_600_000;
  const tr = (texto: string) => TR[texto] ?? texto;

  it("sem tradutor continua igual ao de sempre", () => {
    expect(rotuloDaEspera(3 * DIA)).toBe("Espera 3 dias");
    expect(rotuloDaEspera(DIA)).toBe("Espera 1 dia");
    expect(rotuloDaEspera(2 * HORA)).toBe("Espera 2 horas");
    expect(rotuloDaEspera(HORA)).toBe("Espera 1 hora");
  });

  it("com tradutor leva o número no lugar do {n}", () => {
    expect(rotuloDaEspera(3 * DIA, tr)).toContain("3");
    expect(rotuloDaEspera(3 * DIA, tr)).not.toContain("{n}");
    expect(rotuloDaEspera(3 * DIA, tr)).not.toContain("Espera");
    expect(rotuloDaEspera(2 * HORA, tr)).not.toContain("Espera");
    expect(rotuloDaEspera(DIA, tr)).not.toContain("Espera");
    expect(rotuloDaEspera(HORA, tr)).not.toContain("Espera");
  });
});
