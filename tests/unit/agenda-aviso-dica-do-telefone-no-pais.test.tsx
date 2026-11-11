/**
 * A DICA DO NÚMERO NO AVISO DE AGENDAMENTO SEGUE O PAÍS DA ORGANIZAÇÃO.
 *
 * "Um celular do Brasil fica assim: +55, DDD e o número" aparecia para toda
 * organização (doc S2a, Task 7: achado da tradução neerlandesa). A tela irmã,
 * o aviso de caso (`AvisoNoWhatsApp`), já mostra a frase brasileira só no
 * Brasil e, fora dele, o exemplo do país; esta passa a fazer o mesmo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoDaTelaDoAvisoDeAgendamento } from "@/lib/agenda/tela-do-aviso-de-agendamento";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";

const { consulta, pais } = vi.hoisted(() => ({
  consulta: vi.fn(),
  pais: { atual: null as string | null },
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/auth/AuthProvider", async (original) => ({
  ...(await original<typeof import("@/hooks/auth/AuthProvider")>()),
  usePaisDaOrgAtiva: () => pais.atual,
}));
vi.mock("@/hooks/agenda/useAvisoDeAgendamento", () => ({
  CHAVE_DO_AVISO_DE_AGENDAMENTO: ["agenda-aviso-de-agendamento"],
  useAvisoDeAgendamento: () => consulta(),
  useGruposDaConexao: () => ({ data: [], isLoading: false, isError: false }),
  useSalvarAvisoDeAgendamento: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTestarAvisoDeAgendamento: () => ({ mutateAsync: vi.fn(), isPending: false, data: undefined }),
}));

import { AvisoDeAgendamento } from "@/app/app/agenda/avisos/_components/AvisoDeAgendamento";

const CONEXAO = "11111111-1111-4111-8111-111111111111";
const DICA_DO_BRASIL = "Comece pelo código do país. Um celular do Brasil fica assim: +55, DDD e o número.";

function montar() {
  consulta.mockReturnValue({
    data: {
      config: {
        usa_numero_do_aviso_de_caso: false,
        channel_session_id: CONEXAO,
        telefone: "",
        grupo: null,
        ligado: false,
        atualizado_em: "2026-10-25T12:00:00.000Z",
      },
      aviso_de_caso: null,
      conexoes: [{ id: CONEXAO, nome: "Agenda", status: "WORKING", aceitaMensagemLivre: true }],
      entregas: [],
      fuso: "Europe/Brussels",
    } as EstadoDaTelaDoAvisoDeAgendamento,
    isLoading: false,
    error: null,
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AvisoDeAgendamento />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  pais.atual = null;
});

afterEach(() => {
  cleanup();
});

describe("a dica do número que recebe os avisos", () => {
  it("na Bélgica: o exemplo belga, e nada do Brasil", () => {
    pais.atual = "BE";
    montar();
    const exemplo = perfilDoPais("BE").telefoneExemplo;
    expect(screen.getByText(`Comece pelo código do país, por exemplo ${exemplo}.`)).toBeTruthy();
    expect(screen.queryByText(DICA_DO_BRASIL)).toBeNull();
  });

  it("no Brasil (ou sem país): a frase brasileira de sempre", () => {
    montar();
    expect(screen.getByText(DICA_DO_BRASIL)).toBeTruthy();
  });
});
