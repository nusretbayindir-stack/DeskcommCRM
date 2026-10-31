import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";

import { motivoNoIdioma } from "./motivo-no-idioma";

/**
 * O PORQUÊ DA LINHA DO TEMPO SAI NO IDIOMA DA TELA.
 *
 * O `reason` das atividades é gravado em português e montado com dado no meio
 * ("Movido de Avaliação para Proposta enviada", "Próxima ação: ligar quinta").
 * As telas já passavam o texto por `t()`, mas o dicionário só casa frase
 * inteira: em turco a linha do tempo mostrava "Movido de Yeni talep para
 * Teklif" (medido no demo, 2026-10-30). As frases conhecidas viram chave com
 * marcador; o que não é conhecido continua indo inteiro para o `t()`.
 */

const tr = (texto: string) => traduzir(texto, "tr");
const pt = (texto: string) => traduzir(texto, "pt-BR");
/** O que as três telas fazem com o `reason` gravado. */
const naTela = (motivo: string, t: (texto: string) => string) => motivoNoIdioma(motivo, t) ?? t(motivo);

describe("a linha do tempo em turco", () => {
  it("troca de etapa: as duas etapas no meio da frase turca", () => {
    expect(naTela("Movido de Yeni talep para Teklif gönderildi", tr)).toBe(
      "Yeni talep aşamasından Teklif gönderildi aşamasına taşındı",
    );
  });

  it("troca de etapa sem a de origem", () => {
    expect(naTela("Movido para Teklif", tr)).toBe("Teklif aşamasına taşındı");
  });

  it("o motivo livre depois do travessão fica como veio", () => {
    expect(naTela("Movido de Yeni talep para Teklif — müşteri istedi", tr)).toBe(
      "Yeni talep aşamasından Teklif aşamasına taşındı — müşteri istedi",
    );
  });

  it("a etapa arquivada também", () => {
    expect(naTela("Movido de Eski para Yeni (a etapa «Eski» foi arquivada)", tr)).toBe(
      "Eski aşamasından Yeni aşamasına taşındı («Eski» aşaması arşivlendi)",
    );
  });

  it("o roteador e a automação que levam para outro funil", () => {
    expect(naTela("Levado para outro funil pelo roteador de intenção", tr)).toBe(
      "Niyet yönlendiricisi başka bir huniye taşıdı",
    );
    expect(naTela("Levado para outro funil pela automação", tr)).toBe("Otomasyon başka bir huniye taşıdı");
  });

  it("o checkpoint: cada parte com o seu rótulo, o texto da IA como veio", () => {
    expect(naTela("Nova objeção: fiyat yüksek · Próxima ação: perşembe ara", tr)).toBe(
      "Yeni itiraz: fiyat yüksek · Sonraki adım: perşembe ara",
    );
    expect(naTela("2 novas objeções: fiyat; süre", tr)).toBe("2 yeni itiraz: fiyat; süre");
    expect(naTela("Novo compromisso: teklif gönderilecek", tr)).toBe("Yeni taahhüt: teklif gönderilecek");
    expect(naTela("3 novos compromissos: a; b; c", tr)).toBe("3 yeni taahhüt: a; b; c");
  });

  it("frase inteira que já está no dicionário continua indo direto", () => {
    expect(naTela("Mudou de estágio", tr)).toBe("Aşama değişti");
  });

  it("texto que ninguém conhece fica como veio", () => {
    expect(naTela("o cliente pediu desconto", tr)).toBe("o cliente pediu desconto");
  });

  it("fora das famílias com dado, motivoNoIdioma devolve null e a tela segue com o t() de sempre", () => {
    expect(motivoNoIdioma("Mudou de estágio", tr)).toBeNull();
    expect(motivoNoIdioma("Levado para outro funil pelo roteador de intenção", tr)).toBeNull();
    expect(motivoNoIdioma("Nova objeção: preço · o cliente sumiu", tr)).toBeNull();
  });
});

describe("em português nada muda um byte", () => {
  const exemplos = [
    "Movido de Avaliação para Proposta enviada",
    "Movido para Proposta enviada",
    "Movido de A para B — o cliente pediu",
    "Movido de A para B (a etapa «A» foi arquivada)",
    "Levado para outro funil pelo roteador de intenção",
    "Nova objeção: preço · Novo compromisso: enviar proposta · Próxima ação: ligar quinta",
    "2 novas objeções: preço; prazo",
    "3 novos compromissos: a; b; c",
    "Mudou de estágio",
    "o cliente pediu desconto",
  ];
  for (const exemplo of exemplos) {
    it(exemplo, () => {
      expect(naTela(exemplo, pt)).toBe(exemplo);
    });
  }
});

describe("as telas da linha do tempo tentam motivoNoIdioma antes do t() de sempre", () => {
  const telas: Array<[string, string]> = [
    ["components/kanban/LeadTimeline.tsx", "item.reason"],
    ["components/contacts/TimelineView.tsx", "reasonTrim"],
    ["components/inbox/CRMSidePanel.tsx", "a.reason"],
  ];
  for (const [arquivo, reason] of telas) {
    it(arquivo, () => {
      const fonte = readFileSync(join(process.cwd(), arquivo), "utf8");
      expect(fonte).toContain('from "@/lib/leads/motivo-no-idioma"');
      expect(fonte).toContain(`motivoNoIdioma(${reason}, t) ?? t(${reason})`);
    });
  }
});
