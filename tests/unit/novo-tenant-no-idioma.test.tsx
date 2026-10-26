/**
 * /admin/tenants/new pergunta o idioma e o fuso da empresa nova.
 *
 * O convite do dono sai no idioma da organização no momento da criação, então a
 * escolha tem de estar no formulário — não em Configurações, depois. O padrão é
 * o de quem cria: o idioma da tela dele e o fuso da organização dele (a página
 * resolve no servidor e passa `fusoInicial`).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

const h = vi.hoisted(() => ({ criar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/team/InterfaceEditor", () => ({ InterfaceEditor: () => null }));
vi.mock("@/hooks/useCreateTenant", () => ({ useCreateTenant: () => ({ mutateAsync: h.criar }) }));

import { NewTenantForm } from "@/app/admin/(protected)/tenants/new/_form";

const criada = (extra: Record<string, unknown> = {}) => ({
  data: { id: "o1", slug: "kuafor-ayse", display_name: "Kuaför Ayşe", owner_invitation: null, ...extra },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.criar.mockResolvedValue(criada({ idioma_gravado: true }));
});

async function preencherEEnviar(): Promise<Record<string, unknown>> {
  const u = userEvent.setup();
  await u.type(document.querySelector<HTMLInputElement>("#display_name")!, "Kuaför Ayşe");
  await u.type(document.querySelector<HTMLInputElement>("#owner_email")!, "dono@kuafor.test");
  await u.click(document.querySelector<HTMLButtonElement>("button[type=submit]")!);
  await waitFor(() => expect(h.criar).toHaveBeenCalledTimes(1));
  return h.criar.mock.calls[0]![0] as Record<string, unknown>;
}

describe("/admin/tenants/new — idioma e fuso da empresa nova", () => {
  it("mostra os dois campos", () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} fusoInicial="Europe/Brussels" />);
    expect(screen.getByRole("combobox", { name: "Idioma da organização" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Fuso horário" })).toBeTruthy();
  });

  it("o padrão é o de quem cria: o idioma da tela e o fuso recebido da página", async () => {
    render(
      <IdiomaProvider locale="tr">
        <NewTenantForm cobranca={{ ligada: false, planos: [] }} fusoInicial="Europe/Brussels" />
      </IdiomaProvider>,
    );
    const enviado = await preencherEEnviar();
    expect(enviado.locale).toBe("tr");
    expect(enviado.timezone).toBe("Europe/Brussels");
  });

  it("sem fuso da página, cai no padrão do produto", async () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} />);
    const enviado = await preencherEEnviar();
    expect(enviado.locale).toBe("pt-BR");
    expect(enviado.timezone).toBe("America/Sao_Paulo");
  });

  it("idioma não gravado: a tela de sucesso avisa para ajustar antes de o responsável entrar", async () => {
    h.criar.mockResolvedValue(criada({ idioma_gravado: false }));
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} fusoInicial="Europe/Brussels" />);
    await preencherEEnviar();
    expect(await screen.findByText(/Não consegui gravar o idioma e o fuso/)).toBeTruthy();
  });

  it("idioma gravado: nenhum aviso", async () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} fusoInicial="Europe/Brussels" />);
    await preencherEEnviar();
    await screen.findByText("Organização criada");
    expect(screen.queryByText(/Não consegui gravar o idioma e o fuso/)).toBeNull();
  });
});
