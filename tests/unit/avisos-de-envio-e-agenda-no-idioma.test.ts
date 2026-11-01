/**
 * Três avisos da Central no idioma da organização (U14, lote 3).
 *
 * A Central mostra o título e o corpo GRAVADOS em `agent_inbox_items`; estes
 * produtores escreviam em português para qualquer conta:
 * - `recover-stuck-messages`: "Uma resposta não chegou ao cliente" — o aviso
 *   `critical` de quando o envio do WhatsApp trava;
 * - o lembrete da agenda sem canal (`atualizarAvisoDeRemetente`);
 * - `snooze-watcher`: "Lead não respondeu no prazo".
 *
 * Português continua sem mudança de byte; idioma que não se lê vale português
 * (`idiomaDaOrgPeloSupabase` não lança).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ admin: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => estado.admin }));
vi.mock("@/lib/auth/cron-auth", () => ({ autorizaCron: () => true }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/messaging/falha-de-entrega", async (orig) => ({
  ...(await orig<typeof import("@/lib/messaging/falha-de-entrega")>()),
  emitirFalhaDeEntrega: vi.fn(async () => undefined),
}));

import { recoverStuckMessages } from "@/app/api/v1/cron/recover-stuck-messages/route";
import { GET as snoozeWatcher } from "@/app/api/v1/cron/snooze-watcher/route";
import { atualizarAvisoDeRemetente } from "@/lib/agenda/aviso-de-remetente";

const ORG = "22222222-2222-4222-8222-222222222222";

type Linha = Record<string, unknown>;

/**
 * Dublê do client: cada `from(tabela)` devolve uma cadeia que aceita os métodos
 * que estes três produtores usam e resolve conforme a tabela e a operação.
 * `organizations` responde o `locale` (ou falha, se pedido).
 */
function fakeAdmin(o: {
  locale?: string | null;
  falhaNoIdioma?: boolean;
  mensagens?: Linha[];
  conversas?: Linha[];
  avisoAberto?: Linha | null;
}) {
  const inseridos: Linha[] = [];
  const atualizados: Linha[] = [];
  const admin = {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from(tabela: string) {
      let op: "select" | "update" | "insert" = "select";
      const b: Record<string, unknown> = {};
      const devolve = (): { data: unknown; error: unknown } => {
        if (tabela === "messages" && op === "select") return { data: o.mensagens ?? [], error: null };
        if (tabela === "messages" && op === "update")
          return { data: (o.mensagens ?? []).map((m) => ({ id: m.id })), error: null };
        if (tabela === "conversations" && op === "select") return { data: o.conversas ?? [], error: null };
        if (tabela === "conversations" && op === "update") return { data: { id: "conv-1" }, error: null };
        return { data: null, error: null };
      };
      Object.assign(b, {
        select: () => b,
        update: (v: Linha) => {
          op = "update";
          if (tabela === "agent_inbox_items") atualizados.push(v);
          return b;
        },
        insert: (v: Linha) => {
          op = "insert";
          if (tabela === "agent_inbox_items") inseridos.push(v);
          return b;
        },
        eq: () => b,
        in: () => b,
        lt: () => b,
        lte: () => b,
        not: () => b,
        limit: () => Promise.resolve(devolve()),
        maybeSingle: () => {
          if (tabela === "organizations") {
            if (o.falhaNoIdioma) return Promise.resolve({ data: null, error: { message: "boom" } });
            return Promise.resolve({ data: { locale: o.locale ?? null }, error: null });
          }
          if (tabela === "agent_inbox_items" && op === "select")
            return Promise.resolve({ data: o.avisoAberto ?? null, error: null });
          return Promise.resolve(devolve());
        },
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve(devolve()).then(onF, onR),
      });
      return b;
    },
  };
  return { admin, inseridos, atualizados };
}

function mensagem(i: number): Linha {
  return {
    id: `m-${i}`,
    organization_id: ORG,
    conversation_id: "conv-1",
    contact_id: "c-1",
    created_at: "2026-11-01T10:00:00.000Z",
    sent_via: "ai",
    contacts: { phone_number: "+32485000000" },
  };
}

const AGORA = new Date("2026-11-01T12:00:00.000Z");

describe("recover-stuck-messages: o aviso no idioma da organização", () => {
  it("⭐ conta em turco: título e corpo em turco, com o número e os minutos", async () => {
    const f = fakeAdmin({ locale: "tr", mensagens: [mensagem(1), mensagem(2)] });
    await recoverStuckMessages(f.admin as never, AGORA, "req");
    expect(f.inseridos).toHaveLength(1);
    expect(f.inseridos[0]!.title).toBe("2 yanıt müşteriye ulaşmadı");
    expect(f.inseridos[0]!.body).toBe(
      "5 dakikadan uzun süre gönderilmeyi beklediler ve başarısız olarak işaretlendiler. " +
        "WhatsApp bağlantısının açık olduğunu ve gönderim işçisinin çalıştığını kontrol edin. " +
        "Hiçbir şey kendiliğinden yeniden gönderilmedi: sebebi bilmeden yeniden göndermek aynı mesajın iki kez gitmesine yol açabilir.",
    );
  });

  it("uma só: o título no singular", async () => {
    const f = fakeAdmin({ locale: "tr", mensagens: [mensagem(1)] });
    await recoverStuckMessages(f.admin as never, AGORA, "req");
    expect(f.inseridos[0]!.title).toBe("Bir yanıt müşteriye ulaşmadı");
  });

  it("conta em português: o mesmo texto de antes, byte a byte", async () => {
    const f = fakeAdmin({ locale: "pt-BR", mensagens: [mensagem(1), mensagem(2)] });
    await recoverStuckMessages(f.admin as never, AGORA, "req");
    expect(f.inseridos[0]!.title).toBe("2 respostas não chegaram ao cliente");
    expect(f.inseridos[0]!.body).toBe(
      "Ficaram mais de 5 minutos aguardando envio e foram marcadas como falha. " +
        "Verifique se a conexão do WhatsApp está ativa e se o worker de envio está rodando. " +
        "Nada foi reenviado automaticamente — reenviar sem saber a causa arrisca mandar a mesma mensagem duas vezes.",
    );
  });

  it("idioma que não se lê: português, e o aviso sai mesmo assim", async () => {
    const f = fakeAdmin({ falhaNoIdioma: true, mensagens: [mensagem(1)] });
    await recoverStuckMessages(f.admin as never, AGORA, "req");
    expect(f.inseridos[0]!.title).toBe("Uma resposta não chegou ao cliente");
  });
});

describe("o aviso do lembrete sem canal no idioma da organização", () => {
  it("⭐ conta em turco: título, explicação e instrução em turco, com os nomes das telas", async () => {
    const f = fakeAdmin({ locale: "tr" });
    await atualizarAvisoDeRemetente(f.admin as never, ORG, "ag-1", "sem_canal");
    expect(f.inseridos).toHaveLength(1);
    expect(f.inseridos[0]!.title).toBe("Hatırlatma, kanal seçilmesini bekliyor");
    expect(f.inseridos[0]!.body).toBe(
      "Kullanılabilir bir mesaj kanalı yok. Hatırlatma gönderilmedi ve gönderildi olarak da işaretlenmedi. " +
        "Takvim ekranındaki rezervasyonu ve Ayarlar → Randevu türleri ekranındaki kanalı kontrol edin. " +
        "Süresi içinde düzeltilirse bir sonraki turda gönderilmeye çalışılır; süresi geçmiş hatırlatmalar yeniden gönderilmez.",
    );
  });

  it("aviso já aberto: atualiza no idioma, sem abrir outro", async () => {
    const f = fakeAdmin({ locale: "tr", avisoAberto: { id: "item-1" } });
    await atualizarAvisoDeRemetente(f.admin as never, ORG, "ag-1", "remetente_ambiguo");
    expect(f.inseridos).toHaveLength(0);
    expect(f.atualizados[0]!.title).toBe("Hatırlatma, kanal seçilmesini bekliyor");
    expect(String(f.atualizados[0]!.body)).toMatch(
      /^Birden fazla kanal var ve rezervasyon hangisinin kullanılacağını belirtmiyor\. /,
    );
  });

  it("conta em português: o mesmo texto de antes, byte a byte", async () => {
    const f = fakeAdmin({ locale: "pt-BR" });
    await atualizarAvisoDeRemetente(f.admin as never, ORG, "ag-1", "sem_canal");
    expect(f.inseridos[0]!.title).toBe("Lembrete aguardando definição do canal");
    expect(f.inseridos[0]!.body).toBe(
      "Não há canal de mensagem disponível. O lembrete não foi enviado nem marcado como enviado. " +
        "Confira a reserva na Agenda e o canal em Configurações → Tipos de agendamento. " +
        "Corrigido dentro do prazo, a próxima rodada tenta enviar; avisos vencidos não são reenviados.",
    );
  });

  it("todas as explicações têm turco (nenhum motivo volta em português)", async () => {
    const motivos = [
      "remetente_ambiguo",
      "sem_canal",
      "canal_indicado_indisponivel",
      "conversa_do_compromisso_invalida",
      "canal_fora_da_janela_24h",
      "falha_ao_ler_remetente",
    ] as const;
    for (const motivo of motivos) {
      const f = fakeAdmin({ locale: "tr" });
      await atualizarAvisoDeRemetente(f.admin as never, ORG, "ag-1", motivo);
      const body = String(f.inseridos[0]!.body);
      expect(body, motivo).not.toMatch(/\b(não|canal de|reserva|conversa|próxima)\b/);
    }
  });
});

describe("snooze-watcher: o aviso no idioma da organização", () => {
  const conversa = {
    id: "conv-1",
    organization_id: ORG,
    snoozed_at: "2026-11-01T08:00:00.000Z",
    last_inbound_at: "2026-11-01T07:00:00.000Z",
    status: "snoozed",
  };

  beforeEach(() => {
    estado.admin = null;
  });

  it("⭐ conta em turco: o título em turco", async () => {
    const f = fakeAdmin({ locale: "tr", conversas: [conversa] });
    estado.admin = f.admin;
    await snoozeWatcher(new Request("http://x/api/v1/cron/snooze-watcher") as never);
    expect(f.inseridos).toHaveLength(1);
    expect(f.inseridos[0]!.title).toBe("Müşteri süresi içinde yanıt vermedi");
  });

  it("conta em português: o mesmo título de antes", async () => {
    const f = fakeAdmin({ locale: "pt-BR", conversas: [conversa] });
    estado.admin = f.admin;
    await snoozeWatcher(new Request("http://x/api/v1/cron/snooze-watcher") as never);
    expect(f.inseridos[0]!.title).toBe("Lead não respondeu no prazo");
  });
});
