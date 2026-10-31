import { describe, expect, it } from "vitest";

import {
  DETALHE_CREDENCIAL_RECUSADA,
  avisoDaConexao,
  sincronizarSaudeDaConexao,
} from "@/lib/channels/health";

/**
 * O AVISO DA CONEXÃO SAI NO IDIOMA DA ORGANIZAÇÃO.
 *
 * A Central mostra o título e o corpo que estão gravados. Eram escritos em
 * português: uma empresa turca com o WhatsApp caído lia "WhatsApp "Vendas"
 * desconectado — precisa escanear o QR de novo" no meio da tela turca. Quem
 * decide SE avisa não muda; muda só a frase.
 */

const QR = { reachable: true, status: "SCAN_QR_CODE", detail: null };
const CAIU = { reachable: true, status: "FAILED", detail: null };
const CREDENCIAL = { reachable: false, status: null, detail: DETALHE_CREDENCIAL_RECUSADA };

describe("avisoDaConexao em turco", () => {
  it("QR: título e corpo em turco, com o apelido da conexão", () => {
    const aviso = avisoDaConexao(QR, "Satış", "tr");
    expect(aviso).toMatchObject({
      kind: "qr_rescan",
      severity: "critical",
      title: 'WhatsApp "Satış" bağlantısı koptu — QR kodu yeniden okutulmalı',
      body: "Bu yapılana kadar bu bağlantıdan mesaj gelmez ve gitmez.",
      episodio: "SCAN_QR_CODE",
    });
  });

  it("fora do ar: o status técnico fica como veio", () => {
    const aviso = avisoDaConexao(CAIU, "Satış", "tr");
    expect(aviso?.title).toBe('WhatsApp "Satış" çalışmıyor (FAILED)');
    expect(aviso?.body).toBe("Bağlantı geri gelene kadar bu bağlantıdan mesaj gelmez ve gitmez.");
  });

  it("não deu para verificar: o título em turco, o detalhe técnico como veio", () => {
    const aviso = avisoDaConexao({ reachable: false, status: null, detail: "ECONNREFUSED" }, "Satış", "tr");
    expect(aviso?.title).toBe('"Satış" bağlantısı kontrol edilemedi');
    expect(aviso?.body).toBe("ECONNREFUSED");
  });
});

describe("avisoDaConexao sem idioma é o português de antes", () => {
  it("QR", () => {
    expect(avisoDaConexao(QR, "Vendas")).toMatchObject({
      title: 'WhatsApp "Vendas" desconectado — precisa escanear o QR de novo',
      body: "Enquanto isso não acontecer, nenhuma mensagem entra nem sai por esta conexão.",
    });
  });

  it("fora do ar", () => {
    expect(avisoDaConexao(CAIU, "Vendas")).toMatchObject({
      title: 'WhatsApp "Vendas" fora do ar (FAILED)',
      body: "Nenhuma mensagem entra nem sai por esta conexão até ela voltar.",
    });
  });
});

describe("sincronizarSaudeDaConexao grava o aviso no idioma da organização", () => {
  function adminFalso(locale: string | null) {
    const inseridos: Array<Record<string, unknown>> = [];
    const consulta = (tabela: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data: tabela === "organizations" ? { locale } : { escalated_status: null },
          error: null,
        }),
        insert: async (linha: Record<string, unknown>) => {
          if (tabela === "agent_inbox_items") inseridos.push(linha);
          return { error: null };
        },
        upsert: async () => ({ error: null }),
        update: () => q,
        then: (ok: (v: unknown) => unknown) => ok({ data: [], error: null }),
      };
      return q;
    };
    return { admin: { from: consulta } as never, inseridos };
  }

  const sessao = { id: "sess-1", organization_id: "org-1", status: "SCAN_QR_CODE" };

  it("organização turca: o aviso entra em turco", async () => {
    const { admin, inseridos } = adminFalso("tr");
    expect(await sincronizarSaudeDaConexao(admin, sessao, QR, "Satış")).toBe("avisado");
    expect(inseridos).toEqual([
      expect.objectContaining({
        kind: "qr_rescan",
        title: 'WhatsApp "Satış" bağlantısı koptu — QR kodu yeniden okutulmalı',
        body: "Bu yapılana kadar bu bağlantıdan mesaj gelmez ve gitmez.",
      }),
    ]);
  });

  it("organização em português: o aviso de sempre", async () => {
    const { admin, inseridos } = adminFalso("pt-BR");
    await sincronizarSaudeDaConexao(admin, sessao, QR, "Vendas");
    expect(inseridos[0]).toMatchObject({
      title: 'WhatsApp "Vendas" desconectado — precisa escanear o QR de novo',
    });
  });
});

describe("a credencial recusada também", () => {
  it("em turco", () => {
    const aviso = avisoDaConexao(CREDENCIAL, "Satış", "tr");
    expect(aviso?.episodio).toBe("CREDENCIAL_RECUSADA");
    expect(aviso?.title).toBe('"Satış" bağlantısı: WhatsApp sunucusu erişim anahtarını reddetti');
    expect(aviso?.body).toMatch(/^QR kodu yeniden okutmak çözmez: /);
  });
});
