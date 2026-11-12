/**
 * O IDIOMA DO CONTATO NA API (S2a, Task 10).
 *
 * `contacts.locale` decide a língua das mensagens fixas ao cliente. A detecção
 * da Task 9 só preenche o campo vazio; aqui a equipe o lê e o corrige:
 *   - PATCH `locale: "fr"` grava e a resposta o devolve;
 *   - PATCH `locale: null` limpa (a detecção pode preencher de novo);
 *   - só idiomas que o produto serve: `locale: "en"` é recusado pela validação
 *     (422 `validation_error`, o código de todo corpo inválido nesta API);
 *   - PATCH sem `locale` não toca a coluna.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/types";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";
import { contactCreateSchema, contactPatchSchemaDoPais, validateRequest } from "@/lib/schemas";

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
  isServiceRoleConfigured: () => false,
  hashEmail: (e: string) => e,
}));

const ORG = "c05e7a00-0000-4000-8000-000000000001";
const CONTATO = "c05e7a00-0000-4000-8000-0000000000c1";
const USUARIO = "c05e7a00-0000-4000-8000-0000000000a1";

let estadoAtual: Record<string, unknown>;
let ultimoPatch: Record<string, unknown> | null;
let colunasDaResposta: string | null;

function clienteFalso(): unknown {
  return {
    from: () => ({
      select: () => {
        const chain = { eq: () => chain, maybeSingle: async () => ({ data: estadoAtual, error: null }) };
        return chain;
      },
      update: (patch: Record<string, unknown>) => {
        ultimoPatch = patch;
        const chain = {
          eq: () => chain,
          select: (colunas: string) => {
            colunasDaResposta = colunas;
            return chain;
          },
          maybeSingle: async () => ({ data: { ...estadoAtual, ...patch }, error: null }),
        };
        return chain;
      },
    }),
    rpc: () => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }),
  };
}

async function patch(input: Record<string, unknown>) {
  const { patchContactHandler } = await import("@/app/api/v1/contacts/_handler");
  return patchContactHandler(
    clienteFalso() as never,
    { organization_id: ORG, actor: { type: "user", id: USUARIO }, requestId: "req-1" },
    CONTATO,
    input as never,
  );
}

function requisicao(corpo: unknown): Request {
  return new Request("http://localhost/api/v1/contacts/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

const schemaDoPatch = contactPatchSchemaDoPais(perfilDoPais(null));

beforeEach(() => {
  ultimoPatch = null;
  colunasDaResposta = null;
  estadoAtual = {
    id: CONTATO,
    organization_id: ORG,
    is_anonymized: false,
    tags: [],
    email: null,
    phone_number: null,
    name: "Cliente",
    display_name: null,
    consent: {},
    locale: null,
  };
});

describe("locale no schema", () => {
  it("aceita um idioma servido e o null", () => {
    expect(schemaDoPatch.parse({ locale: "fr" })).toMatchObject({ locale: "fr" });
    expect(schemaDoPatch.parse({ locale: null })).toMatchObject({ locale: null });
    expect(contactCreateSchema.parse({ name: "Cliente", locale: "nl" })).toMatchObject({ locale: "nl" });
  });

  it('recusa "en" — idioma que o produto não serve — com validation_error no campo', async () => {
    expect(schemaDoPatch.safeParse({ locale: "en" }).success).toBe(false);
    expect(contactCreateSchema.safeParse({ name: "Cliente", locale: "en" }).success).toBe(false);
    const erro = await validateRequest(schemaDoPatch, requisicao({ locale: "en" })).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).status).toBe(422);
    expect((erro as ApiError).code).toBe("validation_error");
    expect(JSON.stringify((erro as ApiError).details)).toContain("locale");
  });
});

describe("locale no PATCH", () => {
  it('locale "fr" é gravado e volta na resposta', async () => {
    const contato = await patch({ locale: "fr" });
    expect(ultimoPatch).toMatchObject({ locale: "fr" });
    expect(colunasDaResposta).toMatch(/\blocale\b/);
    expect((contato as { locale?: string | null }).locale).toBe("fr");
  });

  it("locale null limpa a coluna", async () => {
    estadoAtual.locale = "nl";
    await patch({ locale: null });
    expect(ultimoPatch).toHaveProperty("locale", null);
  });

  it("PATCH sem locale não toca a coluna", async () => {
    await patch({ name: "Outro Nome" });
    expect(ultimoPatch).not.toHaveProperty("locale");
  });
});
