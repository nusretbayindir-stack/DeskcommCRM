/**
 * AGENTE CRIADO FORA DA TELA NASCE COM AS PALAVRAS DE PASSAGEM DO IDIOMA.
 *
 * O formulário do editor já preenche `handoff_keywords` no idioma de quem o
 * abre (`palavrasDePassagemPadrao`). Quem cria por outro caminho — a API
 * (`POST /ai/agents` e `/versions`), a criação pelo MCP (`createMcpAgentAction`)
 * e o rascunho canônico (`createMcpAgentDraft`, que a Prospecção chama) — caía
 * no default PORTUGUÊS do zod: uma empresa turca nascia com «falar com humano»,
 * «atendente» e «pessoa real», que o cliente dela nunca escreve.
 *
 * Duas coisas são trancadas aqui, e a segunda é a que não pode regredir:
 *   1. corpo SEM `handoff_keywords` → as palavras do idioma da ORGANIZAÇÃO;
 *   2. corpo COM `handoff_keywords` (até `[]`) → exatamente o que foi mandado.
 * O default do zod continua português: org em português não muda nada.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveAuthDual, tetoDeEscritaDoToken } from "@/lib/api/auth-dual";
import { palavrasDePassagemPadrao } from "@/lib/ai/agents/palavras-de-passagem";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/api/auth-dual", () => ({ resolveAuthDual: vi.fn(), tetoDeEscritaDoToken: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ai/agents/escopo", () => ({
  validarEscopoDaVersao: vi.fn(async () => ({ ok: true })),
  codigoDoEscopo: () => "validation_failed",
  mensagemDoEscopo: () => "",
}));
vi.mock("@/lib/instalacao/ambiente", () => ({
  lerAmbiente: () => ({ chavesDeProvedor: { anthropic: true } }),
}));

const h = vi.hoisted(() => ({ locale: "pt-BR" as string | null }));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    email: "u@example.com",
    organizations: [{ organization_id: "22222222-2222-4222-8222-222222222222", locale: h.locale }],
  })),
  resolveActiveOrg: vi.fn(async () => ({
    orgId: "22222222-2222-4222-8222-222222222222",
    name: "Org",
    role: "admin",
  })),
}));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const AGENTE = "33333333-3333-4333-8333-333333333333";

type Linha = Record<string, unknown>;
let versoesGravadas: Linha[];

/** Admin de mentira: a organização fala `h.locale`; as versões gravadas ficam em `versoesGravadas`. */
function adminFake() {
  versoesGravadas = [];
  return {
    from(tabela: string) {
      let carga: Linha | null = null;
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.order = () => q;
      q.limit = () => q;
      q.update = () => q;
      q.insert = (v: Linha) => {
        carga = v;
        if (tabela === "ai_agent_versions") versoesGravadas.push(v);
        return q;
      };
      q.maybeSingle = async () => {
        if (tabela === "organizations") return { data: { locale: h.locale }, error: null };
        if (tabela === "ai_agents")
          return { data: { id: AGENTE, kind: "mcp_agent", archived_at: null }, error: null };
        return { data: null, error: null };
      };
      q.single = async () => ({
        data: { id: `${tabela}-id`, organization_id: ORG, ...(carga ?? {}) },
        error: null,
      });
      return q;
    },
  };
}

const VERSAO = {
  system_prompt: "Atenda bem.",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  credential_id: null,
  channel_session_id: null,
};

function post(url: string, corpo: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

const TURCAS = [...palavrasDePassagemPadrao("tr")];
const PORTUGUESAS = ["falar com humano", "atendente", "pessoa real"];

beforeEach(() => {
  vi.clearAllMocks();
  h.locale = "tr";
  vi.mocked(requireSupportWrite).mockResolvedValue(null);
  vi.mocked(tetoDeEscritaDoToken).mockResolvedValue(null);
  vi.mocked(resolveAuthDual).mockResolvedValue({
    ok: true,
    organizationId: ORG,
    // Quem clica pode ler a tela em português; o dono do agente é a ORGANIZAÇÃO.
    idioma: "pt-BR",
    actor: { type: "user", id: USER },
    apiTokenId: null,
  } as unknown as Awaited<ReturnType<typeof resolveAuthDual>>);
  vi.mocked(createAdminClient).mockReturnValue(adminFake() as never);
});

describe("POST /api/v1/ai/agents/[id]/versions", () => {
  // Esta rota NÃO herda `handoff_keywords` da versão anterior: o que o corpo
  // omite cai no default do zod. É esse default que o idioma substitui.
  async function criar(corpo: Linha) {
    const { POST } = await import("@/app/api/v1/ai/agents/[id]/versions/route");
    const res = await POST(post(`/api/v1/ai/agents/${AGENTE}/versions`, corpo), {
      params: Promise.resolve({ id: AGENTE }),
    });
    expect(res.status, await res.clone().text()).toBe(201);
    return versoesGravadas[0]!.handoff_keywords;
  }

  it("sem handoff_keywords, org turca nasce com as palavras turcas", async () => {
    expect(await criar(VERSAO)).toEqual(TURCAS);
  });
  it("com handoff_keywords, fica como foi mandado", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: ["insanla"] })).toEqual(["insanla"]);
  });
  it("com [] explícito, fica vazio", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: [] })).toEqual([]);
  });
  it("org em português segue o default português", async () => {
    h.locale = "pt-BR";
    expect(await criar(VERSAO)).toEqual(PORTUGUESAS);
  });
});

describe("POST /api/v1/ai/agents (corpo com `version`)", () => {
  async function criar(version: Linha) {
    const { POST } = await import("@/app/api/v1/ai/agents/route");
    const res = await POST(post("/api/v1/ai/agents", { name: "Tobias", version }));
    expect(res.status, await res.clone().text()).toBe(201);
    return versoesGravadas[0]!.handoff_keywords;
  }

  it("sem handoff_keywords, org turca nasce com as palavras turcas", async () => {
    expect(await criar(VERSAO)).toEqual(TURCAS);
  });
  it("com handoff_keywords, fica como foi mandado", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: ["insanla"] })).toEqual(["insanla"]);
  });
  it("com [] explícito, fica vazio", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: [] })).toEqual([]);
  });
});

describe("createMcpAgentAction (tela /ai/agents/new)", () => {
  async function criar(version: Linha) {
    const { createMcpAgentAction } = await import("@/app/app/ai/agents/[id]/_actions");
    const r = await createMcpAgentAction({ name: "Recepção", version });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    return versoesGravadas[0]!.handoff_keywords;
  }

  it("sem handoff_keywords, org turca nasce com as palavras turcas", async () => {
    expect(await criar(VERSAO)).toEqual(TURCAS);
  });
  it("com handoff_keywords, fica como foi mandado", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: ["insanla"] })).toEqual(["insanla"]);
  });
  it("com [] explícito, fica vazio", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: [] })).toEqual([]);
  });
  it("org em português segue o default português", async () => {
    h.locale = "pt-BR";
    expect(await criar(VERSAO)).toEqual(PORTUGUESAS);
  });
});

describe("createMcpAgentDraft (rascunho canônico)", () => {
  /** Banco de mentira: devolve o idioma da org e guarda os parâmetros do INSERT da versão. */
  function pgFake() {
    const insertDaVersao: { colunas: string[]; valores: unknown[] } = { colunas: [], valores: [] };
    const db = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.startsWith("select locale")) return { rows: [{ locale: h.locale }] };
        if (sql.startsWith("select id from")) return { rows: [] };
        if (sql.startsWith("insert into ai_agents")) return { rows: [{ id: params[0] }] };
        if (sql.startsWith("insert into ai_agent_versions")) {
          const colunas = /version_number,status,created_by,([^)]*)\)/.exec(sql)![1]!.split(",");
          insertDaVersao.colunas = colunas;
          insertDaVersao.valores = params.slice(4);
          return { rows: [{}] };
        }
        return { rows: [] };
      }),
    };
    return {
      db,
      palavras: () => insertDaVersao.valores[insertDaVersao.colunas.indexOf("handoff_keywords")],
    };
  }

  async function criar(version: Linha) {
    const { createMcpAgentDraft } = await import("@/lib/ai/agents/create-draft");
    const { db, palavras } = pgFake();
    await createMcpAgentDraft(db as never, { orgId: ORG, userId: USER }, { name: "Tobias", version });
    return palavras();
  }

  it("sem handoff_keywords, org turca nasce com as palavras turcas", async () => {
    expect(await criar(VERSAO)).toEqual(TURCAS);
  });
  it("com handoff_keywords, fica como foi mandado", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: ["insanla"] })).toEqual(["insanla"]);
  });
  it("com [] explícito, fica vazio", async () => {
    expect(await criar({ ...VERSAO, handoff_keywords: [] })).toEqual([]);
  });
  it("org em português segue o default português", async () => {
    h.locale = "pt-BR";
    expect(await criar(VERSAO)).toEqual(PORTUGUESAS);
  });
});
