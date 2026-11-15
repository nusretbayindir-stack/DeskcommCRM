/**
 * U53, tela — o cartão "Pedido do titular" na página do contato e o diálogo que
 * registra um pedido novo.
 *
 * Os ganchos de dados são trocados por dublês (`vi.mock`): o que se mede aqui é
 * a TELA — o que aparece, o que fica desligado e o corpo que sai. As regras de
 * prazo e de canal moram no servidor (Tarefa 3) e têm teste próprio.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/types";

const deps = vi.hoisted(() => ({
  abertos: vi.fn(),
  criar: vi.fn(),
  mutate: vi.fn(),
  success: vi.fn(),
  papel: { atual: "admin" as string },
  contato: { atual: null as unknown },
}));

vi.mock("@/hooks/usePedidoDoTitular", () => ({
  usePedidosAbertosDoContato: deps.abertos,
  useCriarPedidoDoTitular: deps.criar,
}));
vi.mock("sonner", () => ({ toast: { success: deps.success, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ orgId: "org-1", name: "Loja", role: deps.papel.atual }),
  useAuth: () => ({
    user: { id: "u-1", is_platform_admin: false, support: null },
    activeOrg: { orgId: "org-1", name: "Loja", role: deps.papel.atual, cliente_pela_agenda: false },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/hooks/contacts/useContact", () => ({
  useContact: () => ({
    isLoading: false,
    isError: false,
    data: { data: deps.contato.atual },
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/pipelines/useDefaultPipeline", () => ({ useDefaultPipeline: () => ({ data: null }) }));
vi.mock("@/components/contacts/CartaoDaCarteira", () => ({ CartaoDaCarteira: () => null }));
vi.mock("@/components/contacts/TimelineView", () => ({ TimelineView: () => null }));
vi.mock("@/components/contacts/EditContactDialog", () => ({ EditContactDialog: () => null }));
vi.mock("@/components/contacts/AnonymizeDialog", () => ({ AnonymizeDialog: () => null }));
vi.mock("@/components/contacts/PropostasDeDado", () => ({ PropostasDeDado: () => null }));
vi.mock("@/components/kanban/ConversaNoDossie", () => ({ ConversaNoDossie: () => null }));
vi.mock("@/components/voice/DialButton", () => ({ DialButton: () => null }));

import { ContactDetailClient } from "@/app/app/contacts/[id]/_client";
import { CartaoDoPedidoDoTitular } from "@/components/contacts/CartaoDoPedidoDoTitular";
import { NovoPedidoDoTitularDialog } from "@/components/contacts/NovoPedidoDoTitularDialog";
import type { Contact } from "@/lib/types/contacts";

const TUDO = { whatsapp: true, email: true };

function abrirDialogo(
  props: Partial<React.ComponentProps<typeof NovoPedidoDoTitularDialog>> = {},
) {
  return render(
    <NovoPedidoDoTitularDialog
      contactId="c1"
      open
      onOpenChange={vi.fn()}
      canais={TUDO}
      tiposAbertos={[]}
      {...props}
    />,
  );
}

const salvar = () => screen.getByRole("button", { name: "Registrar pedido" }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  deps.papel.atual = "admin";
  deps.criar.mockReturnValue({ mutate: deps.mutate, isPending: false });
  deps.abertos.mockReturnValue({
    isLoading: false,
    data: { pedidos: [], canais: TUDO },
  });
});
afterEach(cleanup);

describe("cartão do pedido do titular", () => {
  it("cartão mostra a linha do pedido aberto com o prazo", () => {
    deps.abertos.mockReturnValue({
      isLoading: false,
      data: {
        pedidos: [{ request_type: "data_request", status: "pending_review", due_at: "2026-11-24T00:00:00.000Z" }],
        canais: TUDO,
      },
    });
    render(<CartaoDoPedidoDoTitular contactId="c1" />);
    expect(screen.getByText("Pedido aberto: Acesso · prazo 24/11/2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar pedido do titular" })).toBeTruthy();
  });

  it("falha ao carregar os pedidos abertos diz o motivo, sem o botão", () => {
    deps.abertos.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<CartaoDoPedidoDoTitular contactId="c1" />);
    expect(screen.getByText("Não foi possível carregar os pedidos deste contato.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar pedido do titular" })).toBeNull();
  });
});

describe("diálogo de novo pedido", () => {
  it("tipo já aberto fica desligado no diálogo", () => {
    abrirDialogo({ tiposAbertos: ["data_request"] });
    const acesso = screen.getByRole("radio", { name: /^Acesso/ }) as HTMLInputElement;
    const exclusao = screen.getByRole("radio", { name: /^Exclusão/ }) as HTMLInputElement;
    expect(acesso.disabled).toBe(true);
    expect(exclusao.disabled).toBe(false);
    // o tipo marcado de saída é o primeiro que não está aberto
    expect(exclusao.checked).toBe(true);
  });

  it("opções de como chegou seguem os canais do contato", () => {
    abrirDialogo({ canais: { whatsapp: false, email: true } });
    expect(screen.queryByRole("option", { name: "Pelo número de WhatsApp cadastrado" })).toBeNull();
    expect(screen.getByRole("option", { name: "Pelo e-mail cadastrado" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Por outro meio" })).toBeTruthy();
  });

  it("aviso de e-mail só em acesso sem e-mail", async () => {
    const aviso =
      "Este contato não tem e-mail cadastrado. Quando o relatório ficar pronto, um admin baixa e entrega.";
    const u = userEvent.setup();
    abrirDialogo({ canais: { whatsapp: true, email: false } });
    expect(screen.getByText(aviso)).toBeTruthy();
    await u.click(screen.getByRole("radio", { name: /^Exclusão/ }));
    expect(screen.queryByText(aviso)).toBeNull();
    cleanup();
    abrirDialogo({ canais: TUDO });
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it("aviso de prazo vencido com data antiga", () => {
    const aviso = "O prazo deste pedido já passou; avise um admin agora.";
    abrirDialogo();
    expect(screen.queryByText(aviso)).toBeNull();
    fireEvent.change(screen.getByLabelText("Dia em que chegou"), { target: { value: "2020-01-02" } });
    expect(screen.getByText(aviso)).toBeTruthy();
  });

  it("por outro meio sem observação não salva", async () => {
    const u = userEvent.setup();
    abrirDialogo();
    await u.selectOptions(screen.getByLabelText("Como chegou"), "outro");
    expect(salvar().disabled).toBe(true);
    await u.type(screen.getByLabelText("Observação"), "curto");
    expect(salvar().disabled).toBe(true);
    await u.type(screen.getByLabelText("Observação"), " e agora basta");
    expect(salvar().disabled).toBe(false);
  });

  it("envia o corpo certo", async () => {
    const u = userEvent.setup();
    abrirDialogo();
    await u.click(salvar());
    expect(deps.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        contact_id: "c1",
        request_type: "data_request",
        canal: "whatsapp_registrado",
        received_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
      expect.anything(),
    );
  });

  it("botão desliga enquanto salva", () => {
    deps.criar.mockReturnValue({ mutate: deps.mutate, isPending: true });
    abrirDialogo();
    expect(salvar().disabled).toBe(true);
  });

  it("409 mostra o prazo do pedido existente", async () => {
    deps.mutate.mockImplementation((_corpo, opcoes) =>
      opcoes.onError(new ApiError(409, "pedido_aberto", { due_at: "2026-11-24T00:00:00.000Z" }, "req-1")),
    );
    const onOpenChange = vi.fn();
    const u = userEvent.setup();
    abrirDialogo({ onOpenChange });
    await u.click(salvar());
    expect(screen.getByText("Já existe um pedido aberto deste tipo — prazo 24/11/2026")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(deps.success).not.toHaveBeenCalled();
  });

  it("sucesso avisa e fecha o diálogo", async () => {
    deps.mutate.mockImplementation((_corpo, opcoes) =>
      opcoes.onSuccess({ data: { id: "r1", due_at: "2026-11-24T00:00:00.000Z" } }),
    );
    const onOpenChange = vi.fn();
    const u = userEvent.setup();
    abrirDialogo({ onOpenChange });
    await u.click(salvar());
    expect(deps.success).toHaveBeenCalledWith("Pedido registrado; os admins foram avisados.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("a ficha do contato", () => {
  const CONTATO = {
    id: "c1",
    organization_id: "org-1",
    name: "Joana Prado",
    display_name: "Joana",
    email: null,
    email_normalized: null,
    phone_number: "+5511999998888",
    cpf_available: false,
    birthdate: null,
    is_blocked: false,
    is_personal: false,
    blocked_reason: null,
    is_anonymized: false,
    anonymized_at: null,
    is_merged_into: null,
    merged_at: null,
    consent: {},
    tags: [],
    source: "whatsapp",
    source_metadata: {},
    custom_fields: {},
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    last_activity_at: null,
    first_service_at: null,
    ai_opt_out: false,
  } satisfies Contact;

  function abrirFicha(papel: string, contato: Contact) {
    deps.papel.atual = papel;
    deps.contato.atual = contato;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const comQuery = (ui: ReactNode) => <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
    render(comQuery(<ContactDetailClient contactId="c1" />));
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  }

  it("a ficha não mostra o cartão para viewer nem para contato anonimizado", () => {
    // controle de vacuidade: o atendente vê o cartão, então a ausência abaixo é de verdade
    abrirFicha("agent", CONTATO);
    expect(screen.getByRole("heading", { name: "Pedido do titular" })).toBeTruthy();
    cleanup();

    abrirFicha("viewer", CONTATO);
    expect(screen.queryByRole("heading", { name: "Pedido do titular" })).toBeNull();
    cleanup();

    abrirFicha("agent", { ...CONTATO, is_anonymized: true });
    expect(screen.queryByRole("heading", { name: "Pedido do titular" })).toBeNull();
  });
});
