/**
 * A aba de Planos de /admin/cobranca (spec da cobrança §9): criar, editar,
 * arquivar e marcar o plano do cadastro, pelas rotas das Tasks 23 e 24. O
 * formulário recusa antes da rota o que o banco recusaria (preço < R$ 5).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), refresh: vi.fn(), erro: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: h.erro } }));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: h.post, patch: h.patch } }));

import { PlanosDaInstalacao, type PlanoDaTela } from "@/app/admin/(protected)/cobranca/_planos";

const PLANO: PlanoDaTela = {
  id: "cccccccc-0000-4000-8000-000000000001", nome: "Básico", preco_cents: 4990, intervalo: "mes", trial_dias: 14,
  max_assentos: 3, max_canais: null, teto_ia_usd_cents: null, padrao_no_cadastro: false, oferecido_ao_cliente: true, arquivado_em: null,
  moeda: "BRL", iva_percentual: 0, implantacao_cents: null, respostas_mes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.post.mockResolvedValue({ data: PLANO });
  h.patch.mockResolvedValue({ data: PLANO });
});
afterEach(cleanup);

async function preencher(u: ReturnType<typeof userEvent.setup>, preco: string) {
  await u.type(screen.getByLabelText("Nome do plano"), "Pro");
  await u.type(screen.getByLabelText("Preço (R$)"), preco);
  await u.clear(screen.getByLabelText("Dias de teste grátis"));
  await u.type(screen.getByLabelText("Dias de teste grátis"), "7");
  await u.type(screen.getByLabelText("Máximo de pessoas"), "5");
}

describe("Planos da instalação", () => {
  it("criar manda centavos e limites vazios como nulos, e recarrega a tela", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[]} />);
    await preencher(u, "99,90");
    await u.click(screen.getByRole("button", { name: "Salvar plano" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));
    expect(h.post).toHaveBeenCalledWith("/api/v1/admin/cobranca/planos", {
      nome: "Pro", preco_cents: 9990, intervalo: "mes", trial_dias: 7,
      max_assentos: 5, max_canais: null, teto_ia_usd_cents: null,
      // S4: em real, IVA 0 e sem implantação (o default da tabela); cota vazia = null.
      moeda: "BRL", iva_percentual: 0, implantacao_cents: null, respostas_mes: null,
    });
    expect(h.refresh).toHaveBeenCalled();
  });

  it("preço abaixo de R$ 5 não chega à rota", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[]} />);
    await preencher(u, "4,99");
    await u.click(screen.getByRole("button", { name: "Salvar plano" }));
    expect(h.post).not.toHaveBeenCalled();
    expect(h.erro).toHaveBeenCalled();
  });

  it("arquivar e usar no cadastro são PATCH do plano", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[PLANO]} />);
    await u.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith(`/api/v1/admin/cobranca/planos/${PLANO.id}`, { arquivado: true }));
    await u.click(screen.getByRole("button", { name: "Usar no cadastro" }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith(`/api/v1/admin/cobranca/planos/${PLANO.id}`, { padrao_no_cadastro: true }));
  });

  it("editar carrega o plano no formulário e salva por PATCH", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[PLANO]} />);
    await u.click(screen.getByRole("button", { name: "Editar" }));
    expect((screen.getByLabelText("Nome do plano") as HTMLInputElement).value).toBe("Básico");
    expect((screen.getByLabelText("Preço (R$)") as HTMLInputElement).value).toBe("49,90");
    await u.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledTimes(1));
    expect(h.patch.mock.calls[0]![0]).toBe(`/api/v1/admin/cobranca/planos/${PLANO.id}`);
    expect(h.patch.mock.calls[0]![1]).toMatchObject({ nome: "Básico", preco_cents: 4990, max_assentos: 3 });
  });
  it("⭐ esconder um plano das empresas é PATCH, e o plano escondido mostra que só o dono o atribui", async () => {
    const u = userEvent.setup();
    const { rerender } = render(<PlanosDaInstalacao planos={[PLANO]} />);
    await u.click(screen.getByRole("button", { name: "Esconder das empresas" }));
    await waitFor(() =>
      expect(h.patch).toHaveBeenCalledWith(`/api/v1/admin/cobranca/planos/${PLANO.id}`, { oferecido_ao_cliente: false }),
    );
    rerender(<PlanosDaInstalacao planos={[{ ...PLANO, oferecido_ao_cliente: false }]} />);
    expect(screen.getByText("Só você atribui")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mostrar às empresas" })).toBeTruthy();
  });
});

describe("Planos da instalação: o plano em euro (S4)", () => {
  const PLANO_EURO: PlanoDaTela = {
    ...PLANO, id: "cccccccc-0000-4000-8000-000000000002", nome: "Start", preco_cents: 7900,
    moeda: "EUR", iva_percentual: "21.00", implantacao_cents: 29900, respostas_mes: 300,
  };

  it("⭐ euro: o preço vira €, IVA e implantação aparecem, e o corpo leva moeda, IVA, implantação e cota", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[]} provedor="stripe" />);
    await u.type(screen.getByLabelText("Nome do plano"), "Start");
    await u.selectOptions(screen.getByLabelText("Moeda"), "EUR");
    await u.type(screen.getByLabelText("Preço (€)"), "79");
    await u.type(screen.getByLabelText("IVA (%)"), "21");
    await u.type(screen.getByLabelText("Implantação (taxa única, €)"), "299");
    await u.clear(screen.getByLabelText("Dias de teste grátis"));
    await u.type(screen.getByLabelText("Dias de teste grátis"), "0");
    await u.type(screen.getByLabelText("Respostas do assistente por mês"), "300");
    await u.click(screen.getByRole("button", { name: "Salvar plano" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledTimes(1));
    expect(h.post).toHaveBeenCalledWith("/api/v1/admin/cobranca/planos", {
      nome: "Start", preco_cents: 7900, intervalo: "mes", trial_dias: 0,
      max_assentos: null, max_canais: null, teto_ia_usd_cents: null,
      moeda: "EUR", iva_percentual: 21, implantacao_cents: 29900, respostas_mes: 300,
    });
  });

  it("em real, IVA e implantação não aparecem; a cota aparece nas duas moedas", () => {
    render(<PlanosDaInstalacao planos={[]} provedor="stripe" />);
    expect(screen.queryByLabelText("IVA (%)")).toBeNull();
    expect(screen.queryByLabelText("Implantação (taxa única, €)")).toBeNull();
    expect(screen.getByLabelText("Respostas do assistente por mês")).toBeTruthy();
  });

  it("⭐ Asaas conectado: a opção Euro fica fechada, com o porquê", () => {
    render(<PlanosDaInstalacao planos={[]} provedor="asaas" />);
    const euro = screen.getByRole("option", { name: "Euro (€)" }) as HTMLOptionElement;
    expect(euro.disabled).toBe(true);
    expect(screen.getByText("O Asaas só cobra em real. Para vender plano em euro, conecte a Stripe.")).toBeTruthy();
  });

  it("a lista mostra o plano em euro em €, com IVA, implantação e cota", () => {
    render(<PlanosDaInstalacao planos={[PLANO_EURO]} provedor="stripe" />);
    expect(screen.getByText(/€\s79,00/)).toBeTruthy();
    expect(screen.getByText(/IVA: 21%/)).toBeTruthy();
    expect(screen.getByText(/€\s299,00/)).toBeTruthy();
    expect(screen.getByText(/Respostas do assistente por mês: 300/)).toBeTruthy();
  });

  it("editar um plano em euro carrega moeda, IVA (o \"21.00\" do banco) e implantação", async () => {
    const u = userEvent.setup();
    render(<PlanosDaInstalacao planos={[PLANO_EURO]} provedor="stripe" />);
    await u.click(screen.getByRole("button", { name: "Editar" }));
    expect((screen.getByLabelText("Moeda") as HTMLSelectElement).value).toBe("EUR");
    expect((screen.getByLabelText("Preço (€)") as HTMLInputElement).value).toBe("79,00");
    expect((screen.getByLabelText("IVA (%)") as HTMLInputElement).value).toBe("21");
    expect((screen.getByLabelText("Implantação (taxa única, €)") as HTMLInputElement).value).toBe("299,00");
    expect((screen.getByLabelText("Respostas do assistente por mês") as HTMLInputElement).value).toBe("300");
  });
});
