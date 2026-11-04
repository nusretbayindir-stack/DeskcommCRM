/**
 * "Conectar novo WhatsApp" abre o aviso de risco antes de criar qualquer coisa.
 *
 * Só número NOVO passa por aqui. Reconectar não mostra o aviso: o número já existe e
 * o risco dele já foi aceito, ou é anterior a esta tela.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/types";
import { corpoDoRiscoQr } from "@/lib/channels/risco-do-qr";
import type * as CanaisModule from "@/hooks/channels/useChannelSessions";
import type { ChannelSession } from "@/hooks/channels/useChannelSessions";

const getMock = vi.fn();
const postMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
    delete: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/channels/usePacingKnobs", () => ({
  usePacingKnobs: () => ({ data: { items: [] } }),
}));
vi.mock("@/components/connections/AntiBanSheet", () => ({ AntiBanSheet: () => null }));

const listagem: {
  data: ChannelSession[] | undefined;
  isLoading: boolean;
  isError: boolean;
  schemaOutdated: boolean;
} = { data: [], isLoading: false, isError: false, schemaOutdated: false };
vi.mock("@/hooks/channels/useChannelSessions", async (original) => {
  const real = await original<typeof CanaisModule>();
  return { ...real, useChannelSessions: () => listagem };
});

import { ConnectionsClient } from "@/components/connections/ConnectionsClient";

function canal(over: Partial<ChannelSession> = {}): ChannelSession {
  return {
    id: "canal-1",
    waha_session_name: "org_1111_aaa",
    display_name: "Vendas",
    phone_number: "5511999999999",
    status: "WORKING",
    status_reason: null,
    last_health_check_at: null,
    last_status_change_at: null,
    daily_message_limit: 250,
    is_warmup_complete: null,
    created_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

function tela() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConnectionsClient wahaConfigured />
    </QueryClientProvider>,
  );
}

const abrirAviso = () => fireEvent.click(screen.getByRole("button", { name: "Conectar novo WhatsApp" }));
const avisoNaTela = () => screen.queryByText(/esta conexão não é o caminho oficial da Meta/i);

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  getMock.mockResolvedValue({ data: { channels: [], members: [] } });
  // O POST recusa para a tela não abrir o diálogo do QR: o que se mede aqui é o pedido.
  postMock.mockRejectedValue(new ApiError(502, "connection_repair_required", {}, "req"));
  listagem.data = [];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Conectar novo WhatsApp passa pelo aviso de risco", () => {
  it("o botão abre o aviso e nada é enviado antes do aceite", async () => {
    tela();

    abrirAviso();

    await waitFor(() => expect(avisoNaTela()).toBeTruthy());
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Continuar" }).disabled).toBe(true);
  });

  it("aceitar envia o aceite uma vez só e fecha o aviso", async () => {
    tela();

    abrirAviso();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Li o aviso acima/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock).toHaveBeenCalledWith("/api/v1/channel-sessions", corpoDoRiscoQr(), expect.anything());
    await waitFor(() => expect(avisoNaTela()).toBeNull());
  });

  it("fechar o aviso não cria conexão, e abrir de novo começa sem o aceite", async () => {
    tela();

    abrirAviso();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Li o aviso acima/ }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    await waitFor(() => expect(avisoNaTela()).toBeNull());
    expect(postMock).not.toHaveBeenCalled();

    abrirAviso();
    const caixa = await screen.findByRole<HTMLInputElement>("checkbox", { name: /Li o aviso acima/ });
    expect(caixa.checked).toBe(false);
  });

  it("reconectar não mostra o aviso", async () => {
    listagem.data = [canal({ status: "FAILED" })];
    tela();

    fireEvent.click(screen.getByRole("button", { name: /Reconectar/ }));

    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(avisoNaTela()).toBeNull();
    expect(String(postMock.mock.calls[0]![0])).toContain("/reconnect");
  });
});
