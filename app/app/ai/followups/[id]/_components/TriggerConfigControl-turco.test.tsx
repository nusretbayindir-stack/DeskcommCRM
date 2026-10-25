/**
 * O RESUMO DO GATILHO NO IDIOMA DE QUEM OPERA.
 *
 * Medido no construtor da demo turca: "Tetikleyici: Sessizlik (1440 min)". O
 * rótulo e a palavra passavam por `t()`, a unidade não — ela era escrita no
 * template. O irmão `TriggerConfigControl-silencio.test.tsx` troca o `useT` por
 * identidade; aqui o provider é o de verdade, em turco, para medir a fiação.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

const getMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    patch: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { TriggerConfigControl } from "./TriggerConfigControl";

/** Identificador SINTÉTICO. Fixture nunca copia id do banco — ver `tests/unit/sem-identificador-de-producao.test.ts`. */
const FLUXO = "66666666-6666-4666-8666-666666666666";

function montar(idioma: string, triggerConfig: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <IdiomaProvider locale={idioma}>
      <QueryClientProvider client={client}>
        <TriggerConfigControl flowId={FLUXO} triggerConfig={triggerConfig} />
      </QueryClientProvider>
    </IdiomaProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue({ data: [] });
});

describe("resumo do gatilho de silêncio em turco", () => {
  it("o limiar sai em «dk»", () => {
    montar("tr", { kind: "silence", params: { threshold_minutes: 1440 } });

    const botao = screen.getByTestId("trigger-config-button");
    expect(botao.textContent).toContain("(1440 dk)");
    expect(botao.textContent).not.toMatch(/\bmin\b/);
  });

  it("a faixa com teto também", () => {
    montar("tr", { kind: "silence", params: { threshold_minutes: 60, max_silence_minutes: 240 } });

    expect(screen.getByTestId("trigger-config-button").textContent).toContain("(60–240 dk)");
  });

  it("português: continua «min»", () => {
    montar("pt-BR", { kind: "silence", params: { threshold_minutes: 1440 } });

    expect(screen.getByTestId("trigger-config-button").textContent).toContain("(1440 min)");
  });
});
