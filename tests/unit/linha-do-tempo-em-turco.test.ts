import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import { ACTIVITY_LABEL_FALLBACK, ACTIVITY_LABELS } from "@/lib/leads/activity-vocabulary";
import { motivoNoIdioma } from "@/lib/leads/motivo-no-idioma";
import { vetoReason } from "@/lib/leads/veto-activity";

/**
 * U26 (conferência da v1.88.8 no demo, 31/10/2026): depois do U17 a linha do
 * tempo do contato e do negócio ainda mostrava português numa conta em turco —
 * "Agendamento marcado", "Atendimento passado para uma pessoa", "Não enviei:
 * bloqueado pela regra "semantic_promise" (promise_semantic)", o código cru
 * "appointment_scheduled" e a aba "Timeline".
 *
 * As três telas fazem `t(activityLabel(type))` e `motivoNoIdioma(r, t) ?? t(r)`:
 * o que falta é tradução, e o que sobra é código interno no texto.
 */
const tr = (texto: string) => traduzir(texto, "tr");

describe("o título de cada atividade tem turco", () => {
  const rotulos = [...new Set([...Object.values(ACTIVITY_LABELS), ACTIVITY_LABEL_FALLBACK])];

  it.each(rotulos)("%s", (rotulo) => {
    expect(tr(rotulo)).not.toBe(rotulo);
  });
});

describe("os porquês fixos que o motor grava têm turco", () => {
  it("a passagem para humano (human-handoff.ts)", () => {
    expect(tr("Atendimento passado para uma pessoa")).toBe("Görüşme bir çalışana aktarıldı");
  });

  it("o veto da promessa semântica tem frase própria — o nome da regra não chega à tela", () => {
    const motivo = vetoReason("semantic_promise", "promise_semantic");
    expect(motivo).toBe(vetoReason("promise", "promise_semantic"));
    expect(motivo).not.toContain("semantic_promise");
  });

  it("linhas antigas, gravadas com o nome da regra, também saem em turco", () => {
    expect(tr('Não enviei: bloqueado pela regra "semantic_promise" (promise_semantic)')).toBe(
      "Göndermedim: mesaj, garanti edemeyeceğim bir şey vaat ediyordu",
    );
  });
});

describe("o porquê do agendamento não mostra o código interno", () => {
  it.each([
    "appointment_scheduled",
    "appointment_rescheduled",
    "appointment_cancelled",
    "appointment_completed",
    "appointment_no_show",
  ])("%s: em turco fica só o nome do tipo de atendimento", (codigo) => {
    // O nome do tipo pode ter travessão dentro ("Keşif — Ekin Yapı").
    expect(motivoNoIdioma(`Keşif — Ekin Yapı — ${codigo}`, tr)).toBe("Keşif — Ekin Yapı");
  });

  it("em português a linha continua byte a byte como foi gravada", () => {
    const pt = (texto: string) => traduzir(texto, "pt-BR");
    const gravado = "Consulta — Dra. Ana — appointment_scheduled";
    expect(motivoNoIdioma(gravado, pt) ?? pt(gravado)).toBe(gravado);
  });
});

describe("as abas do contato passam pelo dicionário", () => {
  const fonte = readFileSync("app/app/contacts/[id]/_client.tsx", "utf8");

  it("Timeline e LGPD não são texto cru", () => {
    expect(fonte).toContain('<TabsTrigger value="timeline">{t("Timeline")}</TabsTrigger>');
    expect(fonte).toContain('<TabsTrigger value="lgpd">{t("LGPD")}</TabsTrigger>');
  });

  it("em turco: Zaman çizelgesi e GDPR", () => {
    expect(tr("Timeline")).toBe("Zaman çizelgesi");
    expect(tr("LGPD")).toBe("GDPR");
  });
});
