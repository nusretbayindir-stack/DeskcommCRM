/**
 * /admin/tenants/new pergunta o idioma e o fuso da empresa nova.
 *
 * O convite do dono sai no idioma da organização no momento da criação, então a
 * escolha tem de estar no formulário — não em Configurações, depois. O padrão é
 * o de quem cria: o idioma da tela dele e o fuso da organização dele (a página
 * resolve no servidor e passa `fusoInicial`).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(await screen.findByText(/Não consegui gravar o país, o idioma e o fuso/)).toBeTruthy();
  });

  it("idioma gravado: nenhum aviso", async () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} fusoInicial="Europe/Brussels" />);
    await preencherEEnviar();
    await screen.findByText("Organização criada");
    expect(screen.queryByText(/Não consegui gravar o país, o idioma e o fuso/)).toBeNull();
  });
});

describe("/admin/tenants/new — o país da empresa nova", () => {
  const rotuloDoNumero = () => document.querySelector('label[for="cnpj"]')?.textContent;
  const campoDoNumero = () => document.querySelector<HTMLInputElement>("#cnpj")!;

  it("mostra o país; sem país da página, vale o Brasil", async () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} />);
    expect(screen.getByRole("combobox", { name: "País" }).textContent).toContain("Brasil");
    expect(rotuloDoNumero()).toBe("CNPJ");
    expect((await preencherEEnviar()).country).toBe("BR");
  });

  it("a Bélgica vem da página, com o rótulo dela e o número sem máscara de CNPJ", async () => {
    render(
      <NewTenantForm cobranca={{ ligada: false, planos: [] }} paisInicial="BE" fusoInicial="Europe/Brussels" />,
    );
    expect(rotuloDoNumero()).toBe("Número da empresa (KBO/BCE)");
    const u = userEvent.setup();
    await u.type(campoDoNumero(), "0123.456.749");
    expect(campoDoNumero().value).toBe("0123.456.749");
    expect((await preencherEEnviar()).country).toBe("BE");
  });

  it("com BR a máscara de CNPJ continua", async () => {
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} paisInicial="BR" />);
    const u = userEvent.setup();
    await u.type(campoDoNumero(), "12345678000190");
    expect(campoDoNumero().value).toBe("12.345.678/0001-90");
  });

  it("país vazio na organização de quem cria: Brasil, e escolher a Bélgica tira a máscara e sugere o fuso", async () => {
    // O Radix abre a lista com APIs de ponteiro e de rolagem que o jsdom não tem.
    const proto = Element.prototype;
    proto.hasPointerCapture ??= () => false;
    proto.setPointerCapture ??= () => undefined;
    proto.releasePointerCapture ??= () => undefined;
    proto.scrollIntoView ??= () => undefined;
    render(<NewTenantForm cobranca={{ ligada: false, planos: [] }} paisInicial={null} />);
    expect(screen.getByRole("combobox", { name: "País" }).textContent).toContain("Brasil");

    fireEvent.click(screen.getByRole("combobox", { name: "País" }));
    fireEvent.click(await screen.findByRole("option", { name: "Bélgica" }));

    expect(rotuloDoNumero()).toBe("Número da empresa (KBO/BCE)");
    fireEvent.change(campoDoNumero(), { target: { value: "0123.456.749" } });
    expect(campoDoNumero().value).toBe("0123.456.749");
    expect(screen.getByRole("combobox", { name: "Fuso horário" }).textContent).toContain("Bruxelas");
  });

  it("em turco, o país e o rótulo saem traduzidos", () => {
    render(
      <IdiomaProvider locale="tr">
        <NewTenantForm cobranca={{ ligada: false, planos: [] }} paisInicial="BE" />
      </IdiomaProvider>,
    );
    expect(screen.getByRole("combobox", { name: "Ülke" }).textContent).toContain("Belçika");
    expect(rotuloDoNumero()).toBe("İşletme numarası (KBO)");
  });
});
