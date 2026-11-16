// @vitest-environment node
/**
 * U53: O PAINEL DO DETALHE DO PEDIDO.
 *
 * O detalhe do pedido devolve, além da linha, o que a tela precisa para o admin
 * decidir: como o pedido chegou e quem o abriu, para onde vai o relatório, os
 * avisos antes de aprovar e as mensagens prontas. O dublê de banco REGISTRA os
 * filtros de cada leitura — toda leitura de tabela com empresa tem de carregar
 * `organization_id`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ModuloDaMarca from "@/lib/branding/saida";
import type * as ModuloDoPerfil from "@/lib/legal/perfil-do-pais";

const h = vi.hoisted(() => {
  const estado = {
    semAutoridade: false,
    erroNoSettings: false,
    nomeDaMarca: "Loja Teste",
    pais: "BE",
    settings: {} as Record<string, unknown>,
    localeDaOrg: "nl",
    localeDoContato: "nl" as string | null,
    abertos: [] as Array<{ id: string }>,
    conversas: [] as Array<{ id: string }>,
    usuario: { user_metadata: { full_name: "Ana Lima" }, email: "ana@loja.test" } as Record<string, unknown> | null,
    leituras: [] as Array<{ tabela: string; colunas: string; eq: Array<[string, unknown]>; in: Array<[string, unknown]> }>,
  };

  function criar() {
    return {
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: estado.usuario }, error: null }),
        },
      },
      from(tabela: string) {
        const leitura = { tabela, colunas: "", eq: [] as Array<[string, unknown]>, in: [] as Array<[string, unknown]> };
        estado.leituras.push(leitura);
        const unico = () => {
          if (tabela === "organizations") {
            if (estado.erroNoSettings && leitura.colunas === "settings") return { data: null, error: { message: "falhou" } };
            return {
              data: {
                country: estado.pais,
                settings: estado.settings,
                locale: estado.localeDaOrg,
                timezone: "Europe/Brussels",
                contacts: estado.localeDoContato ? [{ locale: estado.localeDoContato }] : [],
              },
              error: null,
            };
          }
          return { data: null, error: null };
        };
        const lista = () => {
          if (tabela === "lgpd_requests") return { data: estado.abertos, error: null };
          if (tabela === "conversations") return { data: estado.conversas, error: null };
          return { data: [], error: null };
        };
        const cadeia: Record<string, unknown> = {
          select: (colunas: string) => {
            leitura.colunas = colunas;
            return cadeia;
          },
          eq: (coluna: string, valor: unknown) => {
            leitura.eq.push([coluna, valor]);
            return cadeia;
          },
          in: (coluna: string, valor: unknown) => {
            leitura.in.push([coluna, valor]);
            return cadeia;
          },
          order: () => cadeia,
          limit: () => cadeia,
          maybeSingle: async () => unico(),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            Promise.resolve(lista()).then(res, rej),
        };
        return cadeia;
      },
    };
  }
  return { estado, criar };
});

vi.mock("@/lib/branding/saida", async (original) => ({
  ...(await original<typeof ModuloDaMarca>()),
  marcaDaSaida: vi.fn(async () => ({ nome: h.estado.nomeDaMarca })),
}));
vi.mock("@/lib/legal/perfil-do-pais", async (original) => {
  const real = await original<typeof ModuloDoPerfil>();
  return {
    ...real,
    perfilDaOrganizacao: async (...args: Parameters<typeof real.perfilDaOrganizacao>) => {
      const perfil = await real.perfilDaOrganizacao(...args);
      return h.estado.semAutoridade ? { ...perfil, autoridadeDeSupervisao: undefined } : perfil;
    },
  };
});

import { autoridadeNoIdioma } from "@/lib/lgpd/idioma-do-documento";
import { PERFIS_DO_PAIS } from "@/lib/legal/perfil-do-pais";
import { exigeAvisoAntesDaAprovacao } from "@/lib/lgpd/aviso-whatsapp-antes-da-exclusao";
import { painelDoPedido } from "@/lib/lgpd/painel-do-pedido";

const ORG = "org-1";
const RAIZ = path.resolve(__dirname, "..", "..");

function pedido(extra: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    request_type: "data_request",
    status: "received",
    contact_id: "contato-1" as string | null,
    received_at: "2026-11-10T12:00:00.000Z",
    request_payload: {} as unknown,
    result: null as unknown,
    ...extra,
  };
}

const manual = (extra: Record<string, unknown> = {}) => ({
  origem_manual: {
    canal: "outro",
    observacao: "veio à loja",
    criado_por: "user-1",
    criado_em: "2026-11-15T08:00:00.000Z",
  },
  delivery: null,
  ...extra,
});

const painel = (
  p: ReturnType<typeof pedido>,
  emailDoContato: string | null = "titular@loja.test",
  contatoAnonimizado = false,
) => painelDoPedido(h.criar(), { orgId: ORG, pedido: p, emailDoContato, contatoAnonimizado });

beforeEach(() => {
  h.estado.semAutoridade = false;
  h.estado.erroNoSettings = false;
  h.estado.nomeDaMarca = "Loja Teste";
  h.estado.pais = "BE";
  h.estado.settings = {};
  h.estado.localeDaOrg = "nl";
  h.estado.localeDoContato = "nl";
  h.estado.abertos = [];
  h.estado.conversas = [];
  h.estado.usuario = { user_metadata: { full_name: "Ana Lima" }, email: "ana@loja.test" };
  h.estado.leituras.length = 0;
});

describe("o painel do pedido", () => {
  it("pedido pela tela: como chegou, quem abriu, para onde vai", async () => {
    const p = await painel(pedido({ request_payload: manual() }));

    expect(p.abertura).toEqual({
      canal: "outro",
      observacao: "veio à loja",
      criado_por_nome: "Ana Lima",
      criado_em: "2026-11-15T08:00:00.000Z",
    });
    // Pedido sem endereço fixado, contato hoje com e-mail: o relatório não tem para onde ir.
    expect(p.destino_do_relatorio).toBeNull();
  });

  it("sem nome no cadastro de quem abriu, usa o e-mail; ilegível vira nulo", async () => {
    h.estado.usuario = { user_metadata: {}, email: "ana@loja.test" };
    expect((await painel(pedido({ request_payload: manual() }))).abertura?.criado_por_nome).toBe("ana@loja.test");

    h.estado.usuario = null;
    expect((await painel(pedido({ request_payload: manual() }))).abertura?.criado_por_nome).toBeNull();
  });

  it("pedido da Nuvemshop: sem abertura", async () => {
    const p = await painel(pedido({ request_payload: { delivery: { address: "cliente@loja.test" } } }));

    expect(p.abertura).toBeNull();
    expect(p.destino_do_relatorio).toBe("cliente@loja.test");
  });

  it("art. 15 vazio só fora do Brasil e só em acesso", async () => {
    expect((await painel(pedido())).art15_vazio).toBe(true);

    h.estado.settings = { art15: { finalidades: "atendimento", destinatarios: null, prazo_conservacao: null } };
    expect((await painel(pedido())).art15_vazio).toBe(false);

    h.estado.settings = {};
    expect((await painel(pedido({ request_type: "redact" }))).art15_vazio).toBe(false);

    h.estado.pais = "BR";
    expect((await painel(pedido())).art15_vazio).toBe(false);
  });

  it("exclusão com acesso aberto do mesmo contato avisa", async () => {
    h.estado.abertos = [{ id: "acesso-1" }];
    const p = await painel(pedido({ request_type: "redact" }));
    expect(p.acesso_aberto).toBe(true);

    const leitura = h.estado.leituras.find((l) => l.tabela === "lgpd_requests");
    expect(leitura?.eq).toEqual(
      expect.arrayContaining([
        ["organization_id", ORG],
        ["contact_id", "contato-1"],
        ["request_type", "data_request"],
      ]),
    );
    expect(leitura?.in).toEqual([["status", ["received", "processing", "pending_review"]]]);

    h.estado.abertos = [];
    expect((await painel(pedido({ request_type: "redact" }))).acesso_aberto).toBe(false);
    // Pedido de acesso nunca olha para outro acesso.
    h.estado.abertos = [{ id: "acesso-1" }];
    expect((await painel(pedido())).acesso_aberto).toBe(false);
  });

  it("exclusão sem e-mail na Bélgica: mensagem no idioma do contato, com a empresa", async () => {
    h.estado.conversas = [{ id: "conv-1" }];
    const p = await painel(pedido({ request_type: "redact" }), null);

    expect(p.exclusao_sem_email).toBe(true);
    expect(p.mensagem_de_exclusao).toBe(
      "Op uw verzoek worden uw gegevens vandaag gewist uit de bestanden van Loja Teste. Dit is het laatste bericht dat u van ons ontvangt.",
    );
    expect(p.conversa_href).toBe("/app/inbox/conv-1");

    const leitura = h.estado.leituras.find((l) => l.tabela === "conversations");
    expect(leitura?.eq).toEqual(
      expect.arrayContaining([
        ["organization_id", ORG],
        ["contact_id", "contato-1"],
      ]),
    );
  });

  it("sem idioma no contato, usa o da organização", async () => {
    h.estado.localeDoContato = null;
    h.estado.localeDaOrg = "fr";
    const p = await painel(pedido({ request_type: "redact" }), null);

    expect(p.mensagem_de_exclusao).toContain("Ceci est le dernier message");
    expect(p.mensagem_de_exclusao).toContain("Loja Teste");
  });

  it("exclusão com e-mail no cadastro ou no pedido não exige o aviso nem monta a mensagem", async () => {
    const comEmail = await painel(pedido({ request_type: "redact" }), "titular@loja.test");
    expect(comEmail).toMatchObject({ exclusao_sem_email: false, mensagem_de_exclusao: null, conversa_href: null });

    const noPedido = await painel(pedido({ request_type: "redact", request_payload: { email: "x@loja.test" } }), null);
    expect(noPedido).toMatchObject({ exclusao_sem_email: false, mensagem_de_exclusao: null });
  });

  it("aviso por e-mail só fora do Brasil e com e-mail no cadastro", async () => {
    expect((await painel(pedido({ request_type: "redact" }), "titular@loja.test")).aviso_por_email_disponivel).toBe(true);
    expect((await painel(pedido({ request_type: "redact" }), null)).aviso_por_email_disponivel).toBe(false);
    h.estado.pais = "BR";
    expect((await painel(pedido({ request_type: "redact" }), "titular@loja.test")).aviso_por_email_disponivel).toBe(false);
  });

  it("recusa pronta sai no idioma do titular quando não há e-mail", async () => {
    const encerrado = pedido({
      request_type: "data_request",
      status: "failed",
      result: {
        encerramento: {
          motivo_codigo: "identidade_nao_confirmada",
          nota: "não conseguimos confirmar quem pediu",
          por: "user-1",
          em: "2026-11-12T10:00:00.000Z",
        },
      },
    });
    const p = await painel(encerrado, null);

    expect(p.encerramento).toEqual({
      motivo_codigo: "identidade_nao_confirmada",
      nota: "não conseguimos confirmar quem pediu",
      em: "2026-11-12T10:00:00.000Z",
    });
    expect(p.recusa_pronta).toContain("Loja Teste");
    expect(p.recusa_pronta).toContain("não conseguimos confirmar quem pediu");
    // Contato em nl: o texto não sai no português de origem.
    expect(p.recusa_pronta).not.toContain("não foi atendido");
    // O direito de reclamar à autoridade (art. 12.º, n.º 4), no idioma do titular.
    expect(p.recusa_pronta).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(p.recusa_pronta).toContain("https://www.gegevensbeschermingsautoriteit.be");
    expect(p.recusa_pronta).toContain("klacht");
    // U57: na Bélgica o aviso de recusa já traz a frase; o texto pronto não a repete.
    expect(p.recusa_pronta!.split("klacht").length - 1).toBe(1);

    // Com e-mail no cadastro, o aviso é do sistema: não há texto pronto.
    expect((await painel(encerrado, "titular@loja.test")).recusa_pronta).toBeNull();
  });

  const encerradoPorIdentidade = () =>
    pedido({
      status: "failed",
      result: {
        encerramento: {
          motivo_codigo: "identidade_nao_confirmada",
          nota: "não conseguimos confirmar quem pediu",
          em: "2026-11-12T10:00:00.000Z",
        },
      },
    });

  it("recusa pronta em francês cita a autoridade em francês e o direito de réclamation", async () => {
    h.estado.localeDoContato = "fr";
    const p = await painel(encerradoPorIdentidade(), null);

    expect(p.recusa_pronta).toContain("réclamation");
    expect(p.recusa_pronta!.split("réclamation").length - 1).toBe(1);
    expect(p.recusa_pronta).toContain(autoridadeNoIdioma(PERFIS_DO_PAIS.BE!.autoridadeDeSupervisao!, "fr").nome);
    expect(p.recusa_pronta).not.toContain("Gegevensbeschermingsautoriteit");
  });

  it("Portugal: o e-mail de recusa segue sem a frase (U57), e o texto pronto a acrescenta uma vez", async () => {
    h.estado.pais = "PT";
    const p = await painel(encerradoPorIdentidade(), null);

    const cnpd = PERFIS_DO_PAIS.PT!.autoridadeDeSupervisao!.nome;
    expect(p.recusa_pronta).toContain("pode apresentar reclamação");
    expect(p.recusa_pronta!.split(cnpd).length - 1).toBe(1);
  });

  it("recusa pronta sem autoridade no perfil não inventa a linha da reclamação", async () => {
    h.estado.semAutoridade = true;
    const p = await painel(encerradoPorIdentidade(), null);

    expect(p.recusa_pronta).toContain("Loja Teste");
    expect(p.recusa_pronta).not.toContain("klacht");
    expect(p.recusa_pronta).not.toContain("Gegevensbeschermingsautoriteit");
  });

  it("nome da empresa com $& e $$ sai como está, nas duas mensagens", async () => {
    h.estado.nomeDaMarca = "Loja $& $$ Teste";
    const excl = await painel(pedido({ request_type: "redact" }), null);
    expect(excl.mensagem_de_exclusao).toContain("Loja $& $$ Teste");
    expect(excl.mensagem_de_exclusao).not.toContain("{empresa}");

    const recusa = await painel(encerradoPorIdentidade(), null);
    expect(recusa.recusa_pronta).toContain("Loja $& $$ Teste");
  });

  it("leitura do settings que falha não acusa art. 15 vazio", async () => {
    h.estado.erroNoSettings = true;
    expect((await painel(pedido())).art15_vazio).toBe(false);
  });

  it("encerrar por outro motivo, ou entregar à mão, não gera recusa pronta", async () => {
    const duplicado = pedido({
      status: "failed",
      result: { encerramento: { motivo_codigo: "duplicado", nota: null, em: "2026-11-12T10:00:00.000Z" } },
    });
    expect((await painel(duplicado, null)).recusa_pronta).toBeNull();

    const entregue = await painel(
      pedido({
        status: "completed",
        result: { entrega_manual: { nota: "levado à loja", por: "user-1", em: "2026-11-13T10:00:00.000Z" } },
      }),
    );
    expect(entregue.entrega_manual).toEqual({ nota: "levado à loja", em: "2026-11-13T10:00:00.000Z" });
    expect(entregue.encerramento).toBeNull();
  });

  it("contato apagado não derruba o painel", async () => {
    const p = await painel(pedido({ request_type: "redact", contact_id: null }), null);

    expect(p).toMatchObject({
      mensagem_de_exclusao: null,
      conversa_href: null,
      acesso_aberto: false,
      exclusao_sem_email: false,
    });
  });

  it("contato anonimizado por outro caminho: sem caixa, sem mensagem e sem link", async () => {
    // "Anonimizar" mantém a linha (is_anonymized = true, e-mail e telefone nulos):
    // o titular não pode mais ser avisado, e a marca seria um atestado falso.
    h.estado.conversas = [{ id: "conv-1" }];
    const p = await painel(pedido({ request_type: "redact" }), null, true);

    expect(p).toMatchObject({ exclusao_sem_email: false, mensagem_de_exclusao: null, conversa_href: null });
    expect(h.estado.leituras.some((l) => l.tabela === "conversations")).toBe(false);
  });

  it("toda leitura de tabela da empresa leva organization_id", async () => {
    h.estado.conversas = [{ id: "conv-1" }];
    await painel(pedido({ request_type: "redact" }), null);
    await painel(pedido());

    const comEmpresa = h.estado.leituras.filter((l) => l.tabela === "lgpd_requests" || l.tabela === "conversations");
    expect(comEmpresa.length).toBeGreaterThan(0);
    for (const l of comEmpresa) expect(l.eq).toContainEqual(["organization_id", ORG]);
  });
});

describe("exclusao_sem_email é a regra que a aprovação cobra", () => {
  const casos = [
    { pais: "BE", tipo: "redact", contato: "contato-1", email: null, payload: {}, anonimizado: false },
    { pais: "BE", tipo: "redact", contato: "contato-1", email: "a@loja.test", payload: {}, anonimizado: false },
    { pais: "BE", tipo: "redact", contato: "contato-1", email: null, payload: { email: "b@loja.test" }, anonimizado: false },
    { pais: "BE", tipo: "redact", contato: null, email: null, payload: {}, anonimizado: false },
    { pais: "BE", tipo: "redact", contato: "contato-1", email: null, payload: {}, anonimizado: true },
    { pais: "BE", tipo: "store_redact", contato: "contato-1", email: null, payload: {}, anonimizado: false },
    { pais: "BE", tipo: "data_request", contato: "contato-1", email: null, payload: {}, anonimizado: false },
    { pais: "BR", tipo: "redact", contato: "contato-1", email: null, payload: {}, anonimizado: false },
  ];

  it.each(casos)("painel e rota concordam: %j", async (c) => {
    h.estado.pais = c.pais;
    const p = await painel(
      pedido({ request_type: c.tipo, contact_id: c.contato, request_payload: c.payload }),
      c.email,
      c.anonimizado,
    );
    const regra = exigeAvisoAntesDaAprovacao({
      contactId: c.contato,
      requestType: c.tipo,
      paisCodigo: c.pais,
      emailDoContato: c.email,
      contatoAnonimizado: c.anonimizado,
      payload: c.payload,
    });
    expect(p.exclusao_sem_email).toBe(regra);
  });

  it("os dois lados chamam a mesma função, e o cliente só importa o tipo do painel", () => {
    const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8");
    expect(ler("app/api/v1/lgpd/requests/[id]/approve/route.ts")).toContain("exigeAvisoAntesDaAprovacao(");
    expect(ler("lib/lgpd/painel-do-pedido.ts")).toContain("exigeAvisoAntesDaAprovacao(");
    expect(ler("hooks/useLgpdRequest.ts")).toMatch(/import type \{ PainelDoPedido \} from "@\/lib\/lgpd\/painel-do-pedido"/);
  });

  it("as duas leituras do contato trazem is_anonymized e o repassam à regra", () => {
    const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8");
    const aprovacao = ler("app/api/v1/lgpd/requests/[id]/approve/route.ts");
    const detalhe = ler("app/api/v1/lgpd/requests/[id]/route.ts");
    expect(aprovacao).toContain('.select("email, is_anonymized")');
    expect(aprovacao).toContain("contatoAnonimizado:");
    expect(detalhe).toContain('.select("display_name, email, is_anonymized")');
    expect(detalhe).toContain("contatoAnonimizado:");
  });
});
