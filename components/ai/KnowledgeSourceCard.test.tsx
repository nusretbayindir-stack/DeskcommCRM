/**
 * O CARTÃO DO ACERVO oferece ABRIR O MATERIAL (#3059).
 *
 * A ação de ler o conteúdo não existia: o cartão só tinha "Ver o que ele
 * aprendeu" (os pedaços do índice), e a equipe mantinha um sistema externo para
 * consultar o que já estava guardado aqui. O que este arquivo mede é a porta:
 * com endereço, o cartão linka; SEM endereço, ele não promete nada — controle
 * que não leva a lugar nenhum gasta a confiança de quem clicou, e o cartão é
 * usado em telas que não são o acervo.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";

import { KnowledgeSourceCard } from "./KnowledgeSourceCard";

vi.mock("next/link", () => ({
  // Props repassadas: o dublê que só conhece `href`/`children` apaga o
  // `data-testid` do link e o teste passa a medir o dublê, não o cartão.
  default: ({ href, children, ...resto }: { href: string; children: unknown }) => (
    <a href={typeof href === "string" ? href : ""} {...(resto as object)}>
      {children as never}
    </a>
  ),
}));

const FONTE = "66666666-6666-4666-8666-666666666666";

const MATERIAL: SourceRow = {
  id: FONTE,
  agent_id: null,
  organization_id: "22222222-2222-4222-8222-222222222222",
  source_type: "documento",
  name: "Política de troca",
  status: "ready",
  last_index_status: "success",
  last_index_error: null,
  last_indexed_at: "2026-10-21T12:00:00.000Z",
  chunks_count: 3,
  is_active: true,
  source_metadata: {},
  active_kb_version_id: "77777777-7777-4777-8777-777777777777",
  created_at: "2026-10-20T12:00:00.000Z",
  updated_at: "2026-10-21T12:00:00.000Z",
};

function montar(href?: string) {
  return render(
    <IdiomaProvider locale="pt-BR">
      <KnowledgeSourceCard
        source={MATERIAL}
        usadoPor={[]}
        href={href}
        onReindex={vi.fn()}
        onArquivar={vi.fn()}
        onMudou={vi.fn()}
      />
    </IdiomaProvider>,
  );
}

describe("abrir o material pelo cartão (#3059)", () => {
  it("com endereço, a ação de ler aponta para a página do material", () => {
    montar("/app/ai/knowledge/sources/" + FONTE);

    const abrir = screen.getByTestId(`material-abrir-${FONTE}`);
    expect(abrir.getAttribute("href")).toBe(`/app/ai/knowledge/sources/${FONTE}`);
    expect(abrir.textContent).toContain("Ler o material");
    // O nome do material também é porta: quem olha a grade clica no título.
    expect(screen.getByTestId(`material-abrir-nome-${FONTE}`).getAttribute("href")).toBe(
      `/app/ai/knowledge/sources/${FONTE}`,
    );
  });

  it("sem endereço, o cartão não oferece a ação", () => {
    montar();

    expect(screen.queryByTestId(`material-abrir-${FONTE}`)).toBeNull();
    expect(screen.getByText("Política de troca")).toBeTruthy();
  });
});

/**
 * A hora da última leitura sai no idioma de quem opera. "há 3 d" aparecia em
 * português na grade turca: só "agora há pouco" e "nunca" passavam por `t()`.
 * O português fica byte a byte o mesmo de antes.
 */
describe("a hora da última leitura no idioma de quem opera", () => {
  const MINUTO = 60_000;

  function montarLidoHa(idioma: string, msAtras: number) {
    return render(
      <IdiomaProvider locale={idioma}>
        <KnowledgeSourceCard
          source={{ ...MATERIAL, last_indexed_at: new Date(Date.now() - msAtras).toISOString() }}
          usadoPor={[]}
          onReindex={vi.fn()}
          onArquivar={vi.fn()}
          onMudou={vi.fn()}
        />
      </IdiomaProvider>,
    );
  }

  it.each([
    [5 * MINUTO, "5 dk önce"],
    [3 * 60 * MINUTO, "3 sa önce"],
    [3 * 24 * 60 * MINUTO, "3 gün önce"],
  ])("turco: %i ms atrás vira «%s»", (msAtras, esperado) => {
    montarLidoHa("tr", msAtras);

    expect(screen.getByText(esperado)).toBeTruthy();
    expect(screen.queryByText(/^há /)).toBeNull();
  });

  it("espanhol: «hace 3 d»", () => {
    montarLidoHa("es", 3 * 24 * 60 * MINUTO);

    expect(screen.getByText("hace 3 d")).toBeTruthy();
  });

  it("português: continua «há 3 d»", () => {
    montarLidoHa("pt-BR", 3 * 24 * 60 * MINUTO);

    expect(screen.getByText("há 3 d")).toBeTruthy();
  });
});
