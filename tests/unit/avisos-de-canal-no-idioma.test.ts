import { describe, expect, it } from "vitest";

import {
  AVISO_MODELOS_FICARAM,
  AVISO_MODELOS_SAIRAM,
  limparModelosDeOutraConta,
} from "@/lib/channels/modelos-de-outra-conta";
import { avisoDoEvento, registrarAviso } from "@/lib/channels/zernio/avisos";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMAS } from "@/lib/i18n/idiomas";

/**
 * OS AVISOS DE CANAL NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * `registrarAviso` (lib/channels/zernio/avisos.ts) é a porta por onde o evento
 * da plataforma e a limpeza de modelos chegam à Central. Ela lê o idioma da
 * empresa e pede o aviso já nesse idioma a quem chama — quem chama não tem como
 * esquecer o idioma. Em português, o texto de antes, byte a byte.
 */

const template = (status: string, name: string | null = "cuenta_activa") => ({
  event: "whatsapp.template.status_updated",
  template: { ...(name ? { name } : {}), status },
});

const EVENTOS_DE_NUMERO = [
  "whatsapp.number.activated",
  "whatsapp.number.reactivated",
  "whatsapp.number.kyc_submitted",
  "whatsapp.number.verification_required",
  "whatsapp.number.action_required",
  "whatsapp.number.declined",
  "whatsapp.number.suspended",
  "whatsapp.number.released",
  "account.disconnected",
  "account.connected",
  "verification.failed",
  "verification.approved",
];

describe("aviso do evento: o português de antes", () => {
  it("modelo com e sem nome; número suspenso", () => {
    expect(avisoDoEvento(template("REJECTED"))?.title).toBe('Modelo "cuenta_activa": REJECTED');
    expect(avisoDoEvento(template("approved", null))?.title).toBe('Modelo "(sem nome)": APPROVED');
    expect(avisoDoEvento({ event: "whatsapp.number.suspended" })?.title).toBe(
      "Número SUSPENSO — não é possível enviar.",
    );
  });
});

describe("aviso do evento: em turco", () => {
  it("o modelo: a moldura muda, o nome e o estado ficam", () => {
    const tr = avisoDoEvento(template("REJECTED"), "tr")!.title;
    expect(tr).not.toBe('Modelo "cuenta_activa": REJECTED');
    expect(tr).toContain("cuenta_activa");
    expect(tr).toContain("REJECTED");
    expect(tr).not.toMatch(/\{[a-z]+\}/);
    expect(avisoDoEvento(template("APPROVED", null), "tr")!.title).not.toContain("sem nome");
  });

  it("o nome do modelo entra como está, mesmo com `$&` ou `{estado}`", () => {
    expect(avisoDoEvento(template("PAUSED", "a$&b{estado}"), "tr")!.title).toContain("a$&b{estado}");
  });

  for (const evento of EVENTOS_DE_NUMERO) {
    it(`${evento} tem título em turco`, () => {
      const pt = avisoDoEvento({ event: evento })!.title;
      expect(avisoDoEvento({ event: evento }, "tr")!.title).not.toBe(pt);
    });
  }
});

// ─── Supabase dublê ───────────────────────────────────────────────────────────

interface Op {
  tabela: string;
  op: string;
  valores?: unknown;
  filtros: Array<[string, string, unknown]>;
}

function adminFalso(opts: { locale?: string | null; idiomaFalha?: boolean; jaAberto?: boolean; limpezaFalha?: boolean; apagados?: number }) {
  const ops: Op[] = [];
  const consulta = (tabela: string, op: string, valores?: unknown) => {
    const registro: Op = { tabela, op, valores, filtros: [] };
    ops.push(registro);
    const resultado = () => {
      if (tabela === "organizations")
        return opts.idiomaFalha
          ? { data: null, error: { message: "banco fora" } }
          : { data: { locale: opts.locale ?? null }, error: null };
      if (tabela === "meta_templates" && op === "delete")
        return opts.limpezaFalha
          ? { data: null, error: { message: "recusado" }, count: null }
          : { data: null, error: null, count: opts.apagados ?? 0 };
      if (op === "select" && tabela === "agent_inbox_items")
        return { data: opts.jaAberto ? { id: "aviso-1" } : null, error: null };
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {};
    for (const f of ["eq", "neq", "in", "is", "limit", "select"]) {
      q[f] = (coluna: string, valor: unknown) => {
        registro.filtros.push([f, coluna, valor]);
        return q;
      };
    }
    q.maybeSingle = async () => resultado();
    q.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, ko);
    return q;
  };
  const admin = {
    from: (tabela: string) => ({
      select: () => consulta(tabela, "select"),
      insert: (v: unknown) => consulta(tabela, "insert", v),
      update: (v: unknown) => consulta(tabela, "update", v),
      delete: () => consulta(tabela, "delete"),
    }),
  };
  const avisos = () =>
    ops
      .filter((o) => o.tabela === "agent_inbox_items" && o.op === "insert")
      .map((o) => o.valores as Record<string, unknown>);
  const de = (op: string) => ops.find((o) => o.tabela === "agent_inbox_items" && o.op === op);
  return { admin: admin as never, avisos, de };
}

const todoIdioma = (titulo: string) => [...new Set(IDIOMAS.map((idioma) => traduzir(titulo, idioma)))];

describe("registrarAviso lê o idioma da empresa", () => {
  const suspenso = { event: "whatsapp.number.suspended", reason: "falta de pagamento" };

  it("empresa em turco → o título em turco, e o dedupe procura esse título", async () => {
    const f = adminFalso({ locale: "tr" });
    expect(await registrarAviso(f.admin, "org", (idioma) => avisoDoEvento(suspenso, idioma)!)).toBe("criado");
    const titulo = avisoDoEvento(suspenso, "tr")!.title;
    expect(f.avisos()).toEqual([expect.objectContaining({ title: titulo, body: "falta de pagamento" })]);
    expect(f.de("select")!.filtros).toContainEqual(["eq", "title", titulo]);
  });

  it("idioma ilegível → português, e o aviso sai mesmo assim", async () => {
    const f = adminFalso({ idiomaFalha: true });
    await registrarAviso(f.admin, "org", (idioma) => avisoDoEvento(suspenso, idioma)!);
    expect(f.avisos()).toEqual([expect.objectContaining({ title: "Número SUSPENSO — não é possível enviar." })]);
  });
});

describe("limpeza de modelos de outra conta", () => {
  const alvo = { organizationId: "org", sessionId: "s1", accountId: "waba-2" };

  it("limpeza recusada → o aviso dos que ficaram, em turco", async () => {
    const f = adminFalso({ locale: "tr", limpezaFalha: true });
    await limparModelosDeOutraConta(f.admin, alvo);
    const [aviso] = f.avisos();
    expect(aviso?.title).toBe(traduzir(AVISO_MODELOS_FICARAM, "tr"));
    expect(aviso?.title).not.toBe(AVISO_MODELOS_FICARAM);
    expect(String(aviso?.body)).not.toMatch(/Esta conexão passou/);
  });

  it("limpeza que passa fecha o aviso dos que ficaram em QUALQUER idioma, e avisa os que saíram em turco", async () => {
    const f = adminFalso({ locale: "tr", apagados: 3 });
    await limparModelosDeOutraConta(f.admin, alvo);
    expect(f.de("update")!.filtros).toContainEqual(["in", "title", todoIdioma(AVISO_MODELOS_FICARAM)]);
    const [aviso] = f.avisos();
    expect(aviso?.title).toBe(traduzir(AVISO_MODELOS_SAIRAM, "tr"));
    expect(String(aviso?.body)).toContain("3");
    expect(String(aviso?.body)).not.toMatch(/modelos da conta anterior/);
    expect(String(aviso?.body)).not.toMatch(/\{[a-z]+\}/);
  });

  it("um modelo só: em turco, com a contagem", async () => {
    const um = adminFalso({ locale: "tr", apagados: 1 });
    await limparModelosDeOutraConta(um.admin, alvo);
    const corpo = String(um.avisos()[0]?.body);
    expect(corpo).toContain("1");
    expect(corpo).not.toMatch(/saiu|saíram|conta anterior/);
  });
});
