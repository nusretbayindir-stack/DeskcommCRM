import { describe, expect, it } from "vitest";

import {
  avisarJanelaFechada,
  textoDoAvisoDeJanela,
} from "@/lib/agent-engine/pacing/aviso-de-janela";

/**
 * O AVISO DE JANELA FECHADA SAI NO IDIOMA DA ORGANIZAÇÃO (U14).
 *
 * A Central mostra o título e o corpo gravados. Uma empresa turca com horário
 * de envio lia "As respostas da IA estão esperando a janela de envio abrir" no
 * meio da tela turca. Quem decide SE avisa (a janela, o dedupe por canal) não
 * muda; muda a frase.
 */

// 04:00 UTC = 07:00 em Istambul (UTC+3, sem horário de verão).
const BASE = {
  abertura: new Date("2026-11-02T04:00:00Z"),
  janela: "7h-22h",
  timezone: "Europe/Istanbul",
};

describe("textoDoAvisoDeJanela em turco", () => {
  it("noite: diz a janela e que não há nada a fazer", () => {
    expect(textoDoAvisoDeJanela({ ...BASE, domingoDesligado: false }, "tr")).toEqual({
      title: "AI cevapları gönderim aralığının açılmasını bekliyor",
      body:
        "Bu numaranın gönderim aralığı 07:00–22:00 (saat dilimi Europe/Istanbul) ve şu an kapalı. " +
        "Şimdi yazanlar 2026-11-02 07:00 itibarıyla cevap alır. Hiçbir mesaj kaybolmaz — sıradaki işler " +
        "bekler ve aralık açılınca gönderilir. Bir şey yapmanıza gerek yok: cevaplar aralık açılınca " +
        "kendiliğinden gönderilir.",
    });
  });

  it("domingo desligado: aponta o botão e a chave com os nomes da tela turca", () => {
    expect(textoDoAvisoDeJanela({ ...BASE, domingoDesligado: true }, "tr").body).toBe(
      "Bu numarada **pazar günleri gönderim kapalı** ve gönderim aralığı 07:00–22:00 (saat dilimi " +
        "Europe/Istanbul). Şimdi yazanlar 2026-11-02 07:00 itibarıyla cevap alır. Hiçbir mesaj kaybolmaz — " +
        "sıradaki işler bekler ve aralık açılınca gönderilir. Asistanın pazar günleri de cevap vermesini " +
        'istiyorsanız Bağlantılar › "Gönderim koruması" içinde "Pazar günleri gönder" seçeneğini açın.',
    );
  });

  it("uma janela fora do formato `Nh-Mh` fica como veio", () => {
    const { body } = textoDoAvisoDeJanela({ ...BASE, janela: "manhã", domingoDesligado: false }, "tr");
    expect(body.startsWith("Bu numaranın gönderim aralığı manhã (saat dilimi")).toBe(true);
  });
});

describe("português sem mudança de byte", () => {
  it("noite", () => {
    expect(textoDoAvisoDeJanela({ ...BASE, domingoDesligado: false }, "pt-BR")).toEqual({
      title: "As respostas da IA estão esperando a janela de envio abrir",
      body:
        "A janela de envio deste número é 7h-22h (fuso Europe/Istanbul), e agora está fechada. " +
        "Quem escrever agora recebe resposta a partir de 2026-11-02 07:00. Nenhuma mensagem se perde — " +
        "os turnos ficam na fila e saem na abertura. Não é preciso fazer nada: as respostas saem sozinhas " +
        "na abertura.",
    });
  });

  it("domingo desligado", () => {
    expect(textoDoAvisoDeJanela({ ...BASE, domingoDesligado: true }, "pt-BR").body).toBe(
      "Este número está com **envio aos domingos desligado**, e a janela de horário é 7h-22h " +
        "(fuso Europe/Istanbul). Quem escrever agora recebe resposta a partir de 2026-11-02 07:00. " +
        "Nenhuma mensagem se perde — os turnos ficam na fila e saem na abertura. Se quiser que o agente " +
        'responda aos domingos, ligue "Enviar aos domingos" em Conexões › Anti-ban.',
    );
  });
});

describe("avisarJanelaFechada lê o idioma da organização", () => {
  function banco(locale: string | Error) {
    const inserts: unknown[][] = [];
    const db = {
      query: async (sql: string, params: unknown[]) => {
        if (/from organizations/i.test(sql)) {
          if (locale instanceof Error) throw locale;
          return { rows: [{ locale }], rowCount: 1 };
        }
        if (/insert into agent_inbox_items/i.test(sql)) inserts.push(params);
        return { rows: [], rowCount: 1 };
      },
    };
    return { db: db as never, inserts };
  }

  const INPUT = { tenantId: "org-1", channelSessionId: "canal-1", ...BASE, domingoDesligado: false };

  it("organização em turco: o item gravado sai em turco, com o mesmo dedupe por canal", async () => {
    const { db, inserts } = banco("tr");
    expect(await avisarJanelaFechada(db, INPUT)).toBe(1);
    expect(inserts).toHaveLength(1);
    // Parâmetros: org, título, corpo, ref_kind, ref_id.
    expect(inserts[0]![1]).toBe("AI cevapları gönderim aralığının açılmasını bekliyor");
    expect(inserts[0]!.slice(3)).toEqual(["janela_de_envio_fechada", "canal-1"]);
  });

  it("a leitura do idioma falha: o aviso sai em português, nunca deixa de sair", async () => {
    const { db, inserts } = banco(new Error("connection reset"));
    await avisarJanelaFechada(db, INPUT);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]![1]).toBe("As respostas da IA estão esperando a janela de envio abrir");
  });
});
