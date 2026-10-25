/**
 * O EDITOR DE FAQ ABRE E SALVA NOS MARCADORES DO IDIOMA DA TELA.
 *
 * Antes, o editor escrevia `## Pergunta:`/`## Resposta:` para todo mundo. Em
 * turco, quem abria um FAQ guardado via português no campo; agora vê
 * `## Soru:`/`## Yanıt:`, e salvar devolve exatamente os mesmos itens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastErro = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => toastErro(m), info: vi.fn() },
}));

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiClient: api }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));

import { EditarFaqDialog } from "@/components/ai/EditarFaqDialog";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

const ITENS = [
  { question: "Teslimat süresi nedir?", answer: "2 ila 3 gün.", tags: [], locale: "tr" },
  { question: "Değişim var mı?", answer: "Evet.", tags: [], locale: "tr" },
];

function abrir(locale: string) {
  return render(
    <IdiomaProvider locale={locale}>
      <EditarFaqDialog sourceId="ks-1" nome="SSS" aberto onFechar={() => {}} onSalvo={() => {}} />
    </IdiomaProvider>,
  );
}

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: { items: ITENS } });
  api.patch.mockReset().mockResolvedValue({});
  toastErro.mockReset();
});
afterEach(cleanup);

const campo = () => screen.getByTestId("faq-editar-texto") as HTMLTextAreaElement;

describe("EditarFaqDialog × idioma", () => {
  it("tr: abre com ## Soru:/## Yanıt: e salvar devolve os mesmos itens", async () => {
    abrir("tr");
    await waitFor(() => expect(campo().value).toContain("## Soru: Teslimat süresi nedir?"));
    expect(campo().value).toContain("## Yanıt: 2 ila 3 gün.");
    expect(campo().value).not.toMatch(/Pergunta|Resposta/);
    expect(document.body.textContent).toContain("## Soru:");

    fireEvent.click(screen.getByTestId("faq-editar-salvar"));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const corpo = api.patch.mock.calls[0]?.[1] as { items: Array<{ question: string; answer: string }> };
    expect(corpo.items.map((i) => [i.question, i.answer])).toEqual([
      ["Teslimat süresi nedir?", "2 ila 3 gün."],
      ["Değişim var mı?", "Evet."],
    ]);
  });

  it("tr: o erro cita os marcadores em turco", async () => {
    abrir("tr");
    await waitFor(() => expect(campo().value).not.toBe(""));
    fireEvent.change(campo(), { target: { value: "sem marcador nenhum" } });
    fireEvent.click(screen.getByTestId("faq-editar-salvar"));
    await waitFor(() => expect(toastErro).toHaveBeenCalled());
    const msg = String(toastErro.mock.calls[0]?.[0]);
    expect(msg).toContain("## Soru:");
    expect(msg).toContain("## Yanıt:");
    expect(msg).not.toContain("Pergunta");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("pt-BR: igual a hoje", async () => {
    abrir("pt-BR");
    await waitFor(() =>
      expect(campo().value).toBe(
        "## Pergunta: Teslimat süresi nedir?\n## Resposta: 2 ila 3 gün.\n\n## Pergunta: Değişim var mı?\n## Resposta: Evet.",
      ),
    );
    fireEvent.change(campo(), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("faq-editar-salvar"));
    await waitFor(() =>
      expect(toastErro).toHaveBeenCalledWith(
        "Não achei nenhum par pergunta/resposta. Use uma linha ## Pergunta: e uma ## Resposta: por item.",
      ),
    );
  });
});
