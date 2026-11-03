import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O CONTADOR DE RESPOSTAS (migration 7001) LÊ PELO ÍNDICE, E O ÍNDICE CHEGA A
 * QUEM SÓ APLICA O BASELINE. A aba Clientes de /admin/cobranca chama
 * `fn_respostas_do_assistente_no_mes` uma vez por empresa a cada visita; sem
 * índice que sirva o filtro, cada chamada varre `messages` inteira — a maior
 * tabela de um CRM de WhatsApp. O índice é o da 0133
 * (`idx_messages_org_direction_sent`), que a cadeia tem e o baseline não tinha;
 * o filtro da função tem de ser o dele: organização, direção e `sent_at`.
 */
const RAIZ = join(process.cwd(), "supabase");
const MIGRATION = readFileSync(join(RAIZ, "migrations", "20261103170001_7001_cobranca_em_euro.sql"), "utf8");
const BASELINE = readFileSync(join(RAIZ, "baseline.sql"), "utf8");
const INDICE =
  /create index if not exists idx_messages_org_direction_sent\s+on public\.messages \(organization_id, direction, sent_at\);/;
const corpoDaFuncao = (sql: string) =>
  /create or replace function public\.fn_respostas_do_assistente_no_mes[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";

describe("fn_respostas_do_assistente_no_mes lê messages pelo índice", () => {
  it("a migration cria o índice", () => expect(MIGRATION).toMatch(INDICE));

  it("o baseline também: o self-host só aplica o baseline", () => expect(BASELINE).toMatch(INDICE));

  it("⭐ o filtro da função é o do índice: organização, direção e sent_at", () => {
    const corpo = corpoDaFuncao(MIGRATION);
    expect(corpo, "a função sumiu da migration").not.toBe("");
    expect(corpo).toMatch(/m\.organization_id = p_org/);
    expect(corpo).toMatch(/m\.direction in \('inbound', 'outbound'\)/);
    expect(corpo).toMatch(/m\.sent_at >= j\.desde - interval '7 days' and m\.sent_at < j\.ate/);
    expect(corpo).not.toMatch(/created_at/);
  });
});
