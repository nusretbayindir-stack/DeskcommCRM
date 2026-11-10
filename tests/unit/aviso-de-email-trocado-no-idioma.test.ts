import { beforeEach, describe, expect, it, vi } from "vitest";

import { avisoDeEmailTrocado } from "@/lib/admin/aviso-de-email-trocado";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O AVISO "E-MAIL DE LOGIN TROCADO" SAI NO IDIOMA DE CADA EMPRESA (S2a Task 5,
 * U14). A pessoa pode estar em várias empresas: cada uma recebe o seu aviso,
 * no idioma dela e com a data no formato e no fuso dela. O idioma vem da
 * MESMA leitura que já trazia o fuso — nenhuma consulta a mais.
 */

const ORG_TR = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_PT = "aaaaaaaa-0000-4000-8000-000000000002";
const USUARIO = "bbbbbbbb-0000-4000-8000-000000000001";

const inseridos: Array<Record<string, unknown>> = [];
let colunasDasEmpresas = "";

function construtor(tabela: string) {
  const resultado = () => {
    if (tabela === "user_organizations") {
      return { data: [{ organization_id: ORG_TR }, { organization_id: ORG_PT }], error: null };
    }
    if (tabela === "organizations") {
      return {
        data: [
          { id: ORG_TR, timezone: "Europe/Istanbul", locale: "tr" },
          { id: ORG_PT, timezone: "America/Sao_Paulo", locale: "pt-BR" },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: (colunas?: string) => {
      if (tabela === "organizations") colunasDasEmpresas = colunas ?? "";
      return b;
    },
    eq: () => b,
    is: () => b,
    in: () => b,
    maybeSingle: async () => ({ data: null, error: null }),
    insert: (linhas: Array<Record<string, unknown>>) => {
      inseridos.push(...linhas);
      return {
        select: async () => ({ data: linhas.map((_, i) => ({ id: `item-${i}` })), error: null }),
      };
    },
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve(resultado()).then(ok, falha),
  });
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (tabela: string) => construtor(tabela),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "antigo@exemplo.com", user_metadata: { full_name: "Ana Lima" } } },
          error: null,
        }),
        updateUserById: async () => ({ error: null }),
      },
    },
  }),
}));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdminEscrita: async () => ({ user: { id: "admin-1" } }),
  falhaDaEscritaDePlatformAdmin: () => {
    throw new Error("não devia chegar aqui");
  },
}));
vi.mock("@/lib/auth/cache-curto", () => ({ invalidarUsuario: () => undefined }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: async () => ({ nome: "Marca" }) }));
vi.mock("@/lib/email/roteador", () => ({ sendEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/email/templates/aviso-de-troca-de-email", () => ({
  buildAvisoDeTrocaDeEmail: () => ({ subject: "s", html: "h", text: "t" }),
}));
vi.mock("@/lib/audit", () => ({ audit: async () => undefined, hashEmail: () => "hash" }));

const { PATCH } = await import("@/app/api/v1/admin/tenants/[id]/members/[userId]/email/route");

function hoje(idioma: string, fuso: string): string {
  return new Intl.DateTimeFormat(idioma, { dateStyle: "short", timeZone: fuso }).format(new Date());
}

beforeEach(() => {
  inseridos.length = 0;
  colunasDasEmpresas = "";
});

describe("o texto do aviso", () => {
  it("português: o de sempre, byte a byte (com e sem nome)", () => {
    expect(avisoDeEmailTrocado({ nome: "Ana Lima", data: "10/11/2026" }, "pt-BR")).toEqual({
      title: "E-mail de login trocado pelo administrador da plataforma",
      body: "O e-mail de login de Ana Lima foi trocado pelo administrador da plataforma em 10/11/2026.",
    });
    expect(avisoDeEmailTrocado({ nome: null, data: "10/11/2026" }, "pt-BR").body).toBe(
      "O e-mail de login de uma pessoa da equipe foi trocado pelo administrador da plataforma em 10/11/2026.",
    );
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: título, corpo e o nome de reserva traduzidos; nome e data crus`, () => {
      const pt = avisoDeEmailTrocado({ nome: "Ana {data} $&", data: "10.11.2026" }, "pt-BR");
      const aviso = avisoDeEmailTrocado({ nome: "Ana {data} $&", data: "10.11.2026" }, idioma);
      expect(aviso.title).not.toBe(pt.title);
      expect(aviso.body).not.toBe(pt.body);
      expect(aviso.body).toContain("Ana {data} $&");
      expect(aviso.body).toContain("10.11.2026");
      const semNome = avisoDeEmailTrocado({ nome: null, data: "10.11.2026" }, idioma).body;
      expect(semNome).not.toContain("uma pessoa da equipe");
      expect(semNome).toContain(traduzir("uma pessoa da equipe", idioma));
    });
  }
});

describe("a rota grava um aviso por empresa, no idioma de cada uma", () => {
  it("empresa turca em turco, empresa brasileira em português, cada data no seu formato", async () => {
    const resposta = await PATCH(
      { json: async () => ({ email: "novo@exemplo.com" }) } as never,
      { params: Promise.resolve({ id: ORG_TR, userId: USUARIO }) },
    );

    expect(resposta.status).toBe(200);
    expect(colunasDasEmpresas, "o idioma vem da mesma leitura do fuso").toContain("locale");
    expect(inseridos).toHaveLength(2);

    const turco = inseridos.find((l) => l.organization_id === ORG_TR)!;
    expect(turco).toMatchObject({
      kind: "email_de_login_trocado",
      ...avisoDeEmailTrocado({ nome: "Ana Lima", data: hoje("tr", "Europe/Istanbul") }, "tr"),
    });
    expect(turco.title).not.toBe("E-mail de login trocado pelo administrador da plataforma");

    const brasileiro = inseridos.find((l) => l.organization_id === ORG_PT)!;
    expect(brasileiro).toMatchObject({
      title: "E-mail de login trocado pelo administrador da plataforma",
      body: `O e-mail de login de Ana Lima foi trocado pelo administrador da plataforma em ${hoje("pt-BR", "America/Sao_Paulo")}.`,
    });
  });
});
