import type { SupabaseClient } from "@supabase/supabase-js";

import type { Logger } from "@/lib/agent-engine/obs/logger";
import { traduzir } from "@/lib/i18n/dicionario";
import { emCadaIdioma } from "@/lib/i18n/em-cada-idioma";
import { IDIOMA_PADRAO, normalizarIdioma } from "@/lib/i18n/idiomas";

/**
 * Título estável para deduplicar e depois resolver o incidente.
 *
 * `kind="other"` é deliberado: o laço rápido desligado NÃO significa evento
 * morto. O cron de segurança continua drenando a fila uma vez por minuto; o
 * estado é degradação operacional, não perda de evento.
 */
/**
 * Os textos do aviso, numa tabela de literais para a guarda do dicionário cobrar
 * cada tradução. Cada organização recebe a linha no SEU idioma (S2a Task 5,
 * U14); quem procura ou fecha o aviso procura o título em todo idioma, porque o
 * aberto pode ter nascido antes de a empresa trocar de idioma.
 */
const TEXTOS = {
  titulo: "Processamento rápido de eventos está em modo degradado",
  corpo:
    "O processamento rápido do event_log não carregou neste worker. O cron de segurança continua processando a fila, mas automações e efeitos derivados podem levar até cerca de 1 minuto a mais. Quem administra a instalação deve revisar o worker.",
} as const;

export const TITULO_LACO_EVENT_LOG_DEGRADADO = TEXTOS.titulo;

const tituloEmTodoIdioma = (): string[] => [
  ...new Set(Object.values(emCadaIdioma((idioma) => traduzir(TEXTOS.titulo, idioma)))),
];

type EstadoDoAviso = "degradado" | "saudavel";

/**
 * Fecha o laço visível do worker sem transformar a Central em causa de queda.
 *
 * - degradado: abre, no máximo, um aviso por organização;
 * - saudável: resolve todos os avisos abertos deste incidente;
 * - qualquer falha aqui vira log e NUNCA derruba o worker.
 *
 * Uma pane global precisa chegar a quem usa cada organização, porque a Central
 * tenant-aware é a superfície que existe hoje. O título estável permite
 * deduplicar entre reinícios sem adicionar schema/constraint nova.
 */
export async function sincronizarAvisoDoLacoDeEventLog(
  admin: SupabaseClient,
  estado: EstadoDoAviso,
  log: Logger,
): Promise<void> {
  try {
    if (estado === "saudavel") {
      const { error } = await admin
        .from("agent_inbox_items")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("kind", "other")
        .in("title", tituloEmTodoIdioma())
        .eq("status", "open");
      if (error) throw new Error(`resolver aviso: ${error.message}`);
      return;
    }

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
      .eq("kind", "other")
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
        kind: "other",
        severity: "warn",
        title: traduzir(TEXTOS.titulo, idiomaDe.get(organization_id) ?? IDIOMA_PADRAO),
        body: traduzir(TEXTOS.corpo, idiomaDe.get(organization_id) ?? IDIOMA_PADRAO),
        ref_kind: null,
        ref_id: null,
      })),
    );
    if (erroInsert) throw new Error(`abrir aviso: ${erroInsert.message}`);
  } catch (err) {
    // `warn`, e não `error`: o aviso na Central é acessório. O incidente do
    // laço já tem o seu `log.error` em `carregarDepsDoLaco`, e o gate da #604
    // exige zero `log.error` quando as deps carregaram — um Supabase lento no
    // boot não pode se passar por laço quebrado.
    log.warn("event-log drain: falhei ao sincronizar o aviso de degradação na Central", {
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    });
  }
}
