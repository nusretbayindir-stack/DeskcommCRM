import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * U37.a / U35.a — a política em turco para uma empresa belga: sem "CPF" (documento
 * brasileiro) na seção do Jev e sem parênteses dentro de parênteses no número da
 * empresa.
 */
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => "tr" }));
vi.mock("@/lib/legal/operador", () => ({
  resolverOperador: async () => ({
    sistema: "Marca da Revenda",
    nome: null,
    razaoSocial: "Empresa Teste BV",
    cnpj: "0123.456.749",
    dpoEmail: null,
    politicaPropria: null,
    resolvido: true,
    pais: "BE",
  }),
  nomeDoOperador: (op: { razaoSocial: string | null }) => op.razaoSocial ?? "",
}));

import PrivacyPage from "./page";

describe("/legal/privacy em turco, empresa belga", () => {
  it("o número da empresa não abre parêntese dentro de parêntese", async () => {
    const { container } = render(await PrivacyPage({ searchParams: Promise.resolve({ lang: "tr" }) }));
    const texto = container.textContent ?? "";
    expect(texto).toContain("0123.456.749");
    expect(texto).not.toMatch(/\([^()]*\([^()]*\)[^()]*0123\.456\.749\)/);
  });

  it("a seção do Jev não cita o CPF brasileiro", async () => {
    const { container } = render(await PrivacyPage({ searchParams: Promise.resolve({ lang: "tr" }) }));
    const texto = container.textContent ?? "";
    expect(texto).toContain("TypeSafe AI");
    expect(texto).not.toContain("CPF");
  });
});
