/**
 * U40.j — "N números conectados" contava toda linha da lista, inclusive o número
 * que ainda espera o QR (SCAN_QR_CODE) e cujo cartão pede para escanear.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type * as CanaisModule from "@/hooks/channels/useChannelSessions";
import type { ChannelSession } from "@/hooks/channels/useChannelSessions";

const getMock = vi.fn();
const deleteMock = vi.fn();
const postMock = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
    delete: (...a: unknown[]) => deleteMock(...a),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

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

// Só a listagem é dublada: `channelLabel` e `deriveOverallHealth` do módulo real
// são o que está sob teste na bolinha e no rótulo dos botões.
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


function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  listagem.isLoading = false;
  listagem.isError = false;
  listagem.schemaOutdated = false;
});
afterEach(() => { cleanup(); });

describe("contagem de números conectados", () => {
  it("número esperando o QR não é contado como conectado", () => {
    listagem.data = [canal({ id: "c1" }), canal({ id: "c2", status: "SCAN_QR_CODE", display_name: "Suporte" })];
    render(wrap(<ConnectionsClient wahaConfigured />));
    expect(screen.getByText(/^1 número conectado\./)).toBeInTheDocument();
    expect(screen.getByText(/1 ainda sem conexão ativa/)).toBeInTheDocument();
  });

  it("só número esperando o QR: diz que ainda não há nenhum conectado", () => {
    listagem.data = [canal({ status: "SCAN_QR_CODE" })];
    render(wrap(<ConnectionsClient wahaConfigured />));
    expect(screen.getByText(/Nenhum número conectado ainda\./)).toBeInTheDocument();
    expect(screen.queryByText(/^1 número conectado/)).not.toBeInTheDocument();
  });

  it("todos conectados: a frase de sempre, sem o complemento", () => {
    listagem.data = [canal({ id: "c1" }), canal({ id: "c2" })];
    render(wrap(<ConnectionsClient wahaConfigured />));
    expect(screen.getByText("2 números conectados.")).toBeInTheDocument();
    expect(screen.queryByText(/ainda sem conexão ativa/)).not.toBeInTheDocument();
  });
});
