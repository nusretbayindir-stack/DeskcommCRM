/**
 * O GRÁFICO DE CUSTO DE IA DO ADMIN DIZ A MOEDA DO NÚMERO.
 *
 * Medido na v1.85.2: Admin › Uso mostrava "Custo AI / dia (R$)". O número é
 * `llm_calls.cost_cents`, que `pricing.ts` cota em dólar, e o gráfico o formata
 * com `formatCentsUSD` — o rótulo dizia real sobre um valor em dólar, em todo
 * idioma. O gráfico de uso da tela de IA (`components/ai/UsageChart.tsx`) já
 * dizia "(US$)".
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UsageCharts } from "@/components/admin/usage/UsageCharts";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

// O recharts mede o contêiner, que o jsdom não tem; o título do card é o que se prova.
vi.mock("recharts", async (original) => ({
  ...(await original<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const SERIE = {
  messages: [],
  ai_cost: [{ date: "2026-10-20", cents: 125 }],
  ai_tokens: [],
} as unknown as Parameters<typeof UsageCharts>[0]["series"];

describe("o gráfico de custo de IA do admin", () => {
  it.each([
    ["pt-BR", "Custo AI / dia (US$)"],
    ["tr", "AI maliyeti / gün (US$)"],
  ])("em %s, o título diz dólar", (idioma, titulo) => {
    render(
      <IdiomaProvider locale={idioma}>
        <UsageCharts series={SERIE} />
      </IdiomaProvider>,
    );

    expect(screen.getByText(titulo)).toBeTruthy();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });
});
