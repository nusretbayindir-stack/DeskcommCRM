/**
 * O primeiro passo do onboarding ("Onde você atende") começa no fuso que a
 * organização JÁ tem.
 *
 * Começava sempre em São Paulo (`FUSO_PADRAO`). Uma empresa criada pelo painel
 * de administração com o fuso de Bruxelas chegava aqui com "São Paulo"
 * marcado, e quem só clicava em continuar gravava São Paulo por cima — a janela
 * de envio do WhatsApp passava a valer cinco horas fora.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/onboarding/acceptWelcome", () => ({ acceptWelcome: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { WelcomeForm } from "@/app/onboarding/welcome/_form";

const fusoEnviado = () => document.querySelector<HTMLInputElement>('input[type=hidden][name="timezone"]')?.value;

describe("boas-vindas: o fuso inicial é o da organização", () => {
  it("fuso da organização que a lista do onboarding tem: começa nele", () => {
    render(<WelcomeForm defaultOrgName="" orgId="o1" fusoInicial="Europe/Brussels" />);
    expect(fusoEnviado()).toBe("Europe/Brussels");
  });

  it("fuso oferecido que a lista do onboarding não tem: entra na lista e começa nele", () => {
    render(<WelcomeForm defaultOrgName="" orgId="o1" fusoInicial="America/Asuncion" />);
    expect(fusoEnviado()).toBe("America/Asuncion");
    expect(screen.getByRole("combobox").textContent).toContain("Assunção (Paraguai)");
  });

  it("sem fuso, ou com um que a tela não oferece: o padrão do produto", () => {
    render(<WelcomeForm defaultOrgName="" orgId="o1" fusoInicial="Marte/Olympus" />);
    expect(fusoEnviado()).toBe("America/Sao_Paulo");
  });
});
