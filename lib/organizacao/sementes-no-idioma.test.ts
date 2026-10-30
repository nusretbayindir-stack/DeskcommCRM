import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { vocabularioDoFunilPadrao } from "@/lib/pipelines/vocabulario-padrao";

import {
  ETIQUETAS_SEMEADAS,
  FUNIL_SEMEADO,
  TIPOS_DA_AGENDA_SEMEADOS,
  gravarIdiomaEFuso,
  sementesNoIdioma,
} from "./sementes-no-idioma";

/**
 * A EMPRESA NOVA NASCE NO IDIOMA DELA.
 *
 * Dois gatilhos do banco semeiam toda organização nova em português: três tipos
 * de agendamento (`fn_semear_tipos_de_agendamento`) e o funil de e-commerce
 * (`fn_seed_default_pipeline_for_org`). Uma empresa turca abria a Agenda e via
 * "Atendimento", e o Kanban com "Carrinho abandonado". Estes testes guardam a
 * tradução dessas sementes: só o que ainda tem o nome da semente muda, e o
 * português continua sendo exatamente o que o banco grava.
 */

const ORG = "0a0a0a0a-0000-4000-8000-000000000001";
const FUNIL_ID = "0a0a0a0a-0000-4000-8000-000000000002";

type Chamada = {
  tabela: string;
  op: "update" | "select";
  valores?: Record<string, unknown>;
  filtros: [string, unknown][];
};

function bancoFalso(opcoes: {
  funil?: { id: string; name: string; vocabulary: Record<string, unknown> | null } | null;
  org?: { settings: Record<string, unknown> | null } | null;
  falhaEm?: string;
}) {
  const chamadas: Chamada[] = [];
  const admin = {
    from(tabela: string) {
      return {
        update(valores: Record<string, unknown>) {
          const chamada: Chamada = { tabela, op: "update", valores, filtros: [] };
          chamadas.push(chamada);
          const consulta = {
            eq(coluna: string, valor: unknown) {
              chamada.filtros.push([coluna, valor]);
              return consulta;
            },
            then<T>(ok: (r: { error: { message: string } | null }) => T, falha?: (e: unknown) => T) {
              const error = opcoes.falhaEm === tabela ? { message: "falhou" } : null;
              return Promise.resolve({ error }).then(ok, falha);
            },
          };
          return consulta;
        },
        select() {
          const chamada: Chamada = { tabela, op: "select", filtros: [] };
          chamadas.push(chamada);
          const consulta = {
            eq(coluna: string, valor: unknown) {
              chamada.filtros.push([coluna, valor]);
              return consulta;
            },
            maybeSingle: async () => ({
              data: tabela === "organizations" ? (opcoes.org ?? null) : (opcoes.funil ?? null),
              error: null,
            }),
          };
          return consulta;
        },
      };
    },
  };
  return { admin: admin as never, chamadas };
}

const updatesEm = (chamadas: Chamada[], tabela: string) =>
  chamadas.filter((c) => c.tabela === tabela && c.op === "update");

const FUNIL_INTOCADO = {
  id: FUNIL_ID,
  name: "Pedidos",
  vocabulary: vocabularioDoFunilPadrao("pt-BR"),
};

describe("sementesNoIdioma", () => {
  it("tr: os três tipos de agendamento semeados ganham o nome turco, só se ainda têm o nome da semente", async () => {
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO });
    await sementesNoIdioma(admin, ORG, "tr");

    const tipos = updatesEm(chamadas, "calendar_event_types");
    expect(tipos).toHaveLength(3);
    expect(tipos).toContainEqual({
      tabela: "calendar_event_types",
      op: "update",
      valores: { name: "Görüşme" },
      filtros: [
        ["organization_id", ORG],
        ["slug", "atendimento"],
        ["name", "Atendimento"],
      ],
    });
    expect(tipos.map((t) => t.valores?.name).sort()).toEqual(["Danışma", "Görüşme", "Toplantı"]);
  });

  it("tr: o funil semeado, as oito etapas e as palavras do funil saem em turco", async () => {
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO });
    await sementesNoIdioma(admin, ORG, "tr");

    expect(updatesEm(chamadas, "crm_pipelines")).toEqual([
      {
        tabela: "crm_pipelines",
        op: "update",
        valores: { name: "Siparişler", vocabulary: vocabularioDoFunilPadrao("tr") },
        filtros: [
          ["id", FUNIL_ID],
          ["organization_id", ORG],
        ],
      },
    ]);

    const etapas = updatesEm(chamadas, "crm_stages");
    expect(etapas).toHaveLength(8);
    expect(etapas).toContainEqual({
      tabela: "crm_stages",
      op: "update",
      valores: { name: "Terk edilen sepet" },
      filtros: [
        ["organization_id", ORG],
        ["pipeline_id", FUNIL_ID],
        ["slug", "carrinho_abandonado"],
        ["name", "Carrinho abandonado"],
      ],
    });
  });

  it("funil que o dono renomeou e vocabulário que ele mudou ficam como estão", async () => {
    const { admin, chamadas } = bancoFalso({
      funil: { id: FUNIL_ID, name: "Vendas", vocabulary: { ...vocabularioDoFunilPadrao("pt-BR"), lead: "Paciente" } },
    });
    await sementesNoIdioma(admin, ORG, "tr");

    expect(updatesEm(chamadas, "crm_pipelines")).toEqual([]);
    // As etapas continuam guardadas pelo nome da semente, uma a uma.
    expect(updatesEm(chamadas, "crm_stages").every((c) => c.filtros.some(([col]) => col === "name"))).toBe(true);
  });

  it("só o vocabulário intocado: o nome mudado fica, as palavras traduzem", async () => {
    const { admin, chamadas } = bancoFalso({
      funil: { id: FUNIL_ID, name: "Loja", vocabulary: null },
    });
    await sementesNoIdioma(admin, ORG, "es");

    expect(updatesEm(chamadas, "crm_pipelines")).toEqual([
      expect.objectContaining({ valores: { vocabulary: vocabularioDoFunilPadrao("es") } }),
    ]);
  });

  it("organização sem o funil semeado: traduz a agenda e não inventa funil", async () => {
    const { admin, chamadas } = bancoFalso({ funil: null });
    expect(await sementesNoIdioma(admin, ORG, "tr")).toBe(true);
    expect(updatesEm(chamadas, "calendar_event_types")).toHaveLength(3);
    expect(updatesEm(chamadas, "crm_pipelines")).toEqual([]);
    expect(updatesEm(chamadas, "crm_stages")).toEqual([]);
  });

  it("tr: a organização sem etiquetas de conversa ganha as oito no idioma dela, sem perder o resto de settings", async () => {
    const { admin, chamadas } = bancoFalso({ funil: null, org: { settings: { plan: "pro" } } });
    await sementesNoIdioma(admin, ORG, "tr");

    expect(updatesEm(chamadas, "organizations")).toEqual([
      {
        tabela: "organizations",
        op: "update",
        valores: {
          settings: {
            plan: "pro",
            canonical_conversation_tags: [
              "soru",
              "şikayet",
              "değişim",
              "iade",
              "teşekkür",
              "teklif",
              "satış sonrası",
              "acil",
            ],
          },
        },
        filtros: [["id", ORG]],
      },
    ]);
  });

  it("organização que já tem etiquetas de conversa (a semente do banco ou as do dono) fica como está", async () => {
    const { admin, chamadas } = bancoFalso({
      funil: null,
      org: { settings: { canonical_conversation_tags: ETIQUETAS_SEMEADAS["pt-BR"] } },
    });
    await sementesNoIdioma(admin, ORG, "tr");
    expect(updatesEm(chamadas, "organizations")).toEqual([]);
  });

  it("settings nulo conta como sem etiquetas", async () => {
    const { admin, chamadas } = bancoFalso({ funil: null, org: { settings: null } });
    await sementesNoIdioma(admin, ORG, "es");
    expect(updatesEm(chamadas, "organizations")).toEqual([
      expect.objectContaining({ valores: { settings: { canonical_conversation_tags: ETIQUETAS_SEMEADAS.es } } }),
    ]);
  });

  it("pt-BR: nada é escrito, a semente já está no idioma", async () => {
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO });
    expect(await sementesNoIdioma(admin, ORG, "pt-BR")).toBe(true);
    expect(chamadas).toEqual([]);
  });

  it("escrita que falha não lança: devolve false e o resto segue", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO, falhaEm: "crm_stages" });
    expect(await sementesNoIdioma(admin, ORG, "tr")).toBe(false);
    expect(updatesEm(chamadas, "calendar_event_types")).toHaveLength(3);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});

describe("gravarIdiomaEFuso", () => {
  it("grava idioma e fuso na organização e traduz as sementes", async () => {
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO });
    expect(await gravarIdiomaEFuso(admin, ORG, { locale: "tr", timezone: "Europe/Brussels" })).toBe(true);

    expect(chamadas[0]).toEqual({
      tabela: "organizations",
      op: "update",
      valores: { locale: "tr", timezone: "Europe/Brussels" },
      filtros: [["id", ORG]],
    });
    expect(updatesEm(chamadas, "calendar_event_types")).toHaveLength(3);
  });

  it("só o fuso: grava o fuso e não mexe nas sementes", async () => {
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO });
    expect(await gravarIdiomaEFuso(admin, ORG, { timezone: "Europe/Istanbul" })).toBe(true);
    expect(chamadas).toEqual([
      { tabela: "organizations", op: "update", valores: { timezone: "Europe/Istanbul" }, filtros: [["id", ORG]] },
    ]);
  });

  it("a organização não gravou: devolve false e não traduz sementes para um idioma que ela não tem", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin, chamadas } = bancoFalso({ funil: FUNIL_INTOCADO, falhaEm: "organizations" });
    expect(await gravarIdiomaEFuso(admin, ORG, { locale: "tr", timezone: "Europe/Brussels" })).toBe(false);
    expect(chamadas.filter((c) => c.tabela !== "organizations")).toEqual([]);
    erro.mockRestore();
  });
});

describe("a tabela em português é a semente do banco", () => {
  const baseline = readFileSync(join(process.cwd(), "supabase", "baseline.sql"), "utf8");
  /** A ÚLTIMA definição da função no baseline: é a que vale. */
  const ultima = (re: RegExp) => [...baseline.matchAll(re)].at(-1)?.[0] ?? "";

  it("tipos de agendamento: mesmos slugs e nomes de `fn_semear_tipos_de_agendamento`", () => {
    const corpo = ultima(/function public\.fn_semear_tipos_de_agendamento\(p_organization_id uuid\)[\s\S]*?\$\$;/g);
    const doBanco = Object.fromEntries(
      [...corpo.matchAll(/\('([^']+)',\s*'([a-z_]+)',\s*'[a-z_]+',/g)].map(([, nome, slug]) => [slug, nome]),
    );
    expect(Object.keys(doBanco)).toHaveLength(3);
    expect(TIPOS_DA_AGENDA_SEMEADOS["pt-BR"]).toEqual(doBanco);
  });

  it("etiquetas de conversa: mesma lista, na mesma ordem, do bloco da migration 0033", () => {
    const bloco = baseline.match(/'canonical_conversation_tags',\s*jsonb_build_array\(([\s\S]*?)\)/)?.[1] ?? "";
    const doBanco = [...bloco.matchAll(/'([^']+)'/g)].map(([, tag]) => tag);
    expect(doBanco).toHaveLength(8);
    expect(ETIQUETAS_SEMEADAS["pt-BR"]).toEqual(doBanco);
  });

  it("funil: mesmo nome, mesmos slugs e nomes de `fn_seed_default_pipeline_for_org`", () => {
    const corpo = ultima(/fn_seed_default_pipeline_for_org"\(\) RETURNS[\s\S]*?end\$\$;/g);
    const funil = corpo.match(/values \(new\.id, '([^']+)', '([a-z_]+)'/);
    const etapas = Object.fromEntries(
      [...corpo.matchAll(/\('([^']+)',\s*'([a-z_]+)',\s*(?:true|false),\s*(?:true|false)\)/g)].map(([, nome, slug]) => [
        slug,
        nome,
      ]),
    );
    expect(funil?.[2]).toBe("pedidos");
    expect(Object.keys(etapas)).toHaveLength(8);
    expect(FUNIL_SEMEADO["pt-BR"]).toEqual({ nome: funil?.[1], etapas });
  });
});
