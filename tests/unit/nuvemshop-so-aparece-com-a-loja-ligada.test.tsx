/**
 * A NUVEMSHOP SÓ APARECE NA TELA DE CONTATOS QUANDO A LOJA ESTÁ LIGADA.
 *
 * Medido na v1.85.2, instalação na Bélgica: o filtro de origem dos Contatos
 * oferecia "Nuvemshop" e a tela vazia dizia "Contatos chegam automaticamente via
 * WhatsApp ou Nuvemshop." — uma plataforma de loja do Brasil que esta
 * instalação nem configurou. O onboarding já esconde o passo da loja por
 * `env.NUVEMSHOP_ENABLED` (`lojaLigada`); a tela de Contatos segue a mesma régua.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ContactsPage from "@/app/app/contacts/page";
import { origensDoFiltro } from "@/app/app/contacts/_origens";
import { EmptyContacts } from "@/components/empty/variants";

const env = vi.hoisted(() => ({ NUVEMSHOP_ENABLED: false }));
vi.mock("@/lib/env", () => ({ env }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
// A página só repassa a flag: a tela inteira não precisa subir para provar isso.
vi.mock("@/app/app/contacts/_client", () => ({ ContactsListClient: () => null }));

describe("Nuvemshop na tela de Contatos", () => {
  it("o filtro de origem só a oferece com a loja ligada", () => {
    expect(origensDoFiltro(false).map((o) => o.value)).not.toContain("nuvemshop");
    expect(origensDoFiltro(true).map((o) => o.value)).toContain("nuvemshop");
  });

  it("a tela vazia só fala da Nuvemshop com a loja ligada", () => {
    const { unmount } = render(<EmptyContacts lojaLigada={false} />);
    expect(screen.getByText("Contatos chegam automaticamente via WhatsApp.")).toBeTruthy();
    unmount();

    render(<EmptyContacts lojaLigada />);
    expect(screen.getByText("Contatos chegam automaticamente via WhatsApp ou Nuvemshop.")).toBeTruthy();
  });

  it("a página passa à tela o que a instalação configurou", () => {
    env.NUVEMSHOP_ENABLED = false;
    expect(ContactsPage().props).toMatchObject({ lojaLigada: false });
    env.NUVEMSHOP_ENABLED = true;
    expect(ContactsPage().props).toMatchObject({ lojaLigada: true });
  });
});
