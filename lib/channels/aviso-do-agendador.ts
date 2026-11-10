/**
 * A FALHA DO AGENDADOR VIRA AVISO NA CENTRAL — critério 6 da #2388.
 *
 * ─── O defeito que este módulo fecha ────────────────────────────────────────
 *
 * O cron `channel-pause-scheduler` pausa e retoma as janelas de manutenção
 * sozinho. Quando uma batida FALHA (erro de banco, escrita recusada), hoje o
 * erro sai só no log do processo: quem opera não fica sabendo, e a janela pode
 * ter deixado de pausar — ou de retomar — no horário marcado, em silêncio. A
 * janela de manutenção existe justamente para quem foi dormir; a falha dela
 * precisa alcançar o mesmo operador na tela em que ele olha os avisos.
 *
 * ─── Por que REUSA o caminho que já existe, e não inventa canal ──────────────
 *
 * A Central é a `agent_inbox_items`, a mesma superfície dos outros avisos, e a
 * lição do laço do `canal-mudo-watcher` (DoD 13) já está provada aqui: o MESMO
 * emissor abre quando a falha aparece e FECHA quando ela deixa de valer. Sem a
 * volta, o aviso vira lista que ninguém lê — e, no dia seguinte, mentira.
 *
 * O `kind` é `other` e não um valor novo: um agendador quebrado é degradação
 * operacional da instalação, não um item de um canal. É a mesma escolha de
 * `lib/event-log/aviso-do-laco.ts` para a pane do worker de eventos — e é o que
 * evita uma migration de vocabulário por um aviso que não é de canal nenhum.
 *
 * ─── UM aviso, não um por canal ─────────────────────────────────────────────
 *
 * A falha é da BATIDA, não de um canal: abre no máximo um aviso por organização
 * (a Central é tenant-aware; `organization_id = null` não apareceria para
 * ninguém), nunca um por canal — é a régua explícita do critério 6.
 *
 * ─── Best-effort, e por quê ─────────────────────────────────────────────────
 *
 * Escrever o aviso é ACESSÓRIO à batida: uma Central lenta não pode transformar
 * "tentei e avisei" em "não tentei". Por isso esta função NUNCA lança — devolve
 * nada e loga `warn`; o erro real da batida segue o caminho dele (500 na rota e
 * log `error`, ou `resumo.falhas` no relatório).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Logger } from "@/lib/agent-engine/obs/logger";
import { traduzir } from "@/lib/i18n/dicionario";
import { emCadaIdioma } from "@/lib/i18n/em-cada-idioma";
import { IDIOMA_PADRAO, normalizarIdioma } from "@/lib/i18n/idiomas";

const TEXTOS = {
  titulo: "A pausa agendada de conexões não está sendo aplicada",
  corpo:
    "O agendador das janelas de manutenção não conseguiu aplicar uma batida: uma janela pode ter deixado de pausar ou de retomar no horário marcado. A próxima tentativa é automática; se este aviso continuar aberto, verifique o log do agendador.",
} as const;

/**
 * Título estável: é ele que deduplica a abertura entre batidas e identifica o
 * incidente no dia em que a falha deixa de valer (o fechamento filtra por ele,
 * em todo idioma).
 */
export const TITULO_DO_AVISO_DO_AGENDADOR = TEXTOS.titulo;

export const CORPO_DO_AVISO_DO_AGENDADOR = TEXTOS.corpo;

/**
 * Cada organização recebe o aviso no SEU idioma (S2a Task 5, U14); quem procura
 * ou fecha o aviso procura o título em todo idioma, porque o aberto pode ter
 * nascido antes de a empresa trocar de idioma.
 */
const tituloEmTodoIdioma = (): string[] => [
  ...new Set(Object.values(emCadaIdioma((idioma) => traduzir(TEXTOS.titulo, idioma)))),
];

/**
 * O `kind` do aviso em `agent_inbox_items` (vocabulário fechado por CHECK).
 *
 * `other` de propósito: degradação operacional da instalação, não de um canal —
 * ver `lib/event-log/aviso-do-laco.ts`, que usa o mesmo valor pelo mesmo motivo.
 */
const KIND_DO_AVISO = "other";

export type EstadoDoAgendador =
  /**
   * A batida não foi aplicada (lançou, ou recusou escrita): abre/mantém o aviso.
   * O `motivo` é detalhe técnico: vai só para o LOG. O corpo do aviso é fixo,
   * como em `lib/event-log/aviso-do-laco.ts`.
   */
  | { estado: "falhou"; motivo: string }
  /** A batida foi aplicada por inteiro: o incidente — se havia — deixou de valer. */
  | { estado: "saudavel" };

/**
 * Sincroniza o aviso da Central com o desfecho de UMA batida.
 *
 * - `saudavel`: fecha todos os avisos abertos deste incidente (idempotente);
 * - `falhou`: abre um aviso por organização que ainda não tenha um aberto, com
 *   corpo fixo (o motivo vai só para o log);
 * - qualquer falha aqui é logada e NUNCA sobe para quem chamou.
 */
export async function sincronizarAvisoDoAgendador(
  admin: SupabaseClient,
  estado: EstadoDoAgendador,
  log: Logger,
): Promise<void> {
  try {
    if (estado.estado === "saudavel") {
      // LER ANTES DE ESCREVER (#3695). Sem aviso aberto não há o que fechar, e
      // o PATCH incondicional custava uma escrita por minuto na Central de uma
      // instalação saudável — a rodada de `channel-pause-scheduler` é de um
      // minuto e a caixa fica vazia justamente quando está tudo bem. O `update`
      // continua com `status = 'open'` no filtro: entre esta leitura e a
      // escrita, quem clicou em "resolver" ganha a corrida.
      const { data: abertos, error: erroLeitura } = await admin
        .from("agent_inbox_items")
        .select("id")
        .eq("kind", KIND_DO_AVISO)
        .in("title", tituloEmTodoIdioma())
        .eq("status", "open")
        .limit(1);
      if (erroLeitura) throw new Error(`ler avisos abertos: ${erroLeitura.message}`);
      if ((abertos ?? []).length === 0) return;

      const { error } = await admin
        .from("agent_inbox_items")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("kind", KIND_DO_AVISO)
        .in("title", tituloEmTodoIdioma())
        .eq("status", "open");
      if (error) throw new Error(`resolver aviso: ${error.message}`);
      return;
    }

    // Um aviso por organização — a falha da batida vale para a instalação toda,
    // e a Central é tenant-aware. Nunca um por canal (critério 6).
    const { data: organizacoes, error: erroOrganizacoes } = await admin
      .from("organizations")
      .select("id, locale");
    if (erroOrganizacoes) throw new Error(`listar organizações: ${erroOrganizacoes.message}`);

    const idiomaDe = new Map(
      (organizacoes ?? [])
        .filter((o) => Boolean(o.id))
        .map((o) => [o.id as string, normalizarIdioma((o.locale as string | null) ?? null)] as const),
    );
    const ids = [...idiomaDe.keys()];
    if (ids.length === 0) return;

    const { data: existentes, error: erroExistentes } = await admin
      .from("agent_inbox_items")
      .select("organization_id")
      .eq("kind", KIND_DO_AVISO)
      .in("title", tituloEmTodoIdioma())
      .eq("status", "open");
    if (erroExistentes) throw new Error(`listar avisos existentes: ${erroExistentes.message}`);

    const jaAvisadas = new Set(
      (existentes ?? [])
        .map((item) => item.organization_id as string | null)
        .filter((id): id is string => typeof id === "string"),
    );
    const faltantes = ids.filter((id) => !jaAvisadas.has(id));
    if (faltantes.length === 0) return;

    const { error: erroInsert } = await admin.from("agent_inbox_items").insert(
      faltantes.map((organization_id) => ({
        organization_id,
        kind: KIND_DO_AVISO,
        severity: "warn" as const,
        title: traduzir(TEXTOS.titulo, idiomaDe.get(organization_id) ?? IDIOMA_PADRAO),
        body: traduzir(TEXTOS.corpo, idiomaDe.get(organization_id) ?? IDIOMA_PADRAO),
        ref_kind: null,
        ref_id: null,
      })),
    );
    if (erroInsert) throw new Error(`abrir aviso: ${erroInsert.message}`);
    log.info("[channel-pause-scheduler] aviso do agendador aberto na Central", {
      organizacoes: faltantes.length,
      motivo: estado.motivo.slice(0, 300),
    });
  } catch (err) {
    // `warn`, e não `error`: o aviso na Central é acessório. O incidente da
    // batida já tem o seu `log.error` (ou o 500 da rota); uma Central lenta não
    // pode se passar por agendador quebrado.
    log.warn("[channel-pause-scheduler] falhei ao sincronizar o aviso do agendador na Central", {
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    });
  }
}
