/**
 * A FIAÇÃO DO IDIOMA NO PAINEL DE LACUNAS.
 *
 * `montaLacunas` e `boaNoticia` recebem o `t`; quem o entrega é este
 * componente. Sem isto, o turco ficaria provado nas funções e o painel seguiria
 * em português — que era o defeito (AI › Evolução na demo turca).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: unknown }) => (
    <a href={typeof href === "string" ? href : ""} {...(resto as object)}>
      {children as never}
    </a>
  ),
}));

import { EvolutionGaps } from "./EvolutionGaps";

const SEM_LACUNA = {
  pipelines_evaluated: 1,
  unmapped_agent_steps: [],
  knowledge_empty: 0,
  knowledge_near_misses: 0,
  router_no_match: 0,
  router_failed: 0,
};

describe("painel de lacunas em turco", () => {
  it("a lacuna e o botão saem em turco", () => {
    render(
      <IdiomaProvider locale="tr">
        <EvolutionGaps gaps={{ ...SEM_LACUNA, router_no_match: 2 }} buscas={5} decisoes={5} />
      </IdiomaProvider>,
    );

    expect(screen.getByRole("link").textContent).toBe("Yönlendiricileri aç");
    expect(screen.getByTestId("gaps-lista").textContent).not.toMatch(/conversas|atendimento padrão/);
  });

  it("a boa notícia também", () => {
    render(
      <IdiomaProvider locale="tr">
        <EvolutionGaps gaps={SEM_LACUNA} buscas={5} decisoes={5} />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId("gaps-vazio").textContent).not.toMatch(/Nada travando|toda pergunta/);
  });
});
