import { resolveCaseFromHuman } from "@/lib/agent-engine/agent/human-cases";
import type pg from "pg";
import { insertInboxItem, type InboxItemRow } from "@/lib/agent-engine/db/repository";
import { idiomaDaOrgPeloPg } from "@/lib/ai/agents/idioma-da-org";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";

/**
 * Só respostas humanas a casos; cancelamentos normais não abrem avisos.
 *
 * Devolve o aviso aberto, ou `null` quando já havia um para a conversa — a
 * guarda do `insertInboxItem` e o `23505` do índice único parcial (migration
 * 0538) são o MESMO desfecho. Quem chama dentro de transação usa o retorno para
 * isolar o aviso em savepoint; ver `registrarRespostaDeCasoObsoleto`.
 *
 * O título e o corpo saem no idioma da organização (U14): a Central mostra a
 * frase gravada. Quem já sabe o idioma passa `idioma` — quem está dentro de uma
 * transação o lê ANTES dela, para não pôr uma consulta a mais sob o lock.
 * Sem `idioma`, ele é lido aqui (`idiomaDaOrgPeloPg`, que não lança).
 */
export async function avisarRespostaDeCasoObsoleto(
  db: Pick<pg.Pool, "query">,
  org: string,
  caseId: string,
  idioma?: Idioma,
): Promise<InboxItemRow | null> {
  const { rows } = await db.query<{ conversation_id: string }>(
    "select conversation_id from agent_cases where organization_id=$1 and id=$2",
    [org, caseId],
  );
  if (!rows[0]) return null;
  const idiomaDoAviso = idioma ?? (await idiomaDaOrgPeloPg(db, org));
  return insertInboxItem(
    db,
    org,
    {
      kind: "job_dead",
      severity: "warn",
      title: traduzir("Resposta registrada; atendimento mudou", idiomaDoAviso),
      body: traduzir(
        "Resposta registrada; não repassada porque o atendimento mudou. Revise a conversa.",
        idiomaDoAviso,
      ),
      refKind: "conversation",
      refId: rows[0].conversation_id,
    },
    "kind_e_ref",
  );
}

/** Resposta humana e aviso são inseparáveis; falha mantém o caso respondível. */
export async function registrarRespostaDeCasoObsoleto(
  pool: pg.Pool,
  org: string,
  caseId: string,
  actorId: string,
  body: string,
): Promise<boolean> {
  // O idioma do aviso, ANTES da transação: lá dentro cada consulta corre sob o
  // lock do caso, e uma leitura que falhasse abortaria a transação da resposta.
  const idioma = await idiomaDaOrgPeloPg(pool, org);
  const client = await pool.connect();
  // #2624 — mesma marcação do #2621: o finally só libera COM erro quem falhou
  // dentro da transação (release(err) → _remove no pg-pool, cliente descartado).
  let erroNaTransacao: Error | undefined;
  try {
    await client.query("begin");
    const registered = await resolveCaseFromHuman(client, org, caseId, actorId, body);
    if (registered) {
      // O aviso é inseparável da resposta — e "já havia um aviso aberto" é
      // desfecho normal, imposto no banco pelo índice único parcial (0538) com
      // `23505`. DENTRO desta transação o 23505 a deixa em estado abortado: o
      // `commit` abaixo viraria ROLLBACK silencioso e a resposta registrada se
      // perderia. O savepoint isola o aviso dos dois desfechos — com colisão,
      // voltar a ele cura o estado sem desfazer a resolução (o único write
      // desde o savepoint é o aviso que, por definição, já existia).
      await client.query("savepoint aviso_de_caso_obsoleto");
      const aviso = await avisarRespostaDeCasoObsoleto(client, org, caseId, idioma);
      await client.query(
        aviso === null
          ? "rollback to savepoint aviso_de_caso_obsoleto"
          : "release savepoint aviso_de_caso_obsoleto",
      );
      await client.query("commit");
    } else {
      await client.query("rollback");
    }
    return registered;
  } catch (failure) {
    // Marcado ANTES do rollback: se o rollback também falhar, o cliente ainda sai com erro.
    erroNaTransacao = failure instanceof Error ? failure : new Error(String(failure));
    await client.query("rollback");
    throw failure;
  } finally {
    client.release(erroNaTransacao);
  }
}
