/**
 * As ENTRADAS dos documentos do titular — relatório de acesso, e-mail de
 * entrega, avisos do art. 12.º e atestado de anonimização — usadas pelo teste
 * do idioma (`tests/unit/lgpd-relatorio-no-idioma-do-titular.test.ts`, S2a
 * Task 13) e pelos arquivos de `tests/fixtures/lgpd-documentos-antes-da-t13/`,
 * que foram gravados rodando ESTAS entradas contra o código anterior à Task 13.
 *
 * Toda seção que o PDF desenha recebe uma linha, para toda frase fixa sair.
 * Os VALORES são neutros (códigos, números, nomes curtos): o teste procura
 * palavra portuguesa no documento traduzido, e um dado em português seria
 * falso positivo.
 */
import type { ReactElement, ReactNode } from "react";

import type { MarcaDeSaida } from "@/lib/branding/saida";
import type { AvisoArt12 } from "@/lib/lgpd/avisos-do-artigo-12";
import type { DadosDoAtestado } from "@/lib/lgpd/atestado-de-anonimizacao";
import type { ExportPayload } from "@/lib/lgpd/export-collector";
import type { PerfilDoPais } from "@/lib/legal/perfil-do-pais";

export const MARCA: MarcaDeSaida = {
  nome: "Silva & Filhos",
  logoUrl: null,
  accent: "#2f6f4e",
  accentFg: "#ffffff",
  origens: { nome: "banco", cor: "banco" },
};

export const PEDIDO = "3f2a9c10-0000-4000-8000-000000000001";

/** O texto de cada nó de React, na ordem: é assim que os fixtures do doc 88 comparam o PDF. */
export function textos(no: ReactNode): string[] {
  if (no === null || no === undefined || typeof no === "boolean") return [];
  if (typeof no === "string") return [no];
  if (typeof no === "number") return [String(no)];
  if (Array.isArray(no)) return no.flatMap(textos);
  const el = no as ReactElement<{ children?: ReactNode }>;
  if (el.props && "children" in el.props) return textos(el.props.children);
  return [];
}

/** Os agentes de IA no ar que a alínea h) descreve: um automático e um assistido. */
export const AGENTES_NO_AR = [
  {
    id: "ag-1",
    name: "Bot A",
    operation_mode: "automatic",
    paused_at: null,
    published_version_id: "v1",
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "ag-2",
    name: "Bot B",
    operation_mode: "assisted",
    paused_at: null,
    published_version_id: "v1",
    archived_at: null,
    created_at: "2026-01-02T00:00:00.000Z",
  },
];

/** A linha de `organizations` que o coletor lê, para um país e um fuso. */
export function linhaDaOrganizacao(country: string | null, timezone: string): Record<string, unknown> {
  return {
    legal_name: "Bem Viver BV",
    display_name: "Bem Viver",
    dpo_email: null,
    country,
    timezone,
  };
}

/**
 * O payload do coletor com uma linha em TODA seção que o PDF desenha. As datas
 * são fixas: o texto comparado não pode depender do relógio.
 */
export function comTodasAsSecoes(base: ExportPayload): ExportPayload {
  const quando = "2026-10-05T12:34:56.000Z";
  return {
    ...base,
    generated_at: quando,
    no_local_footprint: true,
    contact: {
      id: "c1",
      name: "Ana",
      display_name: "Ana",
      email: "ana@x.test",
      phone_number: "+3200000000",
      street: "Kerkstraat",
      number: "1",
      complement: null,
      district: null,
      city: "Gent",
      state: null,
      zip_code: "9000",
      cpf_present: false,
      cpf_informado_na_conversa: false,
      custom_fields: {},
      campos_legiveis: [{ rotulo: "Q1", valor: "A1" }],
      source: "whatsapp",
      created_at: "2026-01-02T03:04:05.000Z",
      is_anonymized: false,
    } as never,
    consents: [
      { scope: "marketing", granted: true, granted_at: "2026-02-03T04:05:06.000Z" } as never,
      { scope: "profiling", granted: false, granted_at: null } as never,
    ],
    conversations: [
      {
        id: "conv0001-0000",
        channel: "whatsapp",
        status: "open",
        last_message_at: quando,
        created_at: quando,
      } as never,
    ],
    messages_count_total: 2,
    messages_recent: [
      {
        id: "m1",
        created_at: quando,
        direction: "inbound",
        type: "text",
        status: "delivered",
        body: "Hallo",
        has_media: false,
        media_derived_text: null,
      } as never,
      {
        id: "m2",
        created_at: quando,
        direction: "inbound",
        type: "audio",
        status: "delivered",
        body: null,
        has_media: true,
        media_derived_text: "OK",
      } as never,
    ],
    group_messages_authored: [
      {
        id: "g1",
        created_at: quando,
        type: "image",
        body: null,
        has_media: true,
        media_derived_text: "OK",
      } as never,
    ],
    leads: [
      { id: "l1", title: null, status: "open", value_cents: 1250, currency: "EUR", created_at: quando } as never,
    ],
    orders: [
      {
        id: "o1-0000000",
        external_provider: "shop",
        external_id: "1001",
        status: "paid",
        total_cents: 990,
        currency: "EUR",
        ordered_at: quando,
      } as never,
    ],
    proposals: [
      {
        id: "p1",
        numero: 42,
        ano: 2026,
        titulo: "X-1",
        status: "sent",
        total_cents: 10000,
        moeda: "EUR",
        created_at: quando,
        sent_at: quando,
        tem_pdf: true,
      } as never,
    ],
    appointments: [
      {
        id: "a1",
        title: null,
        status: "confirmed",
        location_details: "Gent",
        starts_at: quando,
        ends_at: quando,
        time_zone: "Europe/Brussels",
        description: "X",
        notes: "Y",
        meeting_url: "https://meet.test/abc",
        cancellation_reason: "Z",
      } as never,
    ],
    reply_drafts: [
      {
        id: "r1",
        status: "approved",
        original_body: "A",
        edited_body: "B",
        approved_body: "B",
        feedback: { ok: true },
        proposals: [{ x: 1 }],
        created_at: quando,
      } as never,
    ],
    meeting_deliveries: [
      { id: "md1", status: "done", appointment_id: null, created_at: quando, run_after: quando } as never,
      { id: "md2", status: "estranho", appointment_id: "a1", created_at: quando, run_after: quando } as never,
    ],
    appointment_notices: [
      {
        id: "an1",
        title: "T",
        status: "resolved",
        body: "B",
        ref_id: null,
        created_at: quando,
        resolved_at: quando,
      } as never,
    ],
    webhook_captures: [
      {
        id: "w1",
        source_name: null,
        outcome: "created",
        received_at: quando,
        remote_ip: "203.0.113.7",
        user_agent: "UA/1.0",
      } as never,
    ],
    audit_log_extract: [
      { id: "au1", created_at: quando, action: "contact.view", resource_type: "contact" } as never,
    ],
  };
}

/** O mesmo contato com o documento guardado (a outra linha do rótulo do documento). */
export function comDocumentoGuardado(p: ExportPayload): ExportPayload {
  return { ...p, contact: { ...(p.contact as object), cpf_present: true } as never };
}

/** O mesmo contato com o CPF que veio da conversa, mas sem valor achado (a frase sem dígito). */
export function comCpfDaConversa(p: ExportPayload): ExportPayload {
  return { ...p, contact: { ...(p.contact as object), cpf_informado_na_conversa: true } as never };
}

export const RECEBIDO = new Date("2026-09-10T12:00:00Z");

/** Os quatro avisos do art. 12.º: apagamento dentro e fora do prazo, recusa e prorrogação. */
export function avisosDe(perfil: PerfilDoPais, prazo: Date): AvisoArt12[] {
  const base = {
    requestId: "abcd1234-ef00-4000-8000-000000000000",
    marca: MARCA,
    perfil,
    prazoDeUmMes: prazo,
    recebidoEm: RECEBIDO,
    agora: new Date("2026-09-11T12:00:00Z"),
    fuso: "Europe/Brussels",
  } as const;
  return [
    { ...base, desfecho: "apagamento" },
    { ...base, desfecho: "apagamento", agora: new Date("2026-11-01T12:00:00Z") },
    { ...base, desfecho: "recusa", motivo: "X-1 <b>" },
    { ...base, desfecho: "prorrogacao", motivo: "X-2", novaData: new Date("2026-11-10T12:00:00Z") },
  ];
}

/** Os dados do atestado nas formas que o papel distingue. */
export function atestados(): DadosDoAtestado[] {
  const base: DadosDoAtestado = {
    request_id: "11111111-2222-3333-4444-555555555555",
    organization_id: "org-1",
    organization_name: "Bem Viver BV",
    organization_document: "0123.456.749",
    organization_email: "dpo@x.test",
    evidencia: {
      executor: { user_id: "u1", nome: "Ana", email: "ana@x.test", papel: "admin" },
      ip: "203.0.113.7",
      em: "2026-10-22T15:04:05.000Z",
      origem: "aprovacao_manual",
    },
    escopo: "contact",
    fuso: "Europe/Brussels",
  };
  return [
    base,
    {
      ...base,
      organization_document: null,
      organization_email: null,
      evidencia: { executor: null, ip: null, em: base.evidencia.em, origem: "automatica" },
      escopo: "tenant",
    },
  ];
}
