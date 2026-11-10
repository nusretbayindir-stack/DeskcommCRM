import { randomUUID } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORIGEM_DOS_AVISOS, textoDoAvisoDoBanco, textoOriginalDoAvisoDoBanco } from "@/lib/ai/avisos-do-banco";
import { IDIOMA_PADRAO, IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";
import { IDIOMAS_EM_CONSTRUCAO } from "@/lib/i18n/registro";

/**
 * OS AVISOS QUE O BANCO GRAVA NA CENTRAL SAEM NO IDIOMA DA EMPRESA (S2a, U14).
 *
 * O gatilho `trg_central_no_idioma_da_empresa` (migration 7002) troca o texto
 * em português que funções do upstream escrevem pelo do idioma da
 * organização. Regex no Postgres não se prova com dublê: este arquivo roda o
 * gatilho de verdade.
 *
 *   1. cada texto, gravado como as funções o gravam, sai em turco e espanhol;
 *      português, um idioma ainda escondido e aviso sem organização ficam
 *      como estão; o pedaço que vem do banco passa cru;
 *   2. o corpo da reativação, que junta até três frases, troca cada uma;
 *   3. `update` do título também passa pelo gatilho, e o da anonimização
 *      (`body = 'Contato anonimizado.'`) também;
 *   4. o `on conflict do update set title = excluded.title` da varredura de
 *      presença;
 *   5. uma função do upstream de verdade (`fn_routing_unassigned_notice`),
 *      inclusive o `on conflict do update set body = excluded.body`.
 */

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db` (scripts/test-db.sh)");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});

/** Um idioma do registro ainda escondido (hoje `nl`): sai em português, como em `normalizarIdioma`. */
const ESCONDIDO = IDIOMAS_EM_CONSTRUCAO[0]?.codigo ?? null;
const ORGS: Record<string, string> = Object.fromEntries(
  ["tr", "es", IDIOMA_PADRAO, ...(ESCONDIDO ? [ESCONDIDO] : [])].map((locale) => [locale, randomUUID()]),
);
const ORG_TR = ORGS.tr!;
const ORG_ES = ORGS.es!;
/** O idioma em que o aviso deve sair: visível e não padrão, senão português. */
function saiEm(locale: string): Idioma | null {
  return (IDIOMAS as readonly string[]).includes(locale) && locale !== IDIOMA_PADRAO ? (locale as Idioma) : null;
}

/** Valores com o que costuma quebrar regex e substituição: ponto, `$1`, barra, colchete. */
const VALORES = { n: 3, motivo: "timeout (provedor) $1 \\x", titulo: "Revisão. 10h? [sala]" };

const CONTATO = randomUUID();
const SESSAO = randomUUID();
const CONVERSA = randomUUID();

/**
 * `ref_kind` de teste: fora do índice único de título aberto
 * (`agent_inbox_other_por_titulo_aberto_unico`, só `ref_kind` nulo), para o mesmo
 * texto poder ser gravado mais de uma vez. O gatilho não olha `ref_kind`.
 */
const REF_DE_TESTE = "teste_avisos_do_banco";

async function gravar(org: string | null, title: string, body: string | null): Promise<{ title: string; body: string | null }> {
  const { rows } = await pool.query<{ title: string; body: string | null }>(
    `insert into agent_inbox_items (organization_id, kind, severity, title, body, ref_kind)
     values ($1, 'other', 'warn', $2, $3, $4) returning title, body`,
    [org, title, body, REF_DE_TESTE],
  );
  return rows[0]!;
}

beforeAll(async () => {
  for (const [locale, id] of Object.entries(ORGS)) {
    await pool.query(
      `insert into organizations (id, slug, legal_name, display_name, locale)
       values ($1, $2, 'Org Avisos do Banco LTDA', 'Org Avisos do Banco', $3)`,
      [id, `avisos-do-banco-${locale.toLowerCase()}-${id.slice(0, 8)}`, locale],
    );
  }
  await pool.query("insert into contacts (id, organization_id, display_name) values ($1, $2, 'Cliente')", [
    CONTATO,
    ORG_TR,
  ]);
  await pool.query(
    `insert into public.channel_sessions (id, organization_id, waha_session_name, webhook_secret_encrypted)
     values ($1, $2, $3, '\\x00'::bytea)`,
    [SESSAO, ORG_TR, `avisos-do-banco-${SESSAO.slice(0, 8)}`],
  );
  await pool.query(
    "insert into conversations (id, organization_id, contact_id, channel_session_id, status) values ($1, $2, $3, $4, 'open')",
    [CONVERSA, ORG_TR, CONTATO, SESSAO],
  );
});

afterAll(async () => {
  // Limpeza de cortesia: o banco do teste é efêmero. A conversa sai antes da
  // organização porque aponta para o contato e a sessão com RESTRICT.
  try {
    await pool.query("delete from agent_inbox_items where organization_id = any($1)", [Object.values(ORGS)]);
    await pool.query("delete from conversations where id = $1", [CONVERSA]);
    await pool.query("delete from organizations where id = any($1)", [Object.values(ORGS)]);
  } catch (erro) {
    console.warn("avisos-do-banco-no-idioma: limpeza incompleta", erro);
  } finally {
    await pool.end();
  }
});

describe("avisos do banco no idioma da empresa (gatilho de verdade)", () => {
  it("⭐ cada texto sai no idioma da empresa; português, idioma escondido e sem organização ficam como estão", async () => {
    expect(Object.keys(ORGS).length, "controle: tr, es, o padrão e um escondido").toBe(ESCONDIDO ? 4 : 3);
    const errados: string[] = [];
    for (const [locale, org] of Object.entries(ORGS)) {
      for (const { chave } of ORIGEM_DOS_AVISOS) {
        const escrito = preencher(textoOriginalDoAvisoDoBanco(chave), VALORES);
        const idioma = saiEm(locale);
        const esperado = idioma ? preencher(textoDoAvisoDoBanco(chave, idioma), VALORES) : escrito;
        const gravado = await gravar(org, escrito, escrito);
        if (gravado.title !== esperado || gravado.body !== esperado) {
          errados.push(`${locale} ${chave}: «${gravado.title}» / «${gravado.body}» ≠ «${esperado}»`);
        }
      }
    }
    expect(errados).toEqual([]);

    const semOrg = textoOriginalDoAvisoDoBanco("reuniaoTitulo");
    const gravado = await gravar(null, semOrg, null);
    expect(gravado).toEqual({ title: semOrg, body: null });
    await pool.query("delete from agent_inbox_items where organization_id is null and title = $1", [semOrg]);
  });

  it("o corpo da reativação troca cada uma das frases que junta", async () => {
    const frases = (["reativadaConversas", "reativadaUmAgendamento", "reativadaPassos"] as const).map((c) => ({
      pt: preencher(textoOriginalDoAvisoDoBanco(c), { n: 12 }),
      tr: preencher(textoDoAvisoDoBanco(c, "tr"), { n: 12 }),
    }));
    const gravado = await gravar(
      ORG_TR,
      textoOriginalDoAvisoDoBanco("reativadaAgendamentosTitulo"),
      frases.map((f) => f.pt).join(" "),
    );
    expect(gravado.title).toBe(textoDoAvisoDoBanco("reativadaAgendamentosTitulo", "tr"));
    expect(gravado.body).toBe(frases.map((f) => f.tr).join(" "));
  });

  it("update do título também passa pelo gatilho", async () => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into agent_inbox_items (organization_id, kind, severity, title, ref_kind) values ($1, 'other', 'warn', 'Rascunho', $2) returning id`,
      [ORG_ES, REF_DE_TESTE],
    );
    const { rows: depois } = await pool.query<{ title: string }>(
      "update agent_inbox_items set title = $2 where id = $1 returning title",
      [rows[0]!.id, textoOriginalDoAvisoDoBanco("recuperacaoTitulo")],
    );
    expect(depois[0]!.title).toBe(textoDoAvisoDoBanco("recuperacaoTitulo", "es"));
  });

  it("a anonimização (update do corpo para 'Contato anonimizado.') sai no idioma da empresa", async () => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into agent_inbox_items (organization_id, kind, severity, title, body, ref_kind)
       values ($1, 'other', 'warn', 'Aviso com dado pessoal', 'Fulano de Tal, 11 99999-0000', $2) returning id`,
      [ORG_TR, REF_DE_TESTE],
    );
    // A forma das funções de anonimização (fn_meet_redact_contact, fn_lgpd_cascade_redact_contact…).
    const { rows: depois } = await pool.query<{ body: string; status: string }>(
      "update agent_inbox_items set status = 'resolved', resolved_at = now(), body = 'Contato anonimizado.', ref_id = null where id = $1 returning body, status",
      [rows[0]!.id],
    );
    expect(depois[0]).toEqual({ body: textoDoAvisoDoBanco("contatoAnonimizado", "tr"), status: "resolved" });
  });

  it("o on conflict da varredura de presença troca o título também no update (title = excluded.title)", async () => {
    const compromisso = randomUUID();
    // A forma de fn_appointment_confirmation_sweep: o mesmo compromisso e revisão, o título muda com a gravidade.
    const varrer = (titulo: string) =>
      pool.query<{ title: string }>(
        `insert into agent_inbox_items (organization_id, kind, severity, title, body, ref_kind, ref_id, appointment_revision)
         values ($1, 'appointment_outcome_required', 'warn', $2, 'Compromisso: Consulta. corpo', 'appointment', $3, 1)
         on conflict (organization_id, ref_id, appointment_revision, kind) where ref_kind = 'appointment' and appointment_revision is not null
         do update set status = 'open', resolved_at = null, severity = excluded.severity, title = excluded.title
         returning title`,
        [ORG_TR, titulo, compromisso],
      );
    expect((await varrer(textoOriginalDoAvisoDoBanco("presencaTitulo"))).rows[0]!.title).toBe(
      textoDoAvisoDoBanco("presencaTitulo", "tr"),
    );
    expect((await varrer(textoOriginalDoAvisoDoBanco("presencaVencidaTitulo"))).rows[0]!.title).toBe(
      textoDoAvisoDoBanco("presencaVencidaTitulo", "tr"),
    );
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int n from agent_inbox_items where organization_id = $1 and ref_id = $2",
      [ORG_TR, compromisso],
    );
    expect(rows[0]!.n).toBe(1);
  });

  it("⭐ fn_routing_unassigned_notice de verdade: turco, e o on conflict troca o corpo em turco", async () => {
    const aviso = async () =>
      (
        await pool.query<{ title: string; body: string }>(
          "select title, body from agent_inbox_items where organization_id = $1 and ref_id = $2 and kind = 'routing_unassigned'",
          [ORG_TR, CONVERSA],
        )
      ).rows;

    await pool.query("select fn_routing_unassigned_notice($1, $2, 'no_eligible')", [ORG_TR, CONVERSA]);
    expect(await aviso()).toEqual([
      {
        title: textoDoAvisoDoBanco("semResponsavelTitulo", "tr"),
        body: textoDoAvisoDoBanco("semResponsavelEquipe", "tr"),
      },
    ]);

    await pool.query("select fn_routing_unassigned_notice($1, $2, 'invalid_channel')", [ORG_TR, CONVERSA]);
    expect(await aviso()).toEqual([
      {
        title: textoDoAvisoDoBanco("semResponsavelTitulo", "tr"),
        body: textoDoAvisoDoBanco("semResponsavelCanal", "tr"),
      },
    ]);
  });
});
