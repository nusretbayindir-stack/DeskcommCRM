/**
 * A tela "Atividades" (linha do tempo da operação) no idioma de quem lê (U29).
 *
 * Os títulos da tela já saíam por `t()`, mas o miolo vinha pronto da rota em
 * português: `montarRelatorio` recebe um tradutor opcional e a rota não passava
 * nenhum — tipo ("Demanda encerrada"), autor ("Sistema", "Autor não
 * registrado") e o porquê da linha ("Movido de … para …", "Próxima ação: …").
 * A linha do tempo do contato já traduzia tudo isso; o relatório agora usa a
 * MESMA leitura (`motivoNoIdioma(r, t) ?? t(r)`). Português sem mudança de byte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { montarRelatorio, type ItemBruto, type RelatorioBruto } from "@/lib/reports/atividades";

const RAIZ = join(__dirname, "..", "..");

function item(over: Partial<ItemBruto>): ItemBruto {
  return {
    id: "a-1",
    type: "stage_changed",
    performed_at: "2026-11-01T15:00:00Z",
    actor_kind: "system",
    user_id: null,
    agent_id: null,
    reason: null,
    lead_id: "lead-1",
    lead_title: "Nusret",
    contact_id: "c-1",
    contact_display_name: "Nusret",
    contact_name: "Nusret",
    contact_phone: null,
    ...over,
  };
}

function bruto(items: ItemBruto[]): RelatorioBruto {
  return {
    total: items.length,
    by_actor: [
      { actor_kind: "system", user_id: null, agent_id: null, count: 1 },
      { actor_kind: null, user_id: null, agent_id: null, count: 1 },
    ],
    by_type: [{ type: "demanda_encerrada", count: 1 }, { type: "stage_changed", count: 1 }],
    daily: [],
    items,
    items_truncated: false,
  };
}

function montar(idioma: Idioma, items: ItemBruto[]) {
  return montarRelatorio(bruto(items), {
    nomes: { usuarios: {}, agentes: {} },
    vocabulary: null,
    t: (texto) => traduzir(texto, idioma),
  });
}

describe("relatório de atividades no idioma de quem lê", () => {
  it("turco: o porquê montado com dado (troca de etapa) sai em turco", () => {
    const r = montar("tr", [item({ reason: "Movido de Hizmet seçiliyor para Fiyat verildi" })]);
    expect(r.atividades[0]?.motivo).toBe(traduzir("Movido de {de} para {para}", "tr")
      .replace("{de}", "Hizmet seçiliyor")
      .replace("{para}", "Fiyat verildi"));
    expect(r.atividades[0]?.motivo).not.toMatch(/^Movido de/);
  });

  it("turco: o porquê de frase inteira sai pelo dicionário", () => {
    const r = montar("tr", [item({ type: "handoff", reason: "Atendimento passado para uma pessoa" })]);
    expect(r.atividades[0]?.motivo).toBe("Görüşme bir çalışana aktarıldı");
  });

  it("turco: o diff do checkpoint ('Próxima ação: …') traduz o rótulo e mantém o texto do modelo", () => {
    const r = montar("tr", [item({ type: "ai_turn", reason: "Próxima ação: randevuyu kaydet" })]);
    expect(r.atividades[0]?.motivo).toBe("Sonraki adım: randevuyu kaydet");
  });

  it("linha sem porquê continua sem porquê", () => {
    const r = montar("tr", [item({ reason: null })]);
    expect(r.atividades[0]?.motivo).toBeNull();
  });

  it("português: o porquê gravado, byte a byte", () => {
    const motivos = [
      "Movido de Hizmet seçiliyor para Fiyat verildi",
      "Atendimento passado para uma pessoa",
      "Próxima ação: randevuyu kaydet",
      "texto livre que ninguém traduziu",
    ];
    const r = montar("pt-BR", motivos.map((m, i) => item({ id: `a-${i}`, reason: m })));
    expect(r.atividades.map((a) => a.motivo)).toEqual(motivos);
  });

  it("a rota entrega ao relatório o tradutor no idioma de quem pediu", () => {
    const rota = readFileSync(join(RAIZ, "app/api/v1/reports/activities/route.ts"), "utf8");
    const chamada = rota.slice(rota.indexOf("montarRelatorio(bruto"));
    expect(chamada.slice(0, 400)).toMatch(/\bt:\s*\(texto[^)]*\)\s*=>\s*traduzir\(texto,\s*authz\.user\.idioma\)/);
  });

  it("a tela formata a hora no idioma da sessão, não em pt-BR fixo", () => {
    const tela = readFileSync(join(RAIZ, "app/app/activities/_components/ActivityReportClient.tsx"), "utf8");
    expect(tela).not.toMatch(/quandoLegivel\([^)]*"pt-BR"\)/);
    expect(tela).toMatch(/useTagDeIdioma\(\)/);
  });
});
