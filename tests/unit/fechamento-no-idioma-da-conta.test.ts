import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { instrucaoDeIdiomaDoFechamento } from "@/lib/agent-engine/agent/abertura/checkpoint";
import { IDIOMAS } from "@/lib/i18n/idiomas";

/**
 * U23, segundo assunto (demo de 31/10/2026, conta em turco): as notas do turno
 * saíam em português ou misturadas — "Sonraki adım: Aguardar resposta de Nusret
 * sobre ilçe, metrekare…". O texto é do MODELO, escrito no fechamento do turno
 * (`CHECKPOINT_INSTRUCTION`, em português e sem dizer o idioma da saída). Ele
 * aparece na linha do tempo do negócio, na próxima ação do quadro e no resumo da
 * passagem para humano — tudo lido pelo dono, na língua da conta.
 *
 * Português fica byte a byte como era: nenhuma mensagem a mais.
 */
describe("instrucaoDeIdiomaDoFechamento", () => {
  it("conta em português: nada a acrescentar (o fechamento continua como era)", () => {
    expect(instrucaoDeIdiomaDoFechamento("pt-BR")).toBeNull();
  });

  it("conta em turco: pede os textos do JSON em turco e mantém os nomes dos campos", () => {
    const frase = instrucaoDeIdiomaDoFechamento("tr");
    expect(frase).toContain("Türkçe");
    expect(frase).toContain("next_action");
    expect(frase).toMatch(/nomes dos campos/);
  });

  it("conta em espanhol: pede espanhol", () => {
    expect(instrucaoDeIdiomaDoFechamento("es")).toContain("español");
  });

  it("todo idioma da tela que não é português tem frase (idioma novo não cai em português calado)", () => {
    for (const idioma of IDIOMAS.filter((i) => i !== "pt-BR")) {
      expect(instrucaoDeIdiomaDoFechamento(idioma), idioma).not.toBeNull();
    }
  });
});

describe("inbound-turn manda a frase do idioma junto do fechamento", () => {
  const fonte = readFileSync("lib/agent-engine/agent/inbound-turn.ts", "utf8");

  // ANTES da instrução, e não depois: a cerca de `fechamento-do-turno-corrige-
  // antes-de-repetir` exige a correção colada em CHECKPOINT_INSTRUCTION.
  it("a frase vem logo ANTES de CHECKPOINT_INSTRUCTION, só quando existe", () => {
    expect(fonte).toMatch(
      /\.\.\.\(fraseDoIdiomaDoFechamento\s*\?\s*\[\{\s*role:\s*'user' as const, content: fraseDoIdiomaDoFechamento \}\]\s*:\s*\[\]\),\s*\{ role: 'user', content: CHECKPOINT_INSTRUCTION \},\s*\.\.\.correcao,/,
    );
  });

  it("o idioma vem da conta (idiomaDaOrgPeloPg), não do modelo nem do cliente", () => {
    expect(fonte).toMatch(/instrucaoDeIdiomaDoFechamento\(\s*await idiomaDaOrgPeloPg\(pool, tenantId\)/);
  });
});
