/**
 * O aviso "decida sobre N negócios parados" sai no idioma da organização (U14).
 *
 * A Central mostra o título e o corpo GRAVADOS em `agent_inbox_items`; o
 * produtor (`venceReativacoes`) escrevia em português para qualquer conta. O
 * demo turco de 01/11/2026 recebeu "Decida sobre 1 negócio parado — a sugestão
 * de retomar venceu". Português continua sem mudança de byte.
 */
import { describe, expect, it, vi } from "vitest";

import { venceReativacoes } from "@/lib/leads/reactivation";

vi.mock("@/lib/leads/activity-emitter", async (orig) => ({
  ...(await orig<typeof import("@/lib/leads/activity-emitter")>()),
  emitLeadActivity: vi.fn(async () => ({ ok: true })),
}));

const ORG = "org-1";
const AGORA = new Date("2026-11-01T12:00:00Z");

interface Opcoes {
  vencidas: number;
  locale?: string | null;
  falhaNoIdioma?: boolean;
}

function fakeAdmin(o: Opcoes, inseridos: Array<Record<string, unknown>>, tabelasLidas: string[]) {
  const propostas = Array.from({ length: o.vencidas }, (_, i) => ({
    id: `p-${i}`,
    lead_id: `lead-${i}`,
    organization_id: ORG,
    expires_at: "2026-10-31T12:00:00Z",
    crm_leads: { title: `Negócio ${i}`, contact_id: `c-${i}` },
  }));
  return {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from(tabela: string) {
      tabelasLidas.push(tabela);
      let op: "select" | "update" | "insert" = "select";
      let linha: Record<string, unknown> | null = null;
      const b = {
        select: () => b,
        update: () => {
          op = "update";
          return b;
        },
        insert: (v: Record<string, unknown>) => {
          op = "insert";
          linha = v;
          return b;
        },
        eq: () => b,
        lt: () => b,
        maybeSingle: () => {
          if (tabela === "organizations") {
            if (o.falhaNoIdioma) return Promise.resolve({ data: null, error: { message: "boom" } });
            return Promise.resolve({ data: { locale: o.locale ?? null }, error: null });
          }
          if (tabela === "agent_inbox_items" && op === "insert") {
            inseridos.push(linha ?? {});
            return Promise.resolve({ data: { id: "item-1" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
          const r =
            tabela === "crm_lead_reactivations" && op === "select"
              ? { data: propostas, error: null }
              : { data: null, error: null };
          return Promise.resolve(r).then(onF, onR);
        },
      };
      return b;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function vencer(o: Opcoes) {
  const inseridos: Array<Record<string, unknown>> = [];
  const tabelasLidas: string[] = [];
  const r = await venceReativacoes(fakeAdmin(o, inseridos, tabelasLidas), ORG, AGORA);
  return { r, aviso: inseridos[0] as { title: string; body: string } | undefined, tabelasLidas };
}

describe("aviso de reativação vencida no idioma da organização", () => {
  it("turco, um negócio: título e corpo em turco", async () => {
    const { r, aviso } = await vencer({ vencidas: 1, locale: "tr" });
    expect(r.itensDeCaixa).toBe(1);
    expect(aviso?.title).toBe("1 durmuş fırsat için karar verin — yeniden iletişim önerisinin süresi doldu");
    expect(aviso?.body).toBe(
      "Bir fırsat soğudu ve kişiyle yeniden iletişim önerisi süresi içinde yanıtlanmadı. " +
        "Devam ediyormuş gibi görünmesin diye panodan çıkarıldı. " +
        "Yeniden iletişime geçmek de kapatmak da bir karardır; olduğu gibi bırakmak karar değildir.",
    );
  });

  it("turco, vários negócios: o número entra na frase", async () => {
    const { aviso } = await vencer({ vencidas: 3, locale: "tr" });
    expect(aviso?.title).toBe("3 durmuş fırsat için karar verin — yeniden iletişim önerisinin süresi doldu");
    expect(aviso?.body).toMatch(/^3 fırsat soğudu /);
  });

  it("espanhol: título no idioma", async () => {
    const { aviso } = await vencer({ vencidas: 2, locale: "es" });
    expect(aviso?.title).toBe("Decide sobre 2 negocios detenidos — la sugerencia de retomar venció");
  });

  it("português, um negócio: o texto de sempre, byte a byte", async () => {
    const { aviso } = await vencer({ vencidas: 1, locale: "pt-BR" });
    expect(aviso?.title).toBe("Decida sobre 1 negócio parado — a sugestão de retomar venceu");
    expect(aviso?.body).toBe(
      "Um negócio esfriou e a sugestão de retomar contato ficou sem resposta até o prazo. Eles saíram do quadro para não parecerem em andamento. Retomar ou encerrar — as duas são decisões; deixar como está é a única que não é.",
    );
  });

  it("português, vários negócios: o plural de sempre", async () => {
    const { aviso } = await vencer({ vencidas: 4, locale: "pt-BR" });
    expect(aviso?.title).toBe("Decida sobre 4 negócios parados — a sugestão de retomar venceu");
    expect(aviso?.body).toBe(
      "4 negócios esfriaram e a sugestão de retomar contato ficou sem resposta até o prazo. Eles saíram do quadro para não parecerem em andamento. Retomar ou encerrar — as duas são decisões; deixar como está é a única que não é.",
    );
  });

  it("a leitura do idioma falha: o aviso sai em português, nunca deixa de sair", async () => {
    const { r, aviso } = await vencer({ vencidas: 1, falhaNoIdioma: true });
    expect(r.itensDeCaixa).toBe(1);
    expect(aviso?.title).toBe("Decida sobre 1 negócio parado — a sugestão de retomar venceu");
  });

  it("nada venceu: nem lê o idioma", async () => {
    const { r, tabelasLidas } = await vencer({ vencidas: 0, locale: "tr" });
    expect(r.vencidas).toBe(0);
    expect(tabelasLidas).not.toContain("organizations");
  });
});
