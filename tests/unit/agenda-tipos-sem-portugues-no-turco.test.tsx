/**
 * Configurações › Agenda em turco: os botões Desativar/Reativar, o rótulo
 * "Nome", a unidade "min" e as mensagens de sucesso saem no idioma da tela.
 * Eram texto fixo em português dentro do `_client.tsx`.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TiposDeAgendamentoClient,
  type TipoRow,
} from "@/app/app/settings/tenant/agenda/_client";
import { traduzir } from "@/lib/i18n/dicionario";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  post: vi.fn(async () => ({})),
  patch: vi.fn(async () => ({})),
  del: vi.fn(async () => ({})),
}));

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => traduzir(s, "tr") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: mocks.post, patch: mocks.patch, delete: mocks.del },
}));
vi.mock("@/components/agenda/AgendasConectadas", () => ({ AgendasConectadas: () => null }));
vi.mock("@/components/agenda/PrazosDePresenca", () => ({ PrazosDePresenca: () => null }));
vi.mock("@/components/agenda/ClientePelaAgenda", () => ({ ClientePelaAgenda: () => null }));
vi.mock("@/components/agenda/DiasBloqueados", () => ({ DiasBloqueados: () => null }));

const ATIVO: TipoRow = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  name: "Atendimento",
  slug: "atendimento",
  description: null,
  category: "consulta",
  duration_minutes: 60,
  location_kind: "in_person",
  location_details: null,
  default_owner_user_id: "user-1",
  requires_confirmation: false,
  is_active: true,
  default_price_cents: null,
  reminder_enabled: false,
  reminder_minutes_before: 1440,
  reminder_extra_offsets_minutes: null,
  reminder_body: null,
  reminder_bodies: null,
};
const INATIVO: TipoRow = {
  ...ATIVO,
  id: "aaaaaaaa-0000-0000-0000-000000000002",
  slug: "inativo",
  is_active: false,
};

function tela() {
  render(
    <TiposDeAgendamentoClient
      tiposIniciais={[ATIVO, INATIVO]}
      pessoas={[{ id: "user-1", papel: "admin", nome: "Secretária" }]}
      podeEditar
      usuarioAtualId="user-1"
      podeConfigurarGoogle={false}
      clientePelaAgendaLigado={false}
      colegasPodemMexerNaAgendaLigado
      podeMudarAgendaDosColegas={false}
      podeLigarClientePelaAgenda={false}
      meetAbertoLigado={false}
      podeMudarMeetAberto={false}
    />,
  );
}

beforeEach(() => {
  mocks.success.mockClear();
});
afterEach(cleanup);

describe("Configurações › Agenda em turco", () => {
  it("Desativar e Reativar saem em turco", () => {
    tela();
    expect(screen.getByTestId(`desativar-${ATIVO.id}`).textContent).toBe("Devre dışı bırak");
    expect(screen.getByTestId(`reativar-${INATIVO.id}`).textContent).toBe("Yeniden etkinleştir");
  });

  it("a duração mostra a unidade em turco", () => {
    tela();
    expect(screen.getByTestId(`tipo-${ATIVO.id}`).textContent).toContain("60 dk");
  });

  it("o rótulo Nome do formulário de edição sai em turco", async () => {
    tela();
    await userEvent.click(screen.getByTestId(`editar-${ATIVO.id}`));
    const campo = screen.getByTestId(`editar-nome-${ATIVO.id}`);
    expect(campo.closest("label")?.textContent).toContain("Ad");
    expect(campo.closest("label")?.textContent).not.toContain("Nome");
  });

  it("as mensagens de sucesso saem em turco, sem português", async () => {
    tela();
    await userEvent.click(screen.getByTestId(`desativar-${ATIVO.id}`));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId(`reativar-${INATIVO.id}`));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByTestId(`editar-${ATIVO.id}`));
    await userEvent.click(screen.getByTestId(`salvar-${ATIVO.id}`));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(3));

    const mensagens = mocks.success.mock.calls.map((c) => c[0] as string);
    for (const m of mensagens) expect(m).not.toMatch(/^Tipo /);
    expect(new Set(mensagens).size).toBe(3);
  });
});
