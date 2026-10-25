/**
 * Os seletores de fuso de Configurações (perfil e empresa) mostram o NOME do
 * lugar no idioma da tela, não o identificador IANA ("Europe/Brussels").
 * O valor que vai para o banco continua sendo o código.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ProfileForm } from "@/app/app/settings/profile/_form";
import { TenantForm } from "@/app/app/settings/tenant/_form";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import type { TenantInput } from "@/lib/schemas/settings";

vi.mock("@/app/actions/settings/updateTenant", () => ({
  updateTenant: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/settings/updateProfile", () => ({
  updateProfile: vi.fn(async () => ({ ok: true })),
}));

const TENANT: TenantInput = {
  display_name: "Empresa",
  legal_name: "Empresa Lda",
  cnpj: null,
  timezone: "Europe/Brussels",
  locale: "tr",
  currency: "EUR",
  media_retention_days: 365,
  media_retention_enforced: true,
  dpo_email: null,
  privacy_policy_url: null,
  country: "BE",
};

beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.scrollIntoView ??= () => undefined;
});
afterEach(cleanup);

const telas = {
  empresa: (locale: "tr" | "pt-BR") => (
    <IdiomaProvider locale={locale}>
      <TenantForm initial={TENANT} />
    </IdiomaProvider>
  ),
  perfil: (locale: "tr" | "pt-BR") => (
    <IdiomaProvider locale={locale}>
      <ProfileForm
        email="a@b.c"
        initialFullName="Ayşe"
        initialAvatarUrl={null}
        initialLocale="tr"
        initialTimezone="Europe/Brussels"
      />
    </IdiomaProvider>
  ),
};

describe.each(["empresa", "perfil"] as const)("fuso na tela de %s", (nome) => {
  it("em turco mostra o nome do lugar em turco, não o código", async () => {
    render(telas[nome]("tr"));
    const campo = screen.getByLabelText("Saat dilimi");
    expect(campo.textContent).toContain("Brüksel (Belçika)");
    expect(campo.textContent).not.toContain("Europe/Brussels");

    await userEvent.setup().click(campo);
    expect(await screen.findByRole("option", { name: "İstanbul (Türkiye)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Europe/Istanbul" })).toBeNull();
  });

  it("em português mostra o rótulo em português", async () => {
    render(telas[nome]("pt-BR"));
    expect(screen.getByLabelText("Fuso horário").textContent).toContain("Bruxelas (Bélgica)");
  });
});
