/**
 * U40.k — quem veio de um convite e ainda não tem conta clica em "Já tenho
 * conta? Entrar" e só lia "e-mail ou senha incorretos". No fluxo de convite a
 * falha também diz que talvez falte criar a conta, com o caminho para isso.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (v: string) => v }));
vi.mock("@/app/actions/auth/signInWithPassword", () => ({
  signInWithPassword: vi.fn(async () => ({ ok: false, error: "invalid_credentials" })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

async function falhar(next?: string) {
  render(<LoginForm next={next} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "novo@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "SenhaQualquer#1" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
}

describe("login que falha", () => {
  it("vindo de um convite: sugere criar a conta, levando o token", async () => {
    await falhar("/team/accept-invite/tok123");
    expect(screen.getByRole("alert").textContent).toContain("Email ou senha incorretos.");
    const link = screen.getByRole("link", { name: "Ainda não tem conta? Crie a sua." });
    expect(link.getAttribute("href")).toBe("/signup?invite=tok123");
  });
  it("login comum: nenhuma sugestão nova", async () => {
    await falhar("/app");
    expect(screen.queryByRole("link", { name: /Crie a sua/ })).toBeNull();
  });
});
