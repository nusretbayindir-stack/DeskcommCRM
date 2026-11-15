/**
 * U53, tela — o detalhe do pedido do titular (origem, como chegou, para onde
 * vai, avisos, aprovação da exclusão sem e-mail, os dois fechamentos) e o
 * rótulo "Encerrado" na lista.
 *
 * Os ganchos de dados são trocados por dublês (`vi.mock`): o que se mede aqui é
 * a TELA — o que aparece, o que fica desligado e o corpo que sai. A ordem das
 * duas chamadas do `useEncerrarPedido` tem teste próprio, no fim, com o
 * `apiClient` trocado e o gancho de verdade.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/types";
import type { useEncerrarPedido as useEncerrarPedidoReal } from "@/hooks/useEncerrarPedido";
import type { PainelDoPedido } from "@/lib/lgpd/painel-do-pedido";

const deps = vi.hoisted(() => ({
  detalhe: vi.fn(),
  lista: vi.fn(),
  aprovar: vi.fn(),
  encerrar: vi.fn(),
  copiar: vi.fn(),
  success: vi.fn(),
  erro: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/hooks/useLgpdRequest", () => ({ useLgpdRequest: deps.detalhe }));
vi.mock("@/hooks/useLgpdRequests", () => ({ useLgpdRequests: deps.lista }));
vi.mock("@/hooks/useApproveLgpdRequest", () => ({
  useApproveLgpdRequest: () => ({ mutate: deps.aprovar, isPending: false }),
}));
vi.mock("@/hooks/useEncerrarPedido", () => ({
  useEncerrarPedido: () => ({ mutate: deps.encerrar, isPending: false }),
}));
vi.mock("@/hooks/useLgpdPreview", () => ({
  useLgpdPreview: () => ({ isLoading: false, data: null, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/api/client", () => ({ apiClient: { post: deps.post, get: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: deps.success, error: deps.erro, info: vi.fn(), warning: vi.fn() } }));
// Componente de cliente copia pelo helper do repo (lib/clipboard.test.ts proíbe navigator.clipboard cru).
vi.mock("@/lib/clipboard", () => ({ copyToClipboard: deps.copiar }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));

import { LgpdRequestDetail } from "@/app/app/lgpd/requests/[id]/_client";
import { RequestsTable } from "@/app/app/lgpd/requests/RequestsTable";

const PEDIDO = "aaaaaaaa-0000-4000-8000-000000000001";

function painel(extra: Partial<PainelDoPedido> = {}): PainelDoPedido {
  return {
    abertura: null,
    destino_do_relatorio: null,
    art15_vazio: false,
    acesso_aberto: false,
    exclusao_sem_email: false,
    mensagem_de_exclusao: null,
    conversa_href: null,
    aviso_por_email_disponivel: false,
    encerramento: null,
    entrega_manual: null,
    recusa_pronta: null,
    ...extra,
  };
}

function pedido(extra: Record<string, unknown> = {}) {
  return {
    id: PEDIDO,
    organization_id: "o",
    request_type: "data_request",
    source: "manual",
    contact_id: "c1",
    external_customer_id: null,
    status: "received",
    attempts: 0,
    received_at: "2026-11-10T10:00:00.000Z",
    due_at: "2026-11-17T00:00:00.000Z",
    completed_at: null,
    emergency: false,
    scope: "contact",
    error_message: null,
    sla_bucket: "ok",
    request_payload: {},
    result: null,
    created_at: "2026-11-10T10:00:00.000Z",
    updated_at: "2026-11-10T10:00:00.000Z",
    ...extra,
  };
}

function abrirDetalhe(
  req: Record<string, unknown> = {},
  p: Partial<PainelDoPedido> | null = {},
  titular = { nome: "Cliente Teste", email_destino: null as string | null },
) {
  deps.detalhe.mockReturnValue({
    isLoading: false,
    error: null,
    data: {
      data: {
        request: pedido(req),
        audit_trail: [],
        signed_pdf_url: null,
        signed_json_url: null,
        titular,
        ...(p === null ? {} : { painel: painel(p) }),
      },
    },
  });
  return render(<LgpdRequestDetail id={PEDIDO} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.copiar.mockResolvedValue(true);
});

function usuario() {
  return userEvent.setup();
}
afterEach(cleanup);

describe("origem e estado", () => {
  it("rótulo da origem traduzido: 'Pelo painel' no lugar de 'manual'", () => {
    abrirDetalhe({ source: "manual" });
    expect(screen.getByText("Pelo painel")).toBeTruthy();
    expect(screen.queryByText("manual")).toBeNull();
  });

  it("'Encerrado' no lugar de 'Falhou' quando o responsável encerrou", () => {
    abrirDetalhe(
      { status: "failed", error_message: "encerrado_pelo_responsavel" },
      { encerramento: { motivo_codigo: "duplicado", nota: "Mesmo pedido de ontem", em: "2026-11-11T10:00:00.000Z" } },
    );
    expect(screen.getAllByText("Encerrado").length).toBeGreaterThan(0);
    expect(screen.queryByText("Falhou")).toBeNull();
    // a marca interna não vira "erro" vermelho na tela
    expect(screen.queryByText("encerrado_pelo_responsavel")).toBeNull();
    expect(screen.getByText("Pedido duplicado")).toBeTruthy();
    expect(screen.getByText("Mesmo pedido de ontem")).toBeTruthy();
  });

  it("falha de verdade continua 'Falhou' (só a marca do responsável vira 'Encerrado')", () => {
    abrirDetalhe({ status: "failed", error_message: "smtp caiu" });
    expect(screen.getAllByText("Falhou").length).toBeGreaterThan(0);
    expect(screen.queryByText("Encerrado")).toBeNull();
  });

  it("a lista mostra 'Encerrado' no lugar de 'Falhou' para o pedido fechado pelo responsável", () => {
    deps.lista.mockReturnValue({
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
      data: {
        data: [
          pedido({ id: "bbbbbbbb-0000-4000-8000-000000000002", status: "failed", error_message: "encerrado_pelo_responsavel" }),
          pedido({ id: "cccccccc-0000-4000-8000-000000000003", status: "failed", error_message: "smtp caiu" }),
        ],
        meta: { total: 2, page: 1, limit: 25, has_more: false },
      },
    });
    render(<RequestsTable />);
    const linhas = screen.getAllByRole("row");
    expect(within(linhas[1]!).getByText("Encerrado")).toBeTruthy();
    expect(within(linhas[1]!).queryByText("Falhou")).toBeNull();
    expect(within(linhas[2]!).getByText("Falhou")).toBeTruthy();
  });
});

describe("como chegou e para onde vai", () => {
  it("mostra como chegou e para onde vai o relatório", () => {
    abrirDetalhe(
      {},
      {
        abertura: {
          canal: "email_registrado",
          observacao: "Escreveu pelo site",
          criado_por_nome: "Maria Atendente",
          criado_em: "2026-11-10T10:30:00.000Z",
        },
        destino_do_relatorio: "cliente@loja.test",
      },
    );
    expect(screen.getByText("Como o pedido chegou")).toBeTruthy();
    expect(screen.getByText("Pelo e-mail cadastrado")).toBeTruthy();
    expect(screen.getByText("Maria Atendente")).toBeTruthy();
    expect(screen.getByText("Escreveu pelo site")).toBeTruthy();
    expect(screen.getByText("Para onde vai o relatório")).toBeTruthy();
    expect(screen.getByText("cliente@loja.test")).toBeTruthy();
  });

  it("sem e-mail, diz que o relatório é entregue à mão; exclusão não tem esta seção", () => {
    const { unmount } = abrirDetalhe({}, { destino_do_relatorio: null });
    expect(screen.getByText("Sem e-mail cadastrado; o relatório será entregue à mão.")).toBeTruthy();
    unmount();
    abrirDetalhe({ request_type: "redact" }, {});
    expect(screen.queryByText("Para onde vai o relatório")).toBeNull();
  });

  it("painel que faltou não derruba a tela nem acusa nada", () => {
    abrirDetalhe({}, null);
    expect(screen.getByText("Detalhes")).toBeTruthy();
    expect(screen.queryByText("Abrir configurações")).toBeNull();
  });
});

describe("avisos antes de aprovar", () => {
  it("aviso do art. 15 com link para as configurações", () => {
    abrirDetalhe({}, { art15_vazio: true });
    expect(screen.getByText(/finalidades, destinatários, prazo de conservação/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir configurações" })).toHaveAttribute("href", "/app/settings/tenant");
  });

  it("aviso de acesso aberto na exclusão", () => {
    abrirDetalhe({ request_type: "redact" }, { acesso_aberto: true });
    expect(screen.getByText(/Este contato tem um pedido de acesso aberto/)).toBeTruthy();
  });

  it("sem os avisos ligados, nenhum aparece", () => {
    abrirDetalhe({ request_type: "redact" }, {});
    expect(screen.queryByText(/pedido de acesso aberto/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Abrir configurações" })).toBeNull();
  });
});

describe("aprovação da exclusão", () => {
  const MENSAGEM = "A seu pedido, os seus dados serão apagados hoje.";

  it("exclusão sem e-mail: mensagem pronta, copiar e confirmação obrigatória", async () => {
    const user = usuario();
    abrirDetalhe(
      { request_type: "redact" },
      { exclusao_sem_email: true, mensagem_de_exclusao: MENSAGEM, conversa_href: "/app/inbox/conv-1" },
    );
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    const janela = screen.getByRole("alertdialog");
    const confirmar = within(janela).getByRole("button", { name: "Confirmar aprovação" }) as HTMLButtonElement;

    expect(within(janela).getByDisplayValue(MENSAGEM)).toHaveAttribute("readonly");
    expect(within(janela).getByRole("link", { name: "Abrir a conversa" })).toHaveAttribute("href", "/app/inbox/conv-1");
    expect(confirmar.disabled).toBe(true);

    await user.type(within(janela).getByLabelText(/Justificativa/), "Pedido confirmado por telefone");
    expect(confirmar.disabled).toBe(true); // a justificativa sozinha não basta

    await user.click(within(janela).getByRole("button", { name: "Copiar" }));
    expect(deps.copiar).toHaveBeenCalledWith(MENSAGEM);
    expect(deps.success).toHaveBeenCalledWith("Copiado");

    await user.click(within(janela).getByLabelText("Enviei a mensagem"));
    expect(confirmar.disabled).toBe(false);
    await user.click(confirmar);

    expect(deps.aprovar).toHaveBeenCalledWith(
      { id: PEDIDO, approved_reason: "Pedido confirmado por telefone", aviso_whatsapp_enviado: true },
      expect.anything(),
    );
  });

  it("cópia que falha avisa a equipe para copiar à mão", async () => {
    deps.copiar.mockResolvedValueOnce(false);
    const user = usuario();
    abrirDetalhe({ request_type: "redact" }, { exclusao_sem_email: true, mensagem_de_exclusao: MENSAGEM });
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Copiar" }));

    expect(deps.success).not.toHaveBeenCalled();
    expect(deps.erro).toHaveBeenCalledWith("Não deu para copiar. Selecione o texto e copie à mão.");
  });

  it("'Enviei a mensagem' volta desmarcado quando a janela é cancelada e reaberta", async () => {
    const user = usuario();
    abrirDetalhe({ request_type: "redact" }, { exclusao_sem_email: true, mensagem_de_exclusao: MENSAGEM });
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    let janela = screen.getByRole("alertdialog");
    await user.type(within(janela).getByLabelText(/Justificativa/), "Pedido confirmado por telefone");
    await user.click(within(janela).getByLabelText("Enviei a mensagem"));
    expect((within(janela).getByLabelText("Enviei a mensagem") as HTMLInputElement).checked).toBe(true);

    await user.click(within(janela).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    janela = screen.getByRole("alertdialog");

    // A justificativa pode ficar; a marca atesta um envio e precisa ser feita de novo.
    expect((within(janela).getByLabelText("Enviei a mensagem") as HTMLInputElement).checked).toBe(false);
    expect((within(janela).getByRole("button", { name: "Confirmar aprovação" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("aprovação recusada mostra o motivo do servidor, não um erro genérico", async () => {
    // Painel neutro (montagem falhou): a caixa some, mas o servidor cobra a marca.
    const motivo = "Envie a mensagem pelo WhatsApp e marque a confirmação antes de aprovar.";
    deps.aprovar.mockImplementationOnce((_corpo: unknown, opcoes: { onError?: (e: unknown) => void }) =>
      opcoes.onError?.(new ApiError(422, "aviso_whatsapp_obrigatorio", undefined, "req-422", motivo)),
    );
    const user = usuario();
    abrirDetalhe({ request_type: "redact" }, { exclusao_sem_email: false });
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    const janela = screen.getByRole("alertdialog");
    await user.type(within(janela).getByLabelText(/Justificativa/), "Pedido confirmado por telefone");
    await user.click(within(janela).getByRole("button", { name: "Confirmar aprovação" }));

    expect(deps.erro).toHaveBeenCalledWith(motivo, expect.anything());
    expect(deps.erro).not.toHaveBeenCalledWith("Falha ao aprovar a solicitação. Tente novamente.");
  });

  it("sem a regra ligada, o bloco não existe e o corpo não leva o campo do aviso", async () => {
    const user = usuario();
    abrirDetalhe({ request_type: "redact" }, { exclusao_sem_email: false });
    await user.click(screen.getByRole("button", { name: "Aprovar anonimização" }));
    const janela = screen.getByRole("alertdialog");
    expect(within(janela).queryByLabelText("Enviei a mensagem")).toBeNull();
    await user.type(within(janela).getByLabelText(/Justificativa/), "Pedido confirmado por telefone");
    await user.click(within(janela).getByRole("button", { name: "Confirmar aprovação" }));
    expect(deps.aprovar).toHaveBeenCalledWith(
      { id: PEDIDO, approved_reason: "Pedido confirmado por telefone" },
      expect.anything(),
    );
  });
});

describe("fechar o pedido", () => {
  it("'Marcar como entregue' só em pending_review; 'Encerrar com motivo' só em received", () => {
    const { unmount } = abrirDetalhe({ status: "pending_review" });
    expect(screen.getByRole("button", { name: "Marcar como entregue" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Encerrar com motivo" })).toBeNull();
    unmount();

    const segunda = abrirDetalhe({ status: "received" });
    expect(screen.getByRole("button", { name: "Encerrar com motivo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marcar como entregue" })).toBeNull();
    segunda.unmount();

    abrirDetalhe({ status: "processing" });
    expect(screen.queryByRole("button", { name: "Encerrar com motivo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Marcar como entregue" })).toBeNull();
  });

  it("marcar como entregue manda a observação e nada de e-mail", async () => {
    const user = usuario();
    abrirDetalhe({ status: "pending_review" });
    await user.click(screen.getByRole("button", { name: "Marcar como entregue" }));
    const janela = screen.getByRole("alertdialog");
    await user.type(within(janela).getByLabelText("Observação da entrega"), "Levei em mãos");
    await user.click(within(janela).getByRole("button", { name: "Confirmar" }));
    expect(deps.encerrar).toHaveBeenCalledWith(
      { id: PEDIDO, corpo: { acao: "entregue_manualmente", nota: "Levei em mãos" }, avisarPorEmail: false },
      expect.anything(),
    );
  });

  it("encerrar por motivo simples não pede nota e não avisa por e-mail", async () => {
    const user = usuario();
    abrirDetalhe({ status: "received" }, { aviso_por_email_disponivel: true });
    await user.click(screen.getByRole("button", { name: "Encerrar com motivo" }));
    const janela = screen.getByRole("alertdialog");
    await user.selectOptions(within(janela).getByLabelText("Motivo"), "duplicado");
    expect(within(janela).queryByLabelText("Avisar o titular por e-mail")).toBeNull();
    await user.click(within(janela).getByRole("button", { name: "Confirmar" }));
    expect(deps.encerrar).toHaveBeenCalledWith(
      { id: PEDIDO, corpo: { acao: "encerrado", motivo_codigo: "duplicado", nota: undefined }, avisarPorEmail: false },
      expect.anything(),
    );
  });

  it("identidade não confirmada com e-mail: avisa por e-mail antes de encerrar", async () => {
    const user = usuario();
    abrirDetalhe({ status: "received" }, { aviso_por_email_disponivel: true });
    await user.click(screen.getByRole("button", { name: "Encerrar com motivo" }));
    const janela = screen.getByRole("alertdialog");
    await user.selectOptions(within(janela).getByLabelText("Motivo"), "identidade_nao_confirmada");

    const confirmar = within(janela).getByRole("button", { name: "Confirmar" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true); // este motivo exige a nota (10 a 500)
    const caixa = within(janela).getByLabelText("Avisar o titular por e-mail") as HTMLInputElement;
    expect(caixa.checked).toBe(true); // já vem marcada

    await user.type(within(janela).getByLabelText("Observação"), "Documento não confere com o cadastro");
    await user.click(confirmar);
    expect(deps.encerrar).toHaveBeenCalledWith(
      {
        id: PEDIDO,
        corpo: {
          acao: "encerrado",
          motivo_codigo: "identidade_nao_confirmada",
          nota: "Documento não confere com o cadastro",
        },
        avisarPorEmail: true,
      },
      expect.anything(),
    );
  });

  it("desmarcar a caixa encerra sem avisar; sem e-mail disponível a caixa nem aparece", async () => {
    const user = usuario();
    const { unmount } = abrirDetalhe({ status: "received" }, { aviso_por_email_disponivel: true });
    await user.click(screen.getByRole("button", { name: "Encerrar com motivo" }));
    let janela = screen.getByRole("alertdialog");
    await user.selectOptions(within(janela).getByLabelText("Motivo"), "identidade_nao_confirmada");
    await user.click(within(janela).getByLabelText("Avisar o titular por e-mail"));
    await user.type(within(janela).getByLabelText("Observação"), "Documento não confere com o cadastro");
    await user.click(within(janela).getByRole("button", { name: "Confirmar" }));
    expect(deps.encerrar.mock.calls[0]![0].avisarPorEmail).toBe(false);
    unmount();
    cleanup();

    abrirDetalhe({ status: "received" }, { aviso_por_email_disponivel: false });
    await user.click(screen.getByRole("button", { name: "Encerrar com motivo" }));
    janela = screen.getByRole("alertdialog");
    await user.selectOptions(within(janela).getByLabelText("Motivo"), "identidade_nao_confirmada");
    expect(within(janela).queryByLabelText("Avisar o titular por e-mail")).toBeNull();
  });

  it("recusa pronta aparece com copiar quando não há e-mail", async () => {
    const user = usuario();
    abrirDetalhe(
      { status: "failed", error_message: "encerrado_pelo_responsavel" },
      {
        encerramento: { motivo_codigo: "identidade_nao_confirmada", nota: "Documento não confere", em: "2026-11-11T10:00:00.000Z" },
        recusa_pronta: "Não foi possível confirmar a sua identidade.",
      },
    );
    expect(screen.getByText("Envie esta resposta ao titular pela conversa do WhatsApp:")).toBeTruthy();
    expect(screen.getByDisplayValue("Não foi possível confirmar a sua identidade.")).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(deps.copiar).toHaveBeenCalledWith("Não foi possível confirmar a sua identidade.");
  });
});

describe("useEncerrarPedido: a ordem das chamadas", () => {
  const CORPO = {
    acao: "encerrado" as const,
    motivo_codigo: "identidade_nao_confirmada" as const,
    nota: "Documento não confere com o cadastro",
  };

  async function usar() {
    const real = await vi.importActual<{ useEncerrarPedido: typeof useEncerrarPedidoReal }>("@/hooks/useEncerrarPedido");
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalida = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { ...renderHook(() => real.useEncerrarPedido(), { wrapper }), invalida };
  }

  it("o aviso por e-mail sai primeiro, com o motivo escrito, e só então o encerramento", async () => {
    deps.post.mockResolvedValue({ data: {} });
    const { result, invalida } = await usar();
    await act(async () => {
      await result.current.mutateAsync({ id: PEDIDO, corpo: CORPO, avisarPorEmail: true });
    });
    expect(deps.post.mock.calls.map((c) => c[0])).toEqual([
      `/api/v1/lgpd/requests/${PEDIDO}/art12`,
      `/api/v1/lgpd/requests/${PEDIDO}/encerrar`,
    ]);
    expect(deps.post.mock.calls[0]![1]).toEqual({ kind: "refusal", reason: "Documento não confere com o cadastro" });
    expect(deps.post.mock.calls[1]![1]).toEqual(CORPO);
    const chaves = invalida.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
    expect(chaves).toContainEqual(["lgpd-request", PEDIDO]);
    expect(chaves).toContainEqual(["lgpd-requests"]);
  });

  it("se o aviso falha (502), o pedido NÃO é encerrado", async () => {
    deps.post.mockRejectedValueOnce(new ApiError(502, "email_failed", undefined, "req-502"));
    const { result } = await usar();
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: PEDIDO, corpo: CORPO, avisarPorEmail: true }),
      ).rejects.toBeTruthy();
    });
    expect(deps.post).toHaveBeenCalledTimes(1);
    expect(deps.post.mock.calls[0]![0]).toBe(`/api/v1/lgpd/requests/${PEDIDO}/art12`);
  });

  it("aviso já enviado (duplicate: true) não impede o encerramento", async () => {
    deps.post.mockResolvedValueOnce({ data: { duplicate: true } }).mockResolvedValueOnce({ data: {} });
    const { result } = await usar();
    await act(async () => {
      await result.current.mutateAsync({ id: PEDIDO, corpo: CORPO, avisarPorEmail: true });
    });
    expect(deps.post).toHaveBeenCalledTimes(2);
    expect(deps.post.mock.calls[1]![0]).toBe(`/api/v1/lgpd/requests/${PEDIDO}/encerrar`);
  });

  it("sem avisarPorEmail, só o encerramento é chamado; 409 relê o pedido na tela", async () => {
    deps.post.mockRejectedValueOnce(new ApiError(409, "conflict", undefined, "req-409"));
    const { result, invalida } = await usar();
    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: PEDIDO, corpo: { acao: "entregue_manualmente" }, avisarPorEmail: false }),
      ).rejects.toBeTruthy();
    });
    expect(deps.post).toHaveBeenCalledTimes(1);
    expect(deps.post.mock.calls[0]![0]).toBe(`/api/v1/lgpd/requests/${PEDIDO}/encerrar`);
    await waitFor(() => {
      const chaves = invalida.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
      expect(chaves).toContainEqual(["lgpd-request", PEDIDO]);
    });
  });
});
