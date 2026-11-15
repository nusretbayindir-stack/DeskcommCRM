/**
 * O painel do detalhe do pedido do titular (U53): tudo o que a tela do admin
 * mostra além da linha do pedido — como chegou, quem abriu, para onde vai o
 * relatório, os avisos antes de aprovar, a mensagem pronta e o encerramento.
 *
 * Só servidor (lê o banco com o cliente de serviço e importa regras que usam
 * `node:crypto`). A tela e o hook importam daqui APENAS o tipo
 * (`import type`), nunca um valor.
 *
 * Dado de apoio que não puder ser lido (quem abriu o pedido, a última conversa,
 * a recusa pronta) vira `null`: o detalhe do pedido continua abrindo.
 */
import { idiomaDaOrgPeloSupabase } from "@/lib/ai/agents/idioma-da-org";
import { marcaDaSaida } from "@/lib/branding/saida";
import { traduzir } from "@/lib/i18n/dicionario";
import { alineasDoArt15Visiveis, art15DoControlador } from "@/lib/legal/art15";
import { perfilDaOrganizacao } from "@/lib/legal/perfil-do-pais";
import { exigeAvisoAntesDaAprovacao } from "@/lib/lgpd/aviso-whatsapp-antes-da-exclusao";
import { montarAvisoArt12, prazoDeUmMes } from "@/lib/lgpd/avisos-do-artigo-12";
import { MOTIVOS_DE_ENCERRAMENTO, type MotivoDeEncerramento } from "@/lib/lgpd/encerramento";
import { idiomaDoTitular } from "@/lib/lgpd/idioma-do-titular";
import { enderecoDeEntrega, type CanalDoPedido } from "@/lib/lgpd/pedido-manual";

export interface PainelDoPedido {
  abertura: {
    canal: CanalDoPedido;
    observacao: string | null;
    criado_por_nome: string | null;
    criado_em: string;
  } | null;
  /** `enderecoDeEntrega`: para onde o relatório vai. */
  destino_do_relatorio: string | null;
  /** Pedido de acesso, fora do Brasil, com as três alíneas do art. 15 em branco. */
  art15_vazio: boolean;
  /** Exclusão cujo contato tem um pedido de acesso ainda aberto. */
  acesso_aberto: boolean;
  /** A aprovação exige o aviso pelo WhatsApp (a mesma regra da rota de aprovação). */
  exclusao_sem_email: boolean;
  mensagem_de_exclusao: string | null;
  conversa_href: string | null;
  aviso_por_email_disponivel: boolean;
  encerramento: { motivo_codigo: MotivoDeEncerramento; nota: string | null; em: string } | null;
  entrega_manual: { nota: string | null; em: string } | null;
  recusa_pronta: string | null;
}

export interface EntradaDoPainel {
  orgId: string;
  pedido: {
    id: string;
    request_type: string;
    status: string;
    contact_id: string | null;
    received_at: string;
    request_payload: unknown;
    result: unknown;
  };
  emailDoContato: string | null;
}

/** O texto-fonte (pt) do aviso da exclusão; o catálogo traduz e `{empresa}` vira a marca. */
const MENSAGEM_DE_EXCLUSAO =
  "A seu pedido, os seus dados nos registros de {empresa} serão apagados hoje. Esta é a última mensagem que você recebe de nós.";

const STATUS_DE_ACESSO_ABERTO = ["received", "processing", "pending_review"];

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Só o que o painel usa do cliente admin; as cadeias do Supabase são tipadas pelo chamador. */
interface LeitorAdmin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(tabela: string): { select(colunas: string): any };
  auth?: { admin?: { getUserById(id: string): Promise<{ data?: { user?: unknown } | null }> } };
}

async function nomeDeQuemAbriu(db: LeitorAdmin, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const resposta = await db.auth?.admin?.getUserById(userId);
    const u = (resposta?.data?.user ?? null) as {
      email?: unknown;
      user_metadata?: { full_name?: unknown } | null;
    } | null;
    return texto(u?.user_metadata?.full_name) ?? texto(u?.email);
  } catch {
    return null;
  }
}

export async function painelDoPedido(admin: unknown, i: EntradaDoPainel): Promise<PainelDoPedido> {
  const db = admin as LeitorAdmin;
  const { orgId, pedido, emailDoContato } = i;
  const payload = objeto(pedido.request_payload);
  const result = objeto(pedido.result);
  const perfil = await perfilDaOrganizacao(admin as never, orgId);
  const foraDoBrasil = perfil.codigo !== "BR";

  // ── como chegou e quem abriu ────────────────────────────────────────────────
  const manual =
    payload.origem_manual && typeof payload.origem_manual === "object" ? objeto(payload.origem_manual) : null;
  const abertura: PainelDoPedido["abertura"] = manual
    ? {
        canal: manual.canal as CanalDoPedido,
        observacao: texto(manual.observacao),
        criado_por_nome: await nomeDeQuemAbriu(db, texto(manual.criado_por)),
        criado_em: String(manual.criado_em ?? ""),
      }
    : null;

  const destino_do_relatorio = enderecoDeEntrega(payload, emailDoContato);

  // ── pedido de acesso: alíneas do art. 15 vazias ─────────────────────────────
  let art15_vazio = false;
  if (pedido.request_type === "data_request" && alineasDoArt15Visiveis(perfil.codigo)) {
    const { data: org } = await db.from("organizations").select("settings").eq("id", orgId).maybeSingle();
    const a = art15DoControlador((org as { settings?: unknown } | null)?.settings);
    art15_vazio = !a.finalidades && !a.destinatarios && !a.prazo_conservacao;
  }

  // ── exclusão: acesso ainda aberto do mesmo contato ──────────────────────────
  let acesso_aberto = false;
  if (pedido.request_type === "redact" && pedido.contact_id) {
    const { data: abertos } = await db
      .from("lgpd_requests")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", pedido.contact_id)
      .eq("request_type", "data_request")
      .in("status", STATUS_DE_ACESSO_ABERTO)
      .limit(1);
    acesso_aberto = Array.isArray(abertos) && abertos.length > 0;
  }

  // ── exclusão sem e-mail: a MESMA regra que a rota de aprovação cobra ────────
  const exclusao_sem_email = exigeAvisoAntesDaAprovacao({
    contactId: pedido.contact_id,
    requestType: pedido.request_type,
    paisCodigo: perfil.codigo,
    emailDoContato,
    payload,
  });

  // O idioma do titular é lido uma vez só, e só quando um texto precisa dele.
  let idiomaLido: { valor: Awaited<ReturnType<typeof idiomaDoTitular>> } | null = null;
  const idiomaDoDocumento = async () => {
    if (!idiomaLido) {
      idiomaLido = {
        valor: await idiomaDoTitular(admin, {
          organizationId: orgId,
          contactId: pedido.contact_id,
          pais: perfil.codigo,
        }),
      };
    }
    return idiomaLido.valor;
  };

  let mensagem_de_exclusao: string | null = null;
  let conversa_href: string | null = null;
  if (exclusao_sem_email && pedido.contact_id) {
    const idioma = (await idiomaDoDocumento()) ?? (await idiomaDaOrgPeloSupabase(admin, orgId));
    const marca = await marcaDaSaida(orgId, { semMemo: true });
    mensagem_de_exclusao = traduzir(MENSAGEM_DE_EXCLUSAO, idioma).replace("{empresa}", marca.nome);

    const { data: conversas } = await db
      .from("conversations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", pedido.contact_id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const conversaId = Array.isArray(conversas) ? texto((conversas[0] as { id?: unknown } | undefined)?.id) : null;
    conversa_href = conversaId ? `/app/inbox/${conversaId}` : null;
  }

  const aviso_por_email_disponivel = foraDoBrasil && Boolean(texto(emailDoContato));

  // ── fechamento ──────────────────────────────────────────────────────────────
  const enc = result.encerramento && typeof result.encerramento === "object" ? objeto(result.encerramento) : null;
  const motivo = (MOTIVOS_DE_ENCERRAMENTO as readonly unknown[]).includes(enc?.motivo_codigo)
    ? (enc?.motivo_codigo as MotivoDeEncerramento)
    : null;
  const encerramento: PainelDoPedido["encerramento"] =
    enc && motivo ? { motivo_codigo: motivo, nota: texto(enc.nota), em: String(enc.em ?? "") } : null;

  const entrega =
    result.entrega_manual && typeof result.entrega_manual === "object" ? objeto(result.entrega_manual) : null;
  const entrega_manual: PainelDoPedido["entrega_manual"] = entrega
    ? { nota: texto(entrega.nota), em: String(entrega.em ?? "") }
    : null;

  // ── recusa pronta: identidade não confirmada, fora do Brasil, sem e-mail ────
  let recusa_pronta: string | null = null;
  if (
    pedido.status === "failed" &&
    encerramento?.motivo_codigo === "identidade_nao_confirmada" &&
    foraDoBrasil &&
    !texto(emailDoContato)
  ) {
    try {
      const marca = await marcaDaSaida(orgId, { semMemo: true });
      const { data: org } = await db.from("organizations").select("timezone").eq("id", orgId).maybeSingle();
      const recebidoEm = new Date(pedido.received_at);
      recusa_pronta = montarAvisoArt12({
        desfecho: "recusa",
        motivo: encerramento.nota,
        requestId: pedido.id,
        marca,
        perfil,
        prazoDeUmMes: prazoDeUmMes(recebidoEm),
        recebidoEm,
        fuso: texto((org as { timezone?: unknown } | null)?.timezone) ?? undefined,
        idioma: (await idiomaDoDocumento()) ?? undefined,
      }).text;
    } catch {
      recusa_pronta = null;
    }
  }

  return {
    abertura,
    destino_do_relatorio,
    art15_vazio,
    acesso_aberto,
    exclusao_sem_email,
    mensagem_de_exclusao,
    conversa_href,
    aviso_por_email_disponivel,
    encerramento,
    entrega_manual,
    recusa_pronta,
  };
}
