/**
 * O AVISO NA CENTRAL DO LENÇOL DE DRENO PARADO (issue #2505).
 *
 * ─── O caso real ────────────────────────────────────────────────────────────
 *
 * O drain do `ai_agent.dispatch_requested` ficou DOIS DIAS esperando uma
 * consulta que nunca voltou (#2501): o `/healthz` dizia `ok`, os eventos se
 * acumulavam com `attempts=0`, e ninguém — nem a tela, nem o operador — tinha
 * por onde saber. O #2501 fechou a CAUSA daquela vez; este arquivo fecha a
 * VISIBILIDADE, para qualquer outra causa de travamento.
 *
 * ─── Os moldes que ele segue ────────────────────────────────────────────────
 *
 *   - `lib/event-log/aviso-do-laco.ts`: pane GLOBAL chega por uma linha por
 *     organização (a Central é tenant-aware; "avisar o dono da instalação" não
 *     existe como superfície), dedupe por título estável, resolução sozinha
 *     quando o estado volta, e QUALQUER falha vira `warn` — o aviso é
 *     acessório e não pode derrubar o worker.
 *   - `drain.ts` (`avisarDespachoMorto`): quem fala com o banco aqui é o POOL
 *     CRU do worker, nunca o Supabase client — este processo fala Postgres
 *     direto, e o insert é uma instrução única (`insert … select … where not
 *     exists`) em vez de ler-depois-escrever.
 *
 * O título é ESTÁVEL: é ele que deduplica entre reinícios do worker e é ele
 * que a resolução usa para fechar o episódio — mudar o texto sem mudar quem o
 * procura deixaria avisos órfãos abertos para sempre.
 *
 * ─── No idioma de cada empresa (S2a Task 5, U14) ────────────────────────────
 *
 * A linha de cada organização sai no idioma dela. A instrução é uma só, então
 * o título e o corpo vão em todo idioma num jsonb (`emCadaIdioma`) e o SQL
 * escolhe pelo `organizations.locale` da linha (`noIdiomaDaOrgSql`, o mesmo
 * resultado de `normalizarIdioma`). O dedupe e a resolução comparam o título
 * com TODO idioma do jsonb: o aviso aberto pode ter nascido antes de a empresa
 * trocar de idioma. Medido contra Postgres em
 * `tests/invariants/aviso-de-dreno-parado-no-idioma.test.ts`.
 */
import type pg from "pg";

import type { Logger } from "@/lib/agent-engine/obs/logger";
import { traduzir } from "@/lib/i18n/dicionario";
import { emCadaIdioma, noIdiomaDaOrgSql } from "@/lib/i18n/em-cada-idioma";

const TEXTOS = {
  titulo: "As respostas automáticas da IA estão paradas",
  corpo:
    "O processamento que transforma as mensagens recebidas em respostas da IA parou de avançar. As mensagens continuam chegando e ficando registradas, mas a IA não responde até o processamento voltar. Quem administra a instalação deve revisar o serviço do worker (log e /healthz) e reiniciá-lo se ele não voltar sozinho.",
} as const;

/** Título estável do episódio, em português — dedupe e resolução o procuram em todo idioma. */
export const TITULO_DRAIN_PARADO = TEXTOS.titulo;

const tituloEmCadaIdioma = () => JSON.stringify(emCadaIdioma((idioma) => traduzir(TEXTOS.titulo, idioma)));
const corpoEmCadaIdioma = () => JSON.stringify(emCadaIdioma((idioma) => traduzir(TEXTOS.corpo, idioma)));

export type EstadoDoDrain = "parado" | "saudavel";

/**
 * Sincroniza o aviso: abre o que falta quando parado, resolve tudo quando
 * saudável. Nunca lança — falha aqui vira `warn` e o incidente continua tendo
 * o 503 do `/healthz` e o log do reaper como sinais.
 */
export async function sincronizarAvisoDoDrain(
  pool: pg.Pool,
  estado: EstadoDoDrain,
  log: Logger,
): Promise<void> {
  try {
    if (estado === "saudavel") {
      await pool.query(
        `update agent_inbox_items
            set status = 'resolved', resolved_at = now()
          where kind = 'other' and status = 'open'
            and title in (select value from jsonb_each_text($1::jsonb))`,
        [tituloEmCadaIdioma()],
      );
      return;
    }
    // Uma linha por organização que ainda não tem o aviso ABERTO. Uma instrução
    // só: o `not exists` por organização é o que impede a tempestade de avisos
    // num incidente que dura dias, e o reaper chama isto a cada tique.
    await pool.query(
      `insert into agent_inbox_items (organization_id, kind, severity, title, body)
       select o.id, 'other', 'warn', ${noIdiomaDaOrgSql("$1", "o.locale")}, ${noIdiomaDaOrgSql("$2", "o.locale")}
         from organizations o
        where not exists (
          select 1 from agent_inbox_items i
           where i.organization_id = o.id and i.kind = 'other' and i.status = 'open'
             and i.title in (select value from jsonb_each_text($1::jsonb))
        )`,
      [tituloEmCadaIdioma(), corpoEmCadaIdioma()],
    );
  } catch (err) {
    log.warn("drain: falhei ao sincronizar o aviso de laço parado na Central", {
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    });
  }
}
