import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { avisoDoNumero } from "./circuit";
import { HEALTH_DEFAULTS } from "./defaults";

/**
 * O AVISO DO NÚMERO SAI NO IDIOMA DA ORGANIZAÇÃO.
 *
 * O circuito de saúde abre um item na Central quando o número nasce em espera
 * (go-live) ou quando degrada. Título e corpo eram escritos em português e a
 * tela mostra o que está gravado: no demo em turco, com a tela toda em turco,
 * a Central dizia "Número novo aguardando liberação (go-live)" (2026-10-28).
 */

const K = { ...HEALTH_DEFAULTS, responseRateFloor: 0.25 };
const TAXAS = { totalSends: 40, blockedSends: 18, sentLeads: 30, respondedLeads: 3 };

describe("o aviso do número em turco", () => {
  it("go-live: título e corpo em turco", () => {
    const aviso = avisoDoNumero("go_live", TAXAS, K, "tr");
    expect(aviso.titulo).toBe("Yeni numara yayına alınmayı bekliyor (go-live)");
    expect(aviso.corpo).toMatch(/^Yeni numara yayına alınmayı bekliyor \(go-live\)\. /);
    expect(aviso.corpo).not.toMatch(/disparos|fila|Resolva/);
  });

  it("bloqueios: as contagens no lugar e o percentual à turca", () => {
    const aviso = avisoDoNumero("block_rate", TAXAS, K, "tr");
    expect(aviso.titulo).toBe("Numaranın sağlığı bozuldu — giden mesajlar otomatik beklemede");
    expect(aviso.corpo).toBe(
      "Numaranın son 40 gönderiminin %45 kadarı engellendi (eşik %10). " +
        "Giden mesajlar otomatik beklemede: kuyruk tutar, hiçbir şey kaybolmaz. " +
        "Numarayı kontrol edin (WhatsApp numarası yanmış olabilir) ve devam etmek için bu kaydı çözüldü olarak işaretleyin.",
    );
  });

  it("taxa de resposta: as contagens no lugar", () => {
    const aviso = avisoDoNumero("response_rate", TAXAS, K, "tr");
    expect(aviso.corpo).toBe(
      "Yanıt oranı %10: ulaşılan 30 kişiden 3 kişi yanıt verdi (alt sınır %25). " +
        "Giden mesajlar otomatik beklemede: kuyruk tutar. " +
        "Yaklaşımı ve numarayı kontrol edin; devam etmek için bu kaydı çözüldü olarak işaretleyin.",
    );
  });
});

describe("em português o aviso é byte a byte o de antes", () => {
  it("go-live", () => {
    expect(avisoDoNumero("go_live", TAXAS, K, "pt-BR")).toEqual({
      titulo: "Número novo aguardando liberação (go-live)",
      corpo:
        "Número novo aguardando liberação (go-live). Os disparos que o sistema começa — follow-up " +
        "e cadência de prospecção — nascem em espera por segurança: a fila retém, nada é perdido. " +
        "RESPONDER quem te escreveu continua funcionando normalmente. Resolva este item quando o " +
        "número estiver pronto para disparar.",
    });
  });

  it("bloqueios", () => {
    expect(avisoDoNumero("block_rate", TAXAS, K, "pt-BR")).toEqual({
      titulo: "Saúde do número degradada — outbound em espera automática",
      corpo:
        "Bloqueios em 45% dos 40 últimos envios do número (limiar 10%). Outbound em espera automática — " +
        "a fila retém, nada é perdido. Verifique o número (possível queima do WhatsApp) e resolva este item para retomar.",
    });
  });

  it("taxa de resposta", () => {
    expect(avisoDoNumero("response_rate", TAXAS, K, "pt-BR").corpo).toBe(
      "Taxa de resposta em 10% (3 de 30 leads contatados responderam; piso 25%). Outbound em espera automática — " +
        "a fila retém. Verifique a abordagem/o número e resolva este item para retomar.",
    );
  });
});

describe("o circuito lê o idioma na transação da sessão", () => {
  const FONTE = readFileSync(join(process.cwd(), "lib/agent-engine/health/circuit.ts"), "utf8");

  it("engageHold grava o aviso no idioma da organização, lido pelo client da transação", () => {
    // Pelo `client`, e não pelo pool: a transação segura o lock da linha de
    // saúde, e uma segunda conexão pedida ao pool cheio esperaria por quem
    // talvez espere este lock. Falhou a leitura, a transação volta inteira e o
    // próximo tick tenta de novo — como qualquer outra consulta dela.
    expect(FONTE).toMatch(/idiomaDaOrgPeloPg\(client, tenantId\)/);
    expect(FONTE).not.toMatch(/idiomaDaOrgPeloPg\(harness,/);
    expect(FONTE).toMatch(/avisoDoNumero\(reason, rates, k, idioma\)/);
  });
});
