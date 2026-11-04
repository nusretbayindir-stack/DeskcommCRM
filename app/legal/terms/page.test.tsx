import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const idioma = vi.hoisted(() => ({ valor: "pt-BR" }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => idioma.valor }));
vi.mock("@/lib/legal/operador", () => ({
  resolverOperador: async () => ({
    sistema: "Marca da Revenda",
    nome: "Empresa do Cliente",
    razaoSocial: "Empresa do Cliente BV",
    cnpj: "12.345.678/0001-90",
    dpoEmail: "dpo@cliente.test",
    politicaPropria: null,
    resolvido: true,
    pais: null as string | null,
  }),
}));

import TermsPage from "./page";

beforeEach(() => {
  idioma.valor = "pt-BR";
});

describe("/legal/terms — os termos no modelo de serviço", () => {
  it("o serviço é do prestador, o contrato vale mais e o QR é a exceção", async () => {
    const { container } = render(await TermsPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("Marca da Revenda é oferecido e operado, pela internet, pelo prestador de serviço");
    expect(texto).toContain("Em caso de conflito, vale o contrato.");
    expect(texto).toContain("O uso da própria conexão por QR");
    expect(texto).toContain("cláusulas 11 e 12");
    expect(texto).toContain("cláusula 16");
    expect(texto).toContain("cláusula 17");
    expect(texto).not.toMatch(/operador|CNPJ|como está/i);
  });

  it("não publica nome, número nem e-mail da empresa do cliente", async () => {
    const { container } = render(await TermsPage());
    const texto = container.textContent ?? "";

    expect(texto).not.toContain("Empresa do Cliente");
    expect(texto).not.toContain("12.345.678/0001-90");
    expect(texto).not.toContain("dpo@cliente.test");
  });

  it("em turco", async () => {
    idioma.valor = "tr";
    const { container } = render(await TermsPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("Marca da Revenda, ");
    expect(texto).toContain("Çelişki hâlinde sözleşme geçerlidir.");
    expect(texto).toContain("11. ve 12. maddelerinde");
    expect(texto).not.toContain("{sistema}");
    expect(texto).not.toMatch(/prestador|contrato de serviço/i);
  });
});
