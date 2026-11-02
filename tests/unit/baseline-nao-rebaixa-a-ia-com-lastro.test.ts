/**
 * A RE-APLICAÇÃO DO BASELINE NÃO REBAIXA A IA QUE TEM LASTRO.
 *
 * O `update.sh` re-aplica o `baseline.sql` INTEIRO a cada atualização. O bloco
 * da 0071 tem uma "cura" (passo 6) que rebaixa para `'system'` toda atividade
 * `'ai'` sem lastro — e mede lastro só por `run_ids` e `trace_ids`. A 0072
 * passou a aceitar `llm_call_ids` na constraint, e é o ÚNICO lastro que o turno
 * do agente grava (`inbound-turn.ts` → `evidence: { llm_call_ids: [...] }`).
 *
 * ## O defeito que fez este arquivo existir
 *
 * Medido num clone real (01/11/2026): 38 de 38 linhas `ai_turn` estavam
 * `actor_kind = 'system'`, todas com `actor_agent_id` e com
 * `evidence = {"llm_call_ids": [...]}` — e nenhuma linha `'ai'` no banco
 * inteiro. O app grava `'ai'` (o lastro existe); cada `update.sh` rebaixava. A
 * tela de atividades dizia "Sistema" no lugar do assistente e contava
 * "Agentes: 0". As linhas de 01/11 apareciam com o nome do assistente até a
 * atualização daquela noite, e as de 31/10 já não — o rastro do rebaixamento.
 *
 * Ninguém via porque `test:db` re-aplica sobre banco VAZIO, e a cura "é no-op no
 * caminho feliz" — era, até existir um escritor cujo lastro é só `llm_call_ids`.
 *
 * ## A regra
 *
 * - Toda instrução que rebaixa `'ai'` → `'system'` por falta de lastro olha
 *   TODAS as chaves que a constraint final aceita — tiradas da constraint, para
 *   uma chave nova na constraint reprovar aqui até a cura aprender.
 * - O que já foi rebaixado volta, DEPOIS da cura corrigida: `'system'` com
 *   assistente, sem pessoa e com `llm_call_ids` é exatamente a forma que só o
 *   rebaixamento produz (`buildLeadActivityRow` não grava `'system'` com
 *   assistente E lastro). A prova com dados mora em
 *   `scripts/test-update-com-dados.sh`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const BASELINE = readFileSync(join(process.cwd(), "supabase/baseline.sql"), "utf8");

/** O SQL sem comentário de linha: comentário que cita SQL não é instrução. */
const SQL = BASELINE.split("\n")
  .map((linha) => linha.replace(/--.*$/, ""))
  .join("\n");

/** As instruções `update public.crm_lead_activities … ;`, com a posição de cada uma. */
function updatesDasAtividades(): Array<{ texto: string; pos: number }> {
  const out: Array<{ texto: string; pos: number }> = [];
  const re = /update\s+public\.crm_lead_activities\b[^;]*;/gi;
  for (let m = re.exec(SQL); m; m = re.exec(SQL)) {
    out.push({ texto: m[0].replace(/\s+/g, " "), pos: m.index });
  }
  return out;
}

/** As chaves de lastro da constraint que vale: a ÚLTIMA do arquivo. */
function chavesDaConstraintFinal(): string[] {
  const re = /add\s+constraint\s+crm_lead_activities_ai_needs_evidence\s+check\s*\(([\s\S]*?)\);/gi;
  let ultima: string | null = null;
  for (let m = re.exec(SQL); m; m = re.exec(SQL)) ultima = m[1]!;
  if (ultima === null) return [];
  return [...new Set([...ultima.matchAll(/evidence\s*->\s*'(\w+)'/g)].map((m) => m[1]!))];
}

const rebaixa = (t: string) =>
  /set actor_kind = 'system'/i.test(t) && /where actor_kind = 'ai'/i.test(t);
const devolve = (t: string) =>
  /set actor_kind = 'ai'/i.test(t) && /where actor_kind = 'system'/i.test(t);

describe("a re-aplicação do baseline não rebaixa a IA que tem lastro", () => {
  it("a constraint final aceita llm_call_ids (é o lastro que o turno grava)", () => {
    const chaves = chavesDaConstraintFinal();
    expect(chaves).toEqual(expect.arrayContaining(["run_ids", "trace_ids", "llm_call_ids"]));
  });

  it("⭐ toda cura que rebaixa 'ai' → 'system' olha todas as chaves que a constraint aceita", () => {
    const chaves = chavesDaConstraintFinal();
    const curas = updatesDasAtividades().filter((u) => rebaixa(u.texto));
    // Guarda de vacuidade: se a cura sumir ou mudar de forma, este teste tem de
    // ser revisto — e não passar verde sem medir nada.
    expect(curas.length).toBeGreaterThan(0);
    for (const cura of curas) {
      for (const chave of chaves) {
        expect(cura.texto, `a cura não olha evidence->'${chave}':\n${cura.texto}`).toContain(
          `evidence->'${chave}'`,
        );
      }
    }
  });

  it("o que já foi rebaixado volta — depois da última cura, e só na forma que o rebaixamento produz", () => {
    const updates = updatesDasAtividades();
    const ultimaCura = Math.max(...updates.filter((u) => rebaixa(u.texto)).map((u) => u.pos));
    const volta = updates.filter((u) => devolve(u.texto));

    expect(volta).toHaveLength(1);
    const [v] = volta;
    expect(v!.pos).toBeGreaterThan(ultimaCura);
    expect(v!.texto).toMatch(/actor_agent_id is not null/i);
    expect(v!.texto).toMatch(/performed_by_user_id is null/i);
    expect(v!.texto).toContain("evidence->'llm_call_ids'");
  });
});
