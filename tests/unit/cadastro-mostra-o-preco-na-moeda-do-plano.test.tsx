/**
 * O plano em euro (S4) que o dono oferece no cadastro aparece em €, não em R$:
 * na tela de cadastro e na de recuperar a organização. O idioma do número é o
 * do navegador (Intl sem locale), por isso o separador decimal fica livre aqui.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/auth/signUp", () => ({ signUp: vi.fn() }));
vi.mock("@/app/actions/auth/recoverOrganization", () => ({ recoverOrganization: vi.fn() }));

import { RecoverOrganizationForm } from "@/components/auth/RecoverOrganizationForm";
import { SignupForm } from "@/components/auth/SignupForm";

afterEach(cleanup);

const PLANOS = [
  { id: "p-real", nome: "Básico", preco_cents: 4990, intervalo: "mes", trial_dias: 7, moeda: "BRL" as const },
  { id: "p-euro", nome: "Start", preco_cents: 7900, intervalo: "mes", trial_dias: 0, moeda: "EUR" as const },
];

describe("o preço do plano no cadastro sai na moeda do plano", () => {
  it.each([
    ["cadastro", () => render(<SignupForm planos={PLANOS} />)],
    ["recuperar a organização", () => render(<RecoverOrganizationForm planos={PLANOS} />)],
  ])("%s", (_tela, montar) => {
    montar();
    const euro = screen.getByRole("option", { name: /^Start — / });
    expect(euro.textContent).toMatch(/€\s?79[.,]00|79[.,]00\s?€/);
    expect(euro.textContent).not.toMatch(/R\$/);
    expect(screen.getByRole("option", { name: /^Básico — / }).textContent).toMatch(/R\$\s?49[.,]90/);
  });
});
