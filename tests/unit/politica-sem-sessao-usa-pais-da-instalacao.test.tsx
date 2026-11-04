/**
 * Quem abre /legal/privacy sem sessão não tem empresa para ler: o cliente da
 * empresa cliente, que recebeu o link. Sem isto, numa instalação que atende a
 * Bélgica ele lê "controlador" e nenhuma autoridade belga, porque o vazio vale o
 * Brasil. O país da instalação (`PAIS_DA_INSTALACAO`) decide só esse caso; a
 * coluna da organização continua mandando em quem tem sessão.
 */
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  pais: null as string | null,
  usuario: null as { id: string } | null,
  org: null as { orgId: string } | null,
  linha: null as Record<string, unknown> | null,
  erroDeLeitura: null as { message: string } | null,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => "pt-BR" }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Marca da Revenda" }) }));
vi.mock("@/lib/instalacao/config", () => ({
  valorDaInstalacao: async (chave: string) => ({
    valor: chave === "PAIS_DA_INSTALACAO" ? estado.pais : null,
    fonte: "banco",
  }),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => estado.usuario,
  orgAtivaSemPortao: async () => estado.org,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: estado.usuario } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: estado.linha, error: estado.erroDeLeitura }),
        }),
      }),
    }),
  }),
}));

import PrivacyPage from "@/app/legal/privacy/page";
import { resolverOperador } from "@/lib/legal/operador";

const linhaDaOrg = (country: string | null) => ({
  display_name: "Empresa",
  legal_name: null,
  cnpj: null,
  dpo_email: null,
  privacy_policy_url: null,
  country,
});

beforeEach(() => {
  estado.pais = null;
  estado.usuario = null;
  estado.org = null;
  estado.linha = null;
  estado.erroDeLeitura = null;
});

describe("sem sessão, vale o país da instalação", () => {
  it("instalação na Bélgica: o visitante lê o papel e a autoridade da Bélgica", async () => {
    estado.pais = "BE";
    const { container } = render(await PrivacyPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("1. Quem é o responsável pelo tratamento");
    expect(texto).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(texto).not.toContain("1. Quem é o controlador");
    expect(texto).not.toContain("LGPD");
  });

  it("controle: instalação sem país continua no Brasil", async () => {
    const { container } = render(await PrivacyPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("1. Quem é o controlador");
    expect(texto).not.toContain("Gegevensbeschermingsautoriteit");
  });

  it("minúscula e espaço do arquivo de instalação não mudam o país", async () => {
    estado.pais = " be ";
    const { container } = render(await PrivacyPage());
    expect(container.textContent).toContain("Gegevensbeschermingsautoriteit (GBA)");
  });

  it("falha ao ler a organização cai no país da instalação, não no Brasil", async () => {
    estado.pais = "BE";
    estado.usuario = { id: "u1" };
    estado.org = { orgId: "o1" };
    estado.erroDeLeitura = { message: "falhou" };
    expect((await resolverOperador()).pais).toBe("BE");
  });
});

describe("com sessão, manda a coluna da organização", () => {
  it("empresa em Portugal numa instalação da Bélgica lê Portugal", async () => {
    estado.pais = "BE";
    estado.usuario = { id: "u1" };
    estado.org = { orgId: "o1" };
    estado.linha = linhaDaOrg("PT");
    expect((await resolverOperador()).pais).toBe("PT");
  });

  it("coluna vazia continua Brasil, a regra do resto do produto", async () => {
    estado.pais = "BE";
    estado.usuario = { id: "u1" };
    estado.org = { orgId: "o1" };
    estado.linha = linhaDaOrg(null);
    expect((await resolverOperador()).pais).toBeNull();
  });
});
