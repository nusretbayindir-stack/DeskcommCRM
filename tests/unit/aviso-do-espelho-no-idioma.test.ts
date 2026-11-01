import { describe, expect, it } from "vitest";

import {
  abreAvisoDoEspelhoRecusado,
  avisoDoEspelhoRecusado,
} from "@/lib/agent-engine/edge/crm/move-lead-stage";

/**
 * O AVISO DO ESPELHO RECUSADO SAI NO IDIOMA DA ORGANIZAÇÃO (U14).
 *
 * A Central mostra o título e o corpo gravados. No demo em turco de 31/10/2026
 * a Central dizia "O assistente quis organizar um negócio de um funil que não
 * é dele", com a etapa crua ("qualified") no corpo. Quem decide SE avisa não
 * muda; muda a frase, e a etapa sai pelo nome do passo no idioma.
 */

describe("avisoDoEspelhoRecusado em turco", () => {
  it("fora do escopo: título, corpo, nome do passo e detalhe em turco", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "fora_do_escopo",
      detalhe: "o negócio está num funil que este assistente não cuida",
      etapaDeDestino: "qualified",
      idioma: "tr",
    });
    expect(aviso?.title).toBe("Asistan, sorumlu olmadığı bir hunideki fırsatı düzenlemek istedi");
    expect(aviso?.body).toBe(
      'Asistan bu fırsatın "Nitelikli" aşamasına geçmesi gerektiğine karar verdi, ancak fırsatın bulunduğu ' +
        "huniden sorumlu değil (fırsat, bu asistanın sorumlu olmadığı bir hunide). Karta kimse dokunmadı. " +
        "Asistanın bu huniden sorumlu olması gerekiyorsa bunu asistanın ayarlarında işaretleyin; " +
        "gerekmiyorsa yapmanız gereken bir şey yok.",
    );
    expect(aviso?.dedupe).toBe("kind_ref_e_titulo");
  });

  it("fora do escopo sem funil liberado: o outro detalhe do sync também em turco", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "qualified",
      idioma: "tr",
    });
    expect(aviso?.body).toContain("(bu asistana hiçbir huni açılmamış)");
  });

  it("perda sem motivo: a ação do menu com o nome que a tela turca mostra", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "perda_sem_motivo",
      detalhe: "a etapa de destino fecha o negócio como perdido",
      etapaDeDestino: "lost",
      idioma: "tr",
    });
    expect(aviso?.title).toBe(
      "Asistan bir fırsatı kayıp olarak işaretlemek istedi — bunun için bir neden gerekiyor",
    );
    expect(aviso?.body).toBe(
      'Asistan bu fırsatın "Kaybedildi" aşamasına geçmesi gerektiğine karar verdi; bu aşama huninizde bir ' +
        "kayıp aşaması. Bir fırsatı kaybetmek için bir neden gerekir ve bu neden, fırsatla ilgilenen kişinin " +
        "bildiği gerçek sebeptir — asistan neden uydurmaz. Karta kimse dokunmadı: olduğu yerde duruyor. " +
        'Fırsat gerçekten kaybedildiyse kartı hunide açın, "Kayıp olarak işaretle" seçeneğini kullanın ve ' +
        "nedeni girin; kaybedilmediyse yapmanız gereken bir şey yok.",
    );
  });

  it("campos obrigatórios: a frase da régua em turco; o rótulo do funil fica, o nativo traduz", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "campos_obrigatorios",
      detalhe: "Preencha os campos obrigatórios antes de continuar: Bütçe, Motivo do ganho.",
      etapaDeDestino: "negotiating",
      idioma: "tr",
    });
    expect(aviso?.title).toBe(
      "Asistan bir fırsatı taşımak istedi — huni önce bazı alanların doldurulmasını istiyor",
    );
    expect(aviso?.body).toBe(
      'Asistan bu fırsatın "Pazarlıkta" aşamasına geçmesi gerektiğine karar verdi, ancak huniniz bu ' +
        "aşamaya girmeden önce bazı alanların doldurulmasını istiyor. Devam etmeden önce zorunlu alanları " +
        "doldurun: Bütçe, Kazanma nedeni. Karta kimse dokunmadı: olduğu yerde duruyor. Fırsatı açın, fırsat " +
        "dosyasındaki eksikleri doldurun ve kartı her zamanki gibi taşıyın.",
    );
  });

  it("campos obrigatórios sem detalhe do sync: o texto da tabela do espelho também em turco", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "campos_obrigatorios",
      detalhe: "a etapa de destino exige campos que o negócio não tem preenchidos",
      etapaDeDestino: "negotiating",
      idioma: "tr",
    });
    expect(aviso?.body).toContain(" hedef aşama, fırsatta doldurulmamış alanlar istiyor ");
  });

  it("incidente: frase em turco; o motivo e o detalhe técnico ficam como vieram", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "crm_unavailable",
      detalhe: "fetch failed",
      etapaDeDestino: "qualified",
      idioma: "tr",
    });
    expect(aviso?.title).toBe("Kartın aşaması CRM'de güncellenemedi — huni tutarsız olabilir");
    expect(aviso?.body).toBe(
      'Asistanın hunisi "Nitelikli" aşamasına geçti, ancak CRM\'deki kart taşınamadı ' +
        "(crm_unavailable: fetch failed). Kartın aşamasını CRM'de elle düzeltin.",
    );
  });

  it("um nome de etapa que não é passo do agente fica como veio", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "Teklif gönderildi",
      idioma: "tr",
    });
    expect(aviso?.body).toContain('"Teklif gönderildi" aşamasına');
  });

  it("warn-only continua sem aviso em qualquer idioma", () => {
    expect(
      avisoDoEspelhoRecusado({ motivo: "human_conflict", detalhe: "d", etapaDeDestino: "qualified", idioma: "tr" }),
    ).toBeNull();
  });
});

describe("português sem mudança de byte", () => {
  // Os literais são o texto que o espelho gravava antes desta mudança.
  const FORA = {
    title: "O assistente quis organizar um negócio de um funil que não é dele",
    body:
      'O assistente concluiu que este negócio deveria ir para "qualified", mas ele não cuida do funil onde o ' +
      "negócio está (nenhum funil liberado para este assistente). Ninguém mexeu no card. Se ele deveria " +
      "cuidar desse funil, marque isso na configuração do assistente; se não, não há nada a fazer.",
  };

  it("sem idioma, o padrão é o português de antes", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "qualified",
    });
    expect({ title: aviso?.title, body: aviso?.body }).toEqual(FORA);
  });

  it("com pt-BR explícito, o mesmo texto", () => {
    const aviso = avisoDoEspelhoRecusado({
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "qualified",
      idioma: "pt-BR",
    });
    expect({ title: aviso?.title, body: aviso?.body }).toEqual(FORA);
  });

  it("campos obrigatórios e incidente em português, byte a byte", () => {
    const campos = avisoDoEspelhoRecusado({
      motivo: "campos_obrigatorios",
      detalhe: "Preencha os campos obrigatórios antes de continuar: Concorrente.",
      etapaDeDestino: "Proposta enviada",
      idioma: "pt-BR",
    });
    expect(campos?.body).toBe(
      'O assistente concluiu que este negócio deveria ir para "Proposta enviada", mas o seu funil exige o ' +
        "preenchimento de alguns campos antes de entrar nela. Preencha os campos obrigatórios antes de " +
        "continuar: Concorrente. Ninguém mexeu no card: ele continua onde estava. Abra o negócio, preencha " +
        "o que falta no dossiê e mova o card normalmente.",
    );
    const incidente = avisoDoEspelhoRecusado({
      motivo: "crm_error",
      detalhe: "o UPDATE do card falhou: timeout",
      etapaDeDestino: "qualified",
      idioma: "pt-BR",
    });
    expect(incidente).toMatchObject({
      title: "Espelho de stage no CRM falhou — funil possivelmente inconsistente",
      body:
        'lead_state avançou para "qualified" no harness, mas crm_move_lead_stage falhou ' +
        "(crm_error: o UPDATE do card falhou: timeout). Reconcilie o stage no CRM manualmente.",
    });
  });
});

describe("abreAvisoDoEspelhoRecusado lê o idioma da organização", () => {
  function banco(locale: string | null | Error) {
    const chamadas: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      query: async (sql: string, params: unknown[]) => {
        chamadas.push({ sql, params });
        if (/from organizations/i.test(sql)) {
          if (locale instanceof Error) throw locale;
          return { rows: [{ locale }] };
        }
        return { rows: [] };
      },
    };
    const inserts = () => chamadas.filter((c) => /insert into agent_inbox_items/i.test(c.sql));
    return { db: db as never, chamadas, inserts };
  }

  it("organização em turco: o item gravado sai em turco", async () => {
    const { db, inserts } = banco("tr");
    await abreAvisoDoEspelhoRecusado(db, "org-1", {
      negocioId: "negocio-1",
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "qualified",
    });
    expect(inserts()).toHaveLength(1);
    // Ordem dos parâmetros de `insertInboxItem`: org, kind, severity, title, body, ...
    expect(inserts()[0]!.params[3]).toBe(
      "Asistan, sorumlu olmadığı bir hunideki fırsatı düzenlemek istedi",
    );
    expect(inserts()[0]!.params[4]).toContain('"Nitelikli" aşamasına');
  });

  it("warn-only não grava nem consulta o idioma", async () => {
    const { db, chamadas } = banco("tr");
    await abreAvisoDoEspelhoRecusado(db, "org-1", {
      motivo: "not_configured",
      detalhe: "d",
      etapaDeDestino: "qualified",
    });
    expect(chamadas).toHaveLength(0);
  });

  it("a leitura do idioma falha: o aviso sai em português, nunca deixa de sair", async () => {
    const { db, inserts } = banco(new Error("connection reset"));
    await abreAvisoDoEspelhoRecusado(db, "org-1", {
      motivo: "fora_do_escopo",
      detalhe: "nenhum funil liberado para este assistente",
      etapaDeDestino: "qualified",
    });
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0]!.params[3]).toBe(
      "O assistente quis organizar um negócio de um funil que não é dele",
    );
  });
});
