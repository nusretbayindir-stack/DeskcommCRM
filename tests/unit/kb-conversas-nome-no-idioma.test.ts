// @vitest-environment node
/**
 * A FONTE "CONVERSAS ANTERIORES" NASCE COM O NOME NO IDIOMA DA EMPRESA.
 *
 * O nome era gravado em português para todas as organizações, e o cartão do
 * acervo o mostrava assim. Agora quem cria a fonte usa `organizations.locale`.
 * Fontes já gravadas não mudam: o cartão as traduz na hora de mostrar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  locale: "pt-BR" as string | null,
  inseridos: [] as Array<Record<string, unknown>>,
}));

function cadeia(tabela: string) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "is", "or", "in"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: tabela === "organizations" ? { locale: deps.locale } : null });
  c.insert = (linha: Record<string, unknown>) => {
    deps.inseridos.push(linha);
    return { select: () => ({ single: async () => ({ data: { id: "fonte-nova" }, error: null }) }) };
  };
  c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
  return c;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: cadeia }) }));
vi.mock("@/lib/ai/embeddings/chave", () => ({
  resolverChaveDeEmbedding: async () => ({ provedor: "openai" }),
  modeloDeEmbedding: () => "text-embedding-3-small",
}));
vi.mock("@/lib/ai/embed", () => ({ embedText: vi.fn() }));
vi.mock("@/lib/ai/rag/version", () => ({
  createKnowledgeVersion: vi.fn(),
  markVersionReady: vi.fn(),
  activateVersion: vi.fn(),
  markVersionFailed: vi.fn(),
}));
vi.mock("@/lib/legal/perfil-do-pais", () => ({ perfilDaOrganizacao: vi.fn() }));
vi.mock("@/lib/ai/anonymize", () => ({
  anonymize: (t: string) => ({ anonymized: t, hits: [] }),
  detectResidualPii: () => null,
  padroesDaIngestao: () => ({}),
}));

import { ingestConversationsBatch } from "@/lib/ai/rag/ingest/conversations";

const args = { organizationId: "org-1", agentId: "ag-1", sinceTs: new Date() };

beforeEach(() => {
  deps.inseridos = [];
  deps.locale = "pt-BR";
});

describe("nome da fonte de conversas", () => {
  it("empresa em turco: nome em turco, ainda marcada como criada automaticamente", async () => {
    deps.locale = "tr";
    await ingestConversationsBatch(args);
    expect(deps.inseridos).toHaveLength(1);
    expect(deps.inseridos[0]).toMatchObject({
      name: "Önceki konuşmalar",
      source_metadata: expect.objectContaining({ criada_automaticamente: true }),
    });
  });

  it("empresa em pt-BR: o nome de sempre", async () => {
    await ingestConversationsBatch(args);
    expect(deps.inseridos[0]).toMatchObject({ name: "Conversas anteriores" });
  });
});
