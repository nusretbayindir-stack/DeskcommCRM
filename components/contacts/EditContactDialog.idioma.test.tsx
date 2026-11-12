/**
 * O IDIOMA NA FICHA DO CONTATO (S2a, Task 10).
 *
 * O campo "Idioma" mostra os idiomas que o produto serve, cada um no nome dele
 * próprio, mais "Detectar automaticamente" (vazio: a detecção da entrada pode
 * preencher). A escolha sai no PATCH; quem salva sem tocar no campo não manda
 * `locale` — nem reescreve o que a detecção gravou, nem leva ao servidor um
 * valor antigo que ele recusaria.
 */
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import { IDIOMAS_VISIVEIS } from "@/lib/i18n/registro";
import type { Contact } from "@/lib/types/contacts";

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ country: null }),
}));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/contacts/useUpdateContact", () => ({ useUpdateContact: () => useUpdate }));
vi.mock("@/hooks/tags/useDefinirCorDaEtiqueta", () => ({
  useDefinirCorDaEtiqueta: () => ({ definirCor: vi.fn(async () => true) }),
}));
vi.mock("@/hooks/contacts/useContactTagVocabulary", () => ({
  useContactTagVocabulary: () => ({ data: [], isError: false }),
}));
const { mutateAsync, useUpdate } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useUpdate: { mutateAsync: vi.fn(), isPending: false },
}));

const base = {
  id: "33333333-3333-4333-8333-333333333333",
  organization_id: "22222222-2222-4222-8222-222222222222",
  name: "Ana",
  email: null,
  phone_number: null,
  birthdate: null,
  tags: [],
  custom_fields: {},
};

function pintar(alvo: Contact) {
  function Janela() {
    const [aberto, setAberto] = useState(true);
    return <EditContactDialog contact={alvo} open={aberto} onOpenChange={setAberto} />;
  }
  render(<Janela />);
}

beforeAll(() => {
  // Radix Select usa pointer capture e scrollIntoView; o jsdom não tem nenhum.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  useUpdate.mutateAsync = mutateAsync;
  mutateAsync.mockResolvedValue({});
});

describe("o campo Idioma da ficha", () => {
  it("oferece os idiomas visíveis, cada um no próprio nome, e a opção vazia", async () => {
    const user = userEvent.setup();
    pintar({ ...base, locale: null } as unknown as Contact);

    const gatilho = await screen.findByRole("combobox", { name: "Idioma" });
    expect(gatilho).toHaveTextContent("Detectar automaticamente");
    await user.click(gatilho);
    const lista = await screen.findByRole("listbox");
    const opcoes = within(lista).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["Detectar automaticamente", ...IDIOMAS_VISIVEIS.map((i) => i.nomeNativo)]);
  });

  it("abre mostrando o idioma gravado", async () => {
    pintar({ ...base, locale: "nl" } as unknown as Contact);
    const gatilho = await screen.findByRole("combobox", { name: "Idioma" });
    expect(gatilho).toHaveTextContent("Nederlands");
  });

  it("a escolha sai no PATCH", async () => {
    const user = userEvent.setup();
    pintar({ ...base, locale: null } as unknown as Contact);

    await user.click(await screen.findByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Français" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({ locale: "fr" });
  });

  it('"Detectar automaticamente" limpa o idioma gravado (null no PATCH)', async () => {
    const user = userEvent.setup();
    pintar({ ...base, locale: "tr" } as unknown as Contact);

    await user.click(await screen.findByRole("combobox", { name: "Idioma" }));
    await user.click(await screen.findByRole("option", { name: "Detectar automaticamente" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0]?.[0]).toHaveProperty("locale", null);
  });

  it("salvar sem tocar no campo não manda locale — nem o gravado, nem um antigo que o servidor recusaria", async () => {
    const user = userEvent.setup();
    pintar({ ...base, locale: "nl" } as unknown as Contact);
    await screen.findByRole("combobox", { name: "Idioma" });
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("locale");

    mutateAsync.mockClear();
  });

  it("um idioma gravado que o produto não serve não bloqueia o salvar", async () => {
    const user = userEvent.setup();
    pintar({ ...base, locale: "en" } as unknown as Contact);
    await screen.findByRole("combobox", { name: "Idioma" });
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("locale");
  });
});
