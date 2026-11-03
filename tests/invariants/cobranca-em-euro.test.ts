import { beforeAll, describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";
import { comoAnon, comoServidor, comoUsuario, criarOrg, erroDe, numero, uuid } from "./cobranca-helpers";

/**
 * O PLANO EM EURO E O CONTADOR DE RESPOSTAS (migration 7001; S4 do fork). O
 * CHECK `cobranca_planos_extras_so_em_euro` é o par de `extraForaDoEuro`
 * (lib/schemas/cobranca-plano.ts). O contador é o que a aba Clientes compara
 * com a cota do plano: uma resposta = mensagem da IA cuja anterior na mesma
 * conversa é recebida, no mês do fuso da org.
 */

const P = "c0b07001-0000-4000-8000";
const PLANO_EURO = uuid(P, 900);
const AGORA_DEZEMBRO = "2026-12-15T12:00:00Z";

type Mensagem = readonly [direcao: "inbound" | "outbound", via: "crm" | "ai" | "user", criadaEm: string];

/** Uma org em Bruxelas com UMA conversa e as mensagens dadas; devolve o id da org. */
function cenario(n: number, mensagens: ReadonlyArray<Mensagem>): string {
  const org = uuid(P, n);
  const sessao = uuid(P, 100 + n);
  const contato = uuid(P, 200 + n);
  const conversa = uuid(P, 300 + n);
  criarOrg(org, `cob-euro-${n}`);
  const valores = mensagens
    .map(
      ([direcao, via, em]) =>
        `('${org}', '${conversa}', '${sessao}', '${contato}', 'text', '${direcao}', '${direcao === "inbound" ? "received" : "sent"}', '${via}', '${em}', '${em}')`,
    )
    .join(",\n      ");
  sql(`
    update public.organizations set timezone = 'Europe/Brussels' where id = '${org}';
    insert into public.channel_sessions (id, organization_id, waha_session_name, webhook_secret_encrypted)
      values ('${sessao}', '${org}', 'cob-euro-${n}', '\\x00'::bytea) on conflict (id) do nothing;
    insert into public.contacts (id, organization_id, display_name)
      values ('${contato}', '${org}', 'Contato ${n}') on conflict (id) do nothing;
    insert into public.conversations (id, organization_id, contact_id, channel_session_id, status)
      values ('${conversa}', '${org}', '${contato}', '${sessao}', 'open') on conflict (id) do nothing;
    delete from public.messages where conversation_id = '${conversa}';
    insert into public.messages
      (organization_id, conversation_id, channel_session_id, contact_id, type, direction, status, sent_via, created_at, sent_at)
    values
      ${valores};
  `);
  return org;
}

const respostas = (org: string, agora = AGORA_DEZEMBRO) =>
  numero(comoServidor(`select public.fn_respostas_do_assistente_no_mes('${org}', '${agora}')`));

let VARIAS_DA_IA: string;
let FOLLOW_UP: string;
let HUMANO: string;
let VIRADA_DO_MES: string;

beforeAll(() => {
  VARIAS_DA_IA = cenario(1, [
    ["inbound", "crm", "2026-12-10T10:00:00Z"],
    ["inbound", "crm", "2026-12-10T10:00:30Z"],
    ["outbound", "ai", "2026-12-10T10:01:00Z"],
    ["outbound", "ai", "2026-12-10T10:01:30Z"],
  ]);
  FOLLOW_UP = cenario(2, [
    ["outbound", "ai", "2026-12-11T08:00:00Z"],
    ["outbound", "ai", "2026-12-11T09:00:00Z"],
  ]);
  HUMANO = cenario(3, [
    ["inbound", "crm", "2026-12-12T10:00:00Z"],
    ["outbound", "user", "2026-12-12T10:05:00Z"],
  ]);
  // 30/11 23:30 e 01/12 00:30 em Bruxelas (UTC+1): em UTC as duas são de novembro.
  VIRADA_DO_MES = cenario(4, [
    ["inbound", "crm", "2026-11-30T22:30:00Z"],
    ["outbound", "ai", "2026-11-30T23:30:00Z"],
  ]);
});

describe("cobranca_planos — o plano em euro", () => {
  it("IVA ou implantação em plano BRL é recusado pelo CHECK", () => {
    for (const coluna of ["iva_percentual", "implantacao_cents"] as const) {
      const valor = coluna === "iva_percentual" ? 21 : 29900;
      const e = erroDe(`insert into public.cobranca_planos (nome, preco_cents, intervalo, ${coluna}) values ('BRL extra', 900, 'mes', ${valor});`);
      expect(e, coluna).toContain("23514");
      expect(e, coluna).toContain("cobranca_planos_extras_so_em_euro");
    }
  });

  it("⭐ plano em EUR com IVA 21, implantação e cota é aceito", () => {
    expect(
      erroDe(`insert into public.cobranca_planos (id, nome, preco_cents, intervalo, moeda, iva_percentual, implantacao_cents, respostas_mes)
                values ('${PLANO_EURO}', 'Start', 7900, 'mes', 'EUR', 21, 29900, 300) on conflict (id) do nothing;`),
    ).toBe("");
    expect(numero(`select iva_percentual from public.cobranca_planos where id = '${PLANO_EURO}';`)).toBe(21);
  });

  it("IVA acima de 100, implantação abaixo de 500 e cota zero são recusados", () => {
    const casos: ReadonlyArray<readonly [string, string]> = [
      ["iva_percentual", "101"],
      ["implantacao_cents", "499"],
      ["respostas_mes", "0"],
    ];
    const restricoes = ["cobranca_planos_iva_check", "cobranca_planos_implantacao_check", "cobranca_planos_respostas_check"];
    casos.forEach(([coluna, valor], i) => {
      const e = erroDe(`insert into public.cobranca_planos (nome, preco_cents, intervalo, moeda, ${coluna}) values ('EUR ruim', 900, 'mes', 'EUR', ${valor});`);
      expect(e, coluna).toContain("23514");
      expect(e, coluna).toContain(restricoes[i]);
    });
  });
});

describe("fn_respostas_do_assistente_no_mes", () => {
  it("⭐ recebida, recebida, IA, IA = UMA resposta", () => {
    expect(respostas(VARIAS_DA_IA)).toBe(1);
  });

  it("follow-up da IA depois de outra mensagem da IA não conta", () => {
    expect(respostas(FOLLOW_UP)).toBe(0);
  });

  it("resposta humana não conta", () => {
    expect(respostas(HUMANO)).toBe(0);
  });

  it("⭐ a recebida do último dia do mês anterior e a resposta no 1º dia (fuso da org) contam no mês novo", () => {
    expect(respostas(VIRADA_DO_MES)).toBe(1);
    expect(respostas(VIRADA_DO_MES, "2026-11-15T12:00:00Z")).toBe(0);
  });

  it("anon e authenticated não executam; service_role sim", () => {
    const chamada = `select public.fn_respostas_do_assistente_no_mes('${VARIAS_DA_IA}', '${AGORA_DEZEMBRO}')`;
    expect(erroDe(comoAnon(chamada))).toContain("42501");
    expect(erroDe(comoUsuario(uuid(P, 999), chamada))).toContain("42501");
    expect(erroDe(comoServidor(chamada))).toBe("");
  });
});
