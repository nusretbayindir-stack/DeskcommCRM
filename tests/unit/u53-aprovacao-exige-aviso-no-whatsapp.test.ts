// @vitest-environment node
/**
 * U53: APROVAR UMA EXCLUSÃO SEM E-MAIL EXIGE O AVISO PELO WHATSAPP.
 *
 * Fora do Brasil, quem pede a exclusão recebe o aviso e o atestado por e-mail.
 * Sem e-mail (no cadastro nem no pedido), o aviso só chega se a equipe o enviar
 * pelo WhatsApp ANTES de apagar — depois, o telefone já foi anonimizado. A rota
 * recusa a aprovação (422, sem evento, sem update) até o admin marcar que enviou
 * e, marcado, grava quem avisou no mesmo update que já grava `execucao`.
 *
 * A rota REAL com um dublê de banco que REGISTRA os filtros de cada leitura: a
 * leitura do e-mail do contato tem de carregar o filtro de empresa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const estado = {
    pais: "BE",
    tipo: "redact",
    emailDoContato: null as string | null,
    contatoAnonimizado: false,
    contactId: "contato-1" as string | null,
    erroNoContato: false,
    payload: { origem: "painel" } as Record<string, unknown>,
    atualizacoes: [] as Array<Record<string, unknown>>,
    rpc: [] as unknown[],
    /** Filtros `eq` de cada leitura, por tabela. */
    filtros: [] as Array<{ tabela: string; eq: Array<[string, unknown]> }>,
  };

  function criar() {
    return {
      from(tabela: string) {
        const registro: { tabela: string; eq: Array<[string, unknown]> } = { tabela, eq: [] };
        estado.filtros.push(registro);
        let colunas = "";
        const resposta = () => {
          if (tabela === "organizations") return { data: { country: estado.pais }, error: null };
          if (tabela === "contacts") {
            return estado.erroNoContato
              ? { data: null, error: { message: "falhou" } }
              : {
                  data: {
                    email: estado.emailDoContato,
                    // Só vem se a rota pedir a coluna, como no PostgREST.
                    ...(colunas.includes("is_anonymized") ? { is_anonymized: estado.contatoAnonimizado } : {}),
                  },
                  error: null,
                };
          }
          if (tabela === "lgpd_requests") {
            return {
              data: {
                id: "pedido-1",
                organization_id: "org-1",
                request_type: estado.tipo,
                status: "received",
                contact_id: estado.contactId,
                external_customer_id: null,
                due_at: "2026-11-05T00:00:00.000Z",
                request_payload: estado.payload,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        };
        const cadeia: Record<string, unknown> = {
          select: (c?: string) => {
            if (typeof c === "string") colunas = c;
            return cadeia;
          },
          eq: (coluna: string, valor: unknown) => {
            registro.eq.push([coluna, valor]);
            return cadeia;
          },
          insert: () => cadeia,
          update: (payload: Record<string, unknown>) => {
            if (tabela === "lgpd_requests") estado.atualizacoes.push(payload);
            return cadeia;
          },
          maybeSingle: async () => resposta(),
          single: async () => ({ data: { id: "k1" }, error: null }),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(res, rej),
        };
        return cadeia;
      },
      rpc: async (nome: string) => {
        estado.rpc.push(nome);
        return { data: null, error: null };
      },
    };
  }

  return { estado, criar };
});

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({
    ok: true,
    user: { id: "u1", email: "ana@loja.test", full_name: "Ana Lima", idioma: "pt-BR" },
    org: { orgId: "org-1", role: "admin" },
  })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.criar() }));

import { POST } from "@/app/api/v1/lgpd/requests/[id]/approve/route";
import { exigeAvisoNoWhatsapp } from "@/lib/lgpd/aviso-whatsapp-antes-da-exclusao";

async function aprovar(corpo: Record<string, unknown> = {}): Promise<Response> {
  const req = new NextRequest("http://localhost/api/v1/lgpd/requests/pedido-1/approve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "11111111-2222-4333-8444-555555555555",
    },
    body: JSON.stringify({ approved_reason: "pedido conferido com o titular", ...corpo }),
  });
  return POST(req, { params: Promise.resolve({ id: "pedido-1" }) });
}

beforeEach(() => {
  h.estado.pais = "BE";
  h.estado.tipo = "redact";
  h.estado.emailDoContato = null;
  h.estado.contatoAnonimizado = false;
  h.estado.contactId = "contato-1";
  h.estado.erroNoContato = false;
  h.estado.payload = { origem: "painel" };
  h.estado.atualizacoes.length = 0;
  h.estado.rpc.length = 0;
  h.estado.filtros.length = 0;
});

describe("a aprovação de exclusão sem e-mail exige o aviso pelo WhatsApp", () => {
  it("exclusão na Bélgica sem e-mail e sem a marca: 422, sem evento e sem update", async () => {
    const res = await aprovar();

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("aviso_whatsapp_obrigatorio");
    expect(h.estado.rpc).toHaveLength(0);
    expect(h.estado.atualizacoes).toHaveLength(0);
  });

  it("a leitura do e-mail do contato leva o filtro de empresa e o do contato", async () => {
    await aprovar();

    const leitura = h.estado.filtros.find((f) => f.tabela === "contacts");
    expect(leitura, "a rota não leu o e-mail do contato").toBeDefined();
    expect(leitura!.eq).toContainEqual(["organization_id", "org-1"]);
    expect(leitura!.eq).toContainEqual(["id", "contato-1"]);
  });

  it("com a marca: aprova e grava quem avisou", async () => {
    const res = await aprovar({ aviso_whatsapp_enviado: true });

    expect(res.status, await res.clone().text()).toBe(200);
    expect(h.estado.rpc).toHaveLength(1);
    expect(h.estado.atualizacoes).toHaveLength(1);
    const update = h.estado.atualizacoes[0]!;
    expect(update.status).toBe("processing");
    expect(update.request_payload).toMatchObject({
      origem: "painel",
      aviso_whatsapp_antes: { por: "u1", em: expect.any(String) },
      execucao: expect.any(Object),
    });
  });

  it("com e-mail no cadastro não pede a marca nem grava o aviso", async () => {
    h.estado.emailDoContato = "titular@loja.test";

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
    const payload = h.estado.atualizacoes[0]!.request_payload as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, "aviso_whatsapp_antes")).toBe(false);
  });

  it("com e-mail só no payload do pedido também não pede a marca", async () => {
    h.estado.payload = { email: "titular@loja.test" };

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
  });

  it("no Brasil não pede a marca", async () => {
    h.estado.pais = "BR";

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
  });

  it("pedido de dados nunca pede a marca", async () => {
    h.estado.tipo = "data_request";

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
  });
});

describe("onde a regra NÃO se aplica", () => {
  it("exclusão sem contato (contact_id nulo) nunca pede a marca nem lê o contato", async () => {
    h.estado.contactId = null;

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
    expect(h.estado.filtros.some((f) => f.tabela === "contacts")).toBe(false);
  });

  it("pedido de dados e Brasil não leem o contato (a regra não pode se aplicar)", async () => {
    h.estado.tipo = "data_request";
    await aprovar();
    h.estado.pais = "BR";
    h.estado.tipo = "redact";
    await aprovar();

    expect(h.estado.filtros.some((f) => f.tabela === "contacts")).toBe(false);
  });

  it("marca enviada sem a regra se aplicar: não grava aviso_whatsapp_antes", async () => {
    h.estado.emailDoContato = "titular@loja.test";

    const res = await aprovar({ aviso_whatsapp_enviado: true });

    expect(res.status, await res.clone().text()).toBe(200);
    const payload = h.estado.atualizacoes[0]!.request_payload as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, "aviso_whatsapp_antes")).toBe(false);
  });

  it("contato anonimizado por outro caminho: aprova sem a marca e não grava o aviso", async () => {
    // A linha ficou (is_anonymized = true, e-mail e telefone nulos): não há a quem
    // avisar, e exigir a marca obrigaria o admin a atestar um envio impossível.
    h.estado.contatoAnonimizado = true;

    const res = await aprovar();

    expect(res.status, await res.clone().text()).toBe(200);
    expect(h.estado.rpc).toHaveLength(1);
    const payload = h.estado.atualizacoes[0]!.request_payload as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, "aviso_whatsapp_antes")).toBe(false);
  });

  it("erro ao ler o contato: 500, nunca um 422 enganoso, sem evento e sem update", async () => {
    h.estado.erroNoContato = true;

    const res = await aprovar();

    expect(res.status).toBe(500);
    expect(h.estado.rpc).toHaveLength(0);
    expect(h.estado.atualizacoes).toHaveLength(0);
  });
});

describe("exigeAvisoNoWhatsapp", () => {
  it("store_redact fora do Brasil nunca pede a marca (nível da loja, sem pessoa)", () => {
    expect(
      exigeAvisoNoWhatsapp({ requestType: "store_redact", paisCodigo: "BE", emailDoContato: null, payload: {} }),
    ).toBe(false);
  });

  const base = { requestType: "redact", paisCodigo: "BE", emailDoContato: null, payload: {} };

  it("e-mail em branco no cadastro e no payload conta como sem e-mail", () => {
    expect(exigeAvisoNoWhatsapp({ ...base, emailDoContato: "  ", payload: { email: " " } })).toBe(true);
  });

  it("payload que não é objeto não quebra", () => {
    expect(exigeAvisoNoWhatsapp({ ...base, payload: null })).toBe(true);
    expect(exigeAvisoNoWhatsapp({ ...base, payload: "x" })).toBe(true);
  });

  it("e-mail no cadastro ou no payload dispensa", () => {
    expect(exigeAvisoNoWhatsapp({ ...base, emailDoContato: "a@loja.test" })).toBe(false);
    expect(exigeAvisoNoWhatsapp({ ...base, payload: { email: "a@loja.test" } })).toBe(false);
  });
});
