import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TestPanel } from "@/app/app/ai/agents/[id]/_components/TestPanel";
import tr from "@/lib/i18n/traducoes/tr.json";

const h = vi.hoisted(() => ({ post: vi.fn(), idioma: "tr" as "tr" | "pt-BR" }));

vi.mock("@/hooks/i18n/useT", () => ({
  useT: () => (texto: string) => (tr as Record<string, string>)[texto] ?? texto,
}));
vi.mock("@/lib/i18n/IdiomaProvider", () => ({ useIdioma: () => h.idioma }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: h.post } }));
vi.mock("@/hooks/contacts/useTelefoneExemplo", () => ({ useTelefoneExemplo: () => "+32 000" }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/**
 * FIAÇÃO: o `TestPanel` tem de passar os vetos e avisos pelos helpers de idioma.
 * Se alguém voltar a imprimir `x.message` cru, o português reaparece aqui.
 */
afterEach(cleanup);

describe("TestPanel mostra impedimentos e avisos no idioma do operador", () => {
  it("promise_semantic e outside_window saem em turco, sem o português do motor", async () => {
    h.post.mockResolvedValue({
      data: {
        run_id: "r1",
        status: "ok",
        candidates: [{ body: "oi", trace: [] }],
        warnings: [
          {
            code: "outside_window",
            reason: "fora da janela de resposta (9h-18h)",
            message: "Em produção esta resposta não sairia agora (fora da janela de resposta).",
          },
        ],
        impediments: [
          { code: "promise_semantic", message: 'frase suspeita: "amanhã" — isso é uma promessa' },
        ],
      },
    });
    const agent = { id: "a1" } as never;
    const versao = { id: "v1", status: "draft", version_number: 1 } as never;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TestPanel agent={agent} draft={versao} published={null} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(tr["Mensagem do cliente (sample)" as keyof typeof tr]), {
      target: { value: "oi" },
    });
    fireEvent.click(screen.getByRole("button", { name: tr["Executar teste" as keyof typeof tr] }));
    await waitFor(() => expect(h.post).toHaveBeenCalled());
    const aviso = await screen.findByTestId("teste-aviso-de-envio");
    expect(aviso.textContent).not.toMatch(/Em produção|janela/);
    expect(document.body.textContent).not.toMatch(/frase suspeita|isso é uma promessa/);
  });
});

describe("TestPanel em pt-BR mantem o detalhe do motor (v1.88.3 F5)", () => {
  it("mostra o message original do aviso e do impedimento", async () => {
    h.idioma = "pt-BR";
    h.post.mockResolvedValue({
      data: {
        run_id: "r1",
        status: "ok",
        candidates: [{ body: "oi", trace: [] }],
        warnings: [
          {
            code: "outside_window",
            reason: "fora da janela de resposta (9h-18h)",
            message: "Em produção esta resposta não sairia agora (fora da janela de resposta).",
          },
        ],
        impediments: [
          { code: "promise_semantic", message: 'frase suspeita: "amanhã" — isso é uma promessa' },
        ],
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TestPanel agent={{ id: "a1" } as never} draft={{ id: "v1", status: "draft", version_number: 1 } as never} published={null} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText(tr["Mensagem do cliente (sample)" as keyof typeof tr]), { target: { value: "oi" } });
    fireEvent.click(screen.getByRole("button", { name: tr["Executar teste" as keyof typeof tr] }));
    await waitFor(() => expect(h.post).toHaveBeenCalled());
    const aviso = await screen.findByTestId("teste-aviso-de-envio");
    expect(aviso.textContent).toBe("Em produção esta resposta não sairia agora (fora da janela de resposta).");
    expect(document.body.textContent).toContain('frase suspeita: "amanhã" — isso é uma promessa');
    h.idioma = "tr";
  });
});
