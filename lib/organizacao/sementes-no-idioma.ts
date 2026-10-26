/**
 * A EMPRESA NOVA NASCE NO IDIOMA DELA — as sementes do banco, traduzidas.
 *
 * ─── O defeito ─────────────────────────────────────────────────────────────
 *
 * Dois gatilhos em `organizations` semeiam toda empresa nova em português:
 * `fn_semear_tipos_de_agendamento` (Consulta, Reunião, Atendimento) e
 * `fn_seed_default_pipeline_for_org` (o funil "Pedidos", de e-commerce, com
 * oito etapas). E `organizations.locale` nasce `pt-BR`. Uma empresa turca
 * criada pelo painel de administração abria a Agenda com "Atendimento", o
 * Kanban com "Carrinho abandonado" — e o convite do dono saía em português.
 *
 * ─── Por que aqui, e não nos gatilhos ──────────────────────────────────────
 *
 * Os gatilhos rodam no INSERT, antes de existir idioma para consultar, e
 * mudá-los é migration num schema que vem de outro repositório. Aqui é o passo
 * logo depois: quem cria a empresa já sabe o idioma dela, grava, e renomeia o
 * que a semente pôs. Os slugs não mudam — é por eles que o resto do sistema
 * reconhece as linhas.
 *
 * ─── Só o que ainda é semente ──────────────────────────────────────────────
 *
 * Toda escrita é guardada pelo nome português da semente: o tipo que o dono já
 * renomeou não é tocado, o funil que ele já mudou também não. Por isso pode
 * rodar de novo (retentativa da criação, passo do funil pulado) sem estragar
 * nada.
 *
 * `Record<Idioma, …>`, como `vocabulario-padrao.ts`: idioma novo promovido no
 * registro obriga a escolher os nomes aqui. O português é EXATAMENTE o que os
 * gatilhos gravam — vigiado em `sementes-no-idioma.test.ts`, que lê o
 * `baseline.sql`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Idioma } from "@/lib/i18n/idiomas";
import { vocabularioDoFunilPadrao } from "@/lib/pipelines/vocabulario-padrao";

type SlugDoTipo = "consulta" | "reuniao" | "atendimento";
type SlugDaEtapa =
  | "carrinho_abandonado"
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "enviado"
  | "entregue"
  | "pos_venda"
  | "cancelado";

export const TIPOS_DA_AGENDA_SEMEADOS: Record<Idioma, Record<SlugDoTipo, string>> = {
  "pt-BR": { consulta: "Consulta", reuniao: "Reunião", atendimento: "Atendimento" },
  es: { consulta: "Consulta", reuniao: "Reunión", atendimento: "Atención" },
  tr: { consulta: "Danışma", reuniao: "Toplantı", atendimento: "Görüşme" },
};

/** O funil do gatilho. `Ödendi` e `İptal edildi` são as mesmas palavras de `vocabulario-padrao.ts`. */
export const FUNIL_SEMEADO: Record<Idioma, { nome: string; etapas: Record<SlugDaEtapa, string> }> = {
  "pt-BR": {
    nome: "Pedidos",
    etapas: {
      carrinho_abandonado: "Carrinho abandonado",
      aguardando_pagamento: "Aguardando pagamento",
      pago: "Pago",
      em_separacao: "Em separação",
      enviado: "Enviado",
      entregue: "Entregue",
      pos_venda: "Pós-venda",
      cancelado: "Cancelado",
    },
  },
  es: {
    nome: "Pedidos",
    etapas: {
      carrinho_abandonado: "Carrito abandonado",
      aguardando_pagamento: "Esperando pago",
      pago: "Pagado",
      em_separacao: "En preparación",
      enviado: "Enviado",
      entregue: "Entregado",
      pos_venda: "Posventa",
      cancelado: "Cancelado",
    },
  },
  tr: {
    nome: "Siparişler",
    etapas: {
      carrinho_abandonado: "Terk edilen sepet",
      aguardando_pagamento: "Ödeme bekleniyor",
      pago: "Ödendi",
      em_separacao: "Hazırlanıyor",
      enviado: "Kargoya verildi",
      entregue: "Teslim edildi",
      pos_venda: "Satış sonrası",
      cancelado: "İptal edildi",
    },
  },
};

const SLUG_DO_FUNIL_SEMEADO = "pedidos";

type Resultado = { error: { message: string } | null };

/** Uma escrita; a falha vai para o log e volta como `false`, nunca como exceção. */
async function escrever(rotulo: string, escrita: PromiseLike<Resultado>): Promise<boolean> {
  try {
    const { error } = await escrita;
    if (!error) return true;
    console.error(`[sementes-no-idioma] ${rotulo}:`, error.message);
  } catch (err) {
    console.error(`[sementes-no-idioma] ${rotulo}:`, err instanceof Error ? err.message : err);
  }
  return false;
}

/** O vocabulário ainda é o default do banco (o português), ou nem existe. */
function vocabularioIntocado(atual: Record<string, unknown> | null | undefined): boolean {
  if (!atual) return true;
  const padrao = vocabularioDoFunilPadrao("pt-BR");
  return (Object.keys(padrao) as (keyof typeof padrao)[]).every(
    (k) => atual[k] === undefined || atual[k] === padrao[k],
  );
}

/**
 * Renomeia, para `idioma`, as linhas que os gatilhos semearam e ninguém mexeu:
 * os tipos de agendamento, o funil "Pedidos", as etapas dele e as palavras do
 * funil. `true` = toda escrita passou (ou não havia o que escrever). Não lança:
 * nome de semente é acabamento, e quem chama já criou a empresa.
 */
export async function sementesNoIdioma(
  admin: SupabaseClient,
  orgId: string,
  idioma: Idioma,
): Promise<boolean> {
  if (idioma === "pt-BR") return true;

  const escritas: Promise<boolean>[] = [];
  const tiposPt = TIPOS_DA_AGENDA_SEMEADOS["pt-BR"];
  for (const slug of Object.keys(tiposPt) as SlugDoTipo[]) {
    escritas.push(
      escrever(
        `tipo de agendamento ${slug}`,
        admin
          .from("calendar_event_types")
          .update({ name: TIPOS_DA_AGENDA_SEMEADOS[idioma][slug] })
          .eq("organization_id", orgId)
          .eq("slug", slug)
          .eq("name", tiposPt[slug]),
      ),
    );
  }

  const { data: funil, error } = await admin
    .from("crm_pipelines")
    .select("id, name, vocabulary")
    .eq("organization_id", orgId)
    .eq("slug", SLUG_DO_FUNIL_SEMEADO)
    .maybeSingle();
  if (error) {
    console.error("[sementes-no-idioma] funil semeado:", error.message);
    escritas.push(Promise.resolve(false));
  }

  if (funil) {
    const funilPt = FUNIL_SEMEADO["pt-BR"];
    const mudancas: Record<string, unknown> = {};
    if (funil.name === funilPt.nome) mudancas.name = FUNIL_SEMEADO[idioma].nome;
    if (vocabularioIntocado(funil.vocabulary)) mudancas.vocabulary = vocabularioDoFunilPadrao(idioma);
    if (Object.keys(mudancas).length > 0) {
      escritas.push(
        escrever(
          "funil semeado",
          admin.from("crm_pipelines").update(mudancas).eq("id", funil.id).eq("organization_id", orgId),
        ),
      );
    }
    for (const slug of Object.keys(funilPt.etapas) as SlugDaEtapa[]) {
      escritas.push(
        escrever(
          `etapa ${slug}`,
          admin
            .from("crm_stages")
            .update({ name: FUNIL_SEMEADO[idioma].etapas[slug] })
            .eq("organization_id", orgId)
            .eq("pipeline_id", funil.id)
            .eq("slug", slug)
            .eq("name", funilPt.etapas[slug]),
        ),
      );
    }
  }

  return (await Promise.all(escritas)).every(Boolean);
}

/**
 * Grava o idioma e o fuso que quem criou a empresa escolheu e, com idioma,
 * traduz as sementes. Vem ANTES do convite do dono: o e-mail sai no idioma da
 * organização. `false` = a organização não gravou — e aí as sementes ficam
 * como estão, para não traduzir para um idioma que a empresa não tem.
 */
export async function gravarIdiomaEFuso(
  admin: SupabaseClient,
  orgId: string,
  escolha: { locale?: Idioma; timezone?: string },
): Promise<boolean> {
  const mudancas: { locale?: Idioma; timezone?: string } = {};
  if (escolha.locale) mudancas.locale = escolha.locale;
  if (escolha.timezone) mudancas.timezone = escolha.timezone;
  if (Object.keys(mudancas).length === 0) return true;

  const gravou = await escrever(
    "idioma e fuso da organização",
    admin.from("organizations").update(mudancas).eq("id", orgId),
  );
  if (!gravou) return false;
  if (escolha.locale) await sementesNoIdioma(admin, orgId, escolha.locale);
  return true;
}
