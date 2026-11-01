import { describe, expect, it } from "vitest";

import { escalateJailbreakPromise } from "@/lib/agent-engine/guardrails/jailbreak/classifier";
import { avisarRespostaDeCasoObsoleto } from "@/lib/atendimento/aviso-caso-obsoleto";

/**
 * MAIS DOIS AVISOS DA CENTRAL NO IDIOMA DA ORGANIZAÇÃO (U14).
 *
 * A Central mostra o título e o corpo gravados. Numa empresa turca, a resposta
 * a um caso que mudou de atendimento e a escalação de manipulação do agente
 * chegavam em português. Quem decide SE avisa (e o dedupe de cada um) não muda.
 */

function banco(opts: { locale: string | Error; caso?: boolean }) {
  const consultas: string[] = [];
  const inserts: unknown[][] = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      consultas.push(sql);
      if (/from organizations/i.test(sql)) {
        if (opts.locale instanceof Error) throw opts.locale;
        return { rows: [{ locale: opts.locale }], rowCount: 1 };
      }
      if (/from agent_cases/i.test(sql)) {
        return { rows: opts.caso === false ? [] : [{ conversation_id: "conversa-1" }], rowCount: 1 };
      }
      if (/insert into agent_inbox_items/i.test(sql)) {
        inserts.push(params);
        return { rows: [{ id: "item-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return { db: db as never, consultas, inserts };
}

describe("resposta de caso obsoleto", () => {
  it("organização em turco: título e corpo em turco, ainda apontando para a conversa", async () => {
    const { db, inserts } = banco({ locale: "tr" });
    await avisarRespostaDeCasoObsoleto(db, "org-1", "caso-1");
    expect(inserts).toHaveLength(1);
    // Parâmetros de `insertInboxItem`: org, kind, severity, title, body, ref_kind, ref_id, ...
    expect(inserts[0]!.slice(1, 7)).toEqual([
      "job_dead",
      "warn",
      "Yanıt kaydedildi; görüşme değişti",
      // O corpo já tinha turco no catálogo (a tela o mostrava); o título acompanha.
      "Yanıt kaydedildi; görüşme değiştiği için iletilmedi. Konuşmayı gözden geçirin.",
      "conversation",
      "conversa-1",
    ]);
  });

  it("o idioma passado por quem chama vale, e aí não há leitura de idioma", async () => {
    const { db, consultas, inserts } = banco({ locale: "pt-BR" });
    await avisarRespostaDeCasoObsoleto(db, "org-1", "caso-1", "tr");
    expect(consultas.some((sql) => /from organizations/i.test(sql))).toBe(false);
    expect(inserts[0]![3]).toBe("Yanıt kaydedildi; görüşme değişti");
  });

  it("português sem mudança de byte", async () => {
    const { db, inserts } = banco({ locale: "pt-BR" });
    await avisarRespostaDeCasoObsoleto(db, "org-1", "caso-1");
    expect(inserts[0]!.slice(3, 5)).toEqual([
      "Resposta registrada; atendimento mudou",
      "Resposta registrada; não repassada porque o atendimento mudou. Revise a conversa.",
    ]);
  });

  it("caso que não existe: nem lê idioma nem grava", async () => {
    const { db, consultas, inserts } = banco({ locale: "tr", caso: false });
    expect(await avisarRespostaDeCasoObsoleto(db, "org-1", "caso-1")).toBeNull();
    expect(inserts).toHaveLength(0);
    expect(consultas.some((sql) => /from organizations/i.test(sql))).toBe(false);
  });
});

describe("escalação de manipulação do agente", () => {
  const INPUT = { tenantId: "org-1", leadId: "contato-1", level: "high" as const };

  it("organização em turco: título, corpo e nível em turco, com o mesmo dedupe por contato", async () => {
    const { db, inserts } = banco({ locale: "tr" });
    expect(await escalateJailbreakPromise(db, INPUT)).toBe(1);
    expect(inserts).toHaveLength(1);
    // Parâmetros: org, título, corpo, ref_id.
    expect(inserts[0]).toEqual([
      "org-1",
      "Asistan kandırılmaya çalışılmış olabilir — konuşmayı kontrol edin",
      "Bu müşterinin son mesajı, asistanı kandırma ya da talimatlarını aşma girişimi olarak işaretlendi " +
        "(seviye: yüksek) ve AYNI turda asistan, talimattaki tabloda olmayan bir söz vermeye çalıştı. " +
        "Konuşmayı kontrol edin: bu örüntü, hak edilmeyen bir teklif koparma girişimine işaret ediyor.",
      "contato-1",
    ]);
  });

  it("português sem mudança de byte (o nível sai como veio)", async () => {
    const { db, inserts } = banco({ locale: "pt-BR" });
    await escalateJailbreakPromise(db, INPUT);
    expect(inserts[0]!.slice(1, 3)).toEqual([
      "Possível manipulação do agente — revisar conversa",
      "A última mensagem deste lead foi sinalizada com risco de jailbreak/injeção (nível: high) " +
        "e, no MESMO turno, o agente tentou uma promessa fora da tabela do playbook. " +
        "Revise a conversa: o padrão sugere tentativa de manipulação para arrancar oferta indevida.",
    ]);
  });

  it("a leitura do idioma falha: a escalação sai em português, nunca deixa de sair", async () => {
    const { db, inserts } = banco({ locale: new Error("connection reset") });
    await escalateJailbreakPromise(db, INPUT);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]![1]).toBe("Possível manipulação do agente — revisar conversa");
  });
});
