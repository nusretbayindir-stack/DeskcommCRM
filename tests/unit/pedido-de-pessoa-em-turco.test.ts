/**
 * O PEDIDO DE PESSOA EM TURCO, na detecção determinística do engine.
 *
 * `detectHumanHandoffRequest` só conhecia o português: "Bir yetkiliyle görüşmek
 * istiyorum" dependia das palavras de passagem do agente ou do próprio modelo
 * para chegar a uma pessoa. A régua é a do português — verbo de contato com
 * alvo humano, ou expressão inequívoca —, e o lado negativo guarda o que a
 * oficina e o encanador ouvem todo dia: "yetkili servis" é a assistência
 * técnica autorizada, não um pedido de atendente.
 */
import { describe, expect, it } from "vitest";

import { detectHumanHandoffRequest } from "@/lib/agent-engine/agent/human-handoff";

const PEDE_PESSOA = [
  "Bir yetkiliyle görüşmek istiyorum",
  "YETKİLİ BİRİYLE GÖRÜŞMEK İSTİYORUM",
  "Yetkili biriyle konuşabilir miyim?",
  "Satış temsilcinizle görüşmek istiyorum",
  "Müşteri temsilcisiyle konuşmak istiyorum",
  "Gerçek bir insanla konuşmak istiyorum",
  "İnsanla konuşmak istiyorum",
  "Ekipten biriyle görüşebilir miyim?",
  "Beni bir yetkiliye bağlar mısınız?",
  "Operatöre bağlayın lütfen",
  "Canlı destek istiyorum",
];

const NAO_PEDE = [
  "Yetkili servisle görüşmek istiyorum",
  "Yetkili servis var mı?",
  "Yetkili servise yönlendirir misiniz?",
  "Fiyatı görüşmek istiyorum",
  "Ustanız ne zaman gelir?",
  "İnsanlar çok memnun kalmış",
  "Temsilcilik adresiniz nerede?",
  "Operatör ücreti ne kadar?",
  "Kombi için randevu almak istiyorum",
];

describe("pedido de pessoa em turco", () => {
  for (const texto of PEDE_PESSOA) {
    it(`passa para uma pessoa: ${texto}`, () => {
      expect(detectHumanHandoffRequest(texto)).toBe(true);
    });
  }

  for (const texto of NAO_PEDE) {
    it(`não passa: ${texto}`, () => {
      expect(detectHumanHandoffRequest(texto)).toBe(false);
    });
  }
});
