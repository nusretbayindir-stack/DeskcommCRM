import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BasesDoAgente } from "@/app/app/ai/agents/[id]/_components/BasesDoAgente";
import type { MaterialDoAcervo } from "@/app/app/ai/agents/[id]/_components/BasesDoAgente";
import { lerConteudoDoMaterial } from "@/lib/ai/knowledge/conteudo-do-material";
import { rotulosDoTrechoNoIdioma } from "@/lib/ai/rag/ingest/rotulos-de-trecho";

/**
 * O MATERIAL NO IDIOMA DA TELA (v1.88.3, onda final F1).
 *
 * Duas superficies ainda mostravam portugues a quem usa a tela em turco:
 *  - o conteudo do material de conversas (`Cliente:`/`Atendente:` do indexador);
 *  - o nome do material criado pelo sistema, na lista "Bases" do assistente.
 * So a exibicao muda: o trecho guardado e o nome gravado ficam como estao.
 */

const VERSAO = "77777777-7777-4777-8777-777777777777";

function supabaseFalso(fonte: Record<string, unknown>, trechos: Record<string, unknown>[]) {
  const resultado = (tabela: string) => {
    if (tabela === "ai_knowledge_sources") return { data: fonte, error: null };
    if (tabela === "ai_chunks") return { data: trechos, error: null };
    return { data: [], error: null, count: 0 };
  };
  const cadeia = (tabela: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => resultado(tabela),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resultado(tabela)).then(resolve),
    };
    return q;
  };
  return { from: (tabela: string) => cadeia(tabela) } as never;
}

const FONTE_DE_CONVERSAS = {
  id: "s1",
  name: "Conversas anteriores",
  source_type: "conversas",
  source_metadata: { criada_automaticamente: true },
  active_kb_version_id: VERSAO,
  chunks_count: 2,
};

const TRECHOS = [
  { content: "Cliente: oi\nAtendente: ola", metadata: { source_type: "conversas" } },
  { content: "Cliente: preco?\nAtendente: 10", metadata: { source_type: "conversas" } },
];

describe("lerConteudoDoMaterial no idioma da tela", () => {
  it("tr: traduz os rotulos de cada trecho ANTES de juntar", async () => {
    const r = await lerConteudoDoMaterial(supabaseFalso(FONTE_DE_CONVERSAS, TRECHOS), {
      orgId: "o1",
      sourceId: "s1",
      idioma: "tr",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.material.conteudo).toBe(
      "Müşteri: oi\nTemsilci: ola\n\nMüşteri: preco?\nTemsilci: 10",
    );
    expect(r.material.criadaAutomaticamente).toBe(true);
  });

  it("pt-BR (e sem idioma): conteudo identico ao guardado", async () => {
    const esperado = "Cliente: oi\nAtendente: ola\n\nCliente: preco?\nAtendente: 10";
    for (const idioma of ["pt-BR" as const, undefined]) {
      const r = await lerConteudoDoMaterial(supabaseFalso(FONTE_DE_CONVERSAS, TRECHOS), {
        orgId: "o1",
        sourceId: "s1",
        idioma,
      });
      expect(r.ok && r.material.conteudo).toBe(esperado);
    }
  });

  it("FAQ sem pares: usa o tipo do trecho (faq) com marcadores do idioma", async () => {
    const r = await lerConteudoDoMaterial(
      supabaseFalso(
        { ...FONTE_DE_CONVERSAS, source_type: "faq", source_metadata: {} },
        [{ content: "Pergunta: prazo?\nResposta: 2 dias", metadata: { source_type: "faq" } }],
      ),
      { orgId: "o1", sourceId: "s1", idioma: "tr" },
    );
    expect(r.ok && r.material.conteudo).toBe("Soru: prazo?\nCevap: 2 dias");
    expect(r.ok && r.material.criadaAutomaticamente).toBe(false);
  });
});

describe("rotulos-de-trecho", () => {
  it("vive no modulo proprio", () => {
    expect(rotulosDoTrechoNoIdioma("Cliente: a", "tr", "conversas")).toBe("Müşteri: a");
  });
});

const baseMaterial = (p: Partial<MaterialDoAcervo> & { id: string; name: string }): MaterialDoAcervo => ({
  source_type: "conversas",
  chunks_count: 3,
  last_index_status: "ready",
  ...p,
});

vi.mock("@/hooks/i18n/useT", async () => {
  const { traduzir } = await import("@/lib/i18n/dicionario");
  return { useT: () => (texto: string) => traduzir(texto, (globalThis as { __idioma?: "tr" | "pt-BR" }).__idioma ?? "pt-BR") };
});

describe("BasesDoAgente: nome do material criado pelo sistema", () => {
  const lista = [
    baseMaterial({ id: "auto", name: "Conversas anteriores", source_metadata: { criada_automaticamente: true } }),
    baseMaterial({ id: "manual", name: "Conversas anteriores", source_metadata: {} }),
  ];

  it("tr: traduz so o criado automaticamente", () => {
    (globalThis as { __idioma?: string }).__idioma = "tr";
    render(<BasesDoAgente materiais={lista} value={[]} onChange={() => {}} />);
    expect(screen.getByTestId("base-auto").getAttribute("aria-label")).not.toBe("Conversas anteriores");
    expect(screen.getByTestId("base-manual").getAttribute("aria-label")).toBe("Conversas anteriores");
  });

  it("pt-BR: nome como gravado", () => {
    (globalThis as { __idioma?: string }).__idioma = "pt-BR";
    render(<BasesDoAgente materiais={lista} value={[]} onChange={() => {}} />);
    expect(screen.getByTestId("base-auto").getAttribute("aria-label")).toBe("Conversas anteriores");
  });
});
