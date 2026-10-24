/**
 * O PEDIDO DE PESSOA EM TURCO, na detecção determinística do engine.
 *
 * `detectHumanHandoffRequest` só conhecia o português: "Bir yetkiliyle görüşmek
 * istiyorum" dependia das palavras de passagem do agente ou do próprio modelo
 * para chegar a uma pessoa. A régua é a do português — verbo de contato com
 * alvo humano, ou expressão inequívoca —, e o lado negativo guarda o que a
 * oficina e o encanador ouvem todo dia: "yetkili servis" é a assistência
 * técnica autorizada, não um pedido de atendente.
 *
 * O turno de produção soma a regex às palavras padrão do agente turco
 * (`matchesHandoffKeyword`): o lado negativo é verificado nos DOIS.
 */
import { describe, expect, it } from "vitest";

import { matchesHandoffKeyword, palavrasDePassagem } from "@/lib/agent-engine/agent/agent-config";
import { detectHumanHandoffRequest } from "@/lib/agent-engine/agent/human-handoff";
import { palavrasDePassagemPadrao } from "@/lib/ai/agents/palavras-de-passagem";

const PALAVRAS_TURCAS = palavrasDePassagem(palavrasDePassagemPadrao("tr"));

/** A decisão do turno: regex OU palavra do agente (inbound-turn). */
function passaNoTurno(texto: string): boolean {
  return detectHumanHandoffRequest(texto) || matchesHandoffKeyword(texto, PALAVRAS_TURCAS);
}

const PEDE_PESSOA = [
  "Bir yetkiliyle görüşmek istiyorum",
  "YETKİLİ BİRİYLE GÖRÜŞMEK İSTİYORUM",
  "Yetkili biriyle konuşabilir miyim?",
  "Satış temsilcinizle görüşmek istiyorum",
  "Müşteri temsilcisiyle konuşmak istiyorum",
  "Gerçek bir insanla konuşmak istiyorum",
  "Gerçek bir insan lazım",
  "İnsanla konuşmak istiyorum",
  "Ekipten biriyle görüşebilir miyim?",
  "Beni bir yetkiliye bağlar mısınız?",
  "Operatöre bağlayın lütfen",
  "Müşteri hizmetlerine bağlar mısınız",
  "Canlı destek istiyorum",
  "Yetkiliyle görüşmem lazım",
  "Yetkili biriyle görüşeyim",
  // O `ile` separado é como se escreve na maior parte das vezes.
  "Yetkili ile görüşmek istiyorum",
  "YETKİLİ İLE GÖRÜŞMEK İSTİYORUM",
  "Bir yetkili ile görüşebilir miyim?",
  "Müşteri temsilcisi ile görüşmek istiyorum",
  "İnsan ile konuşmak istiyorum",
  "Müdürle görüşmek istiyorum",
  "Müdürünüzle görüşmek istiyorum",
  "Sorumlu kişiyle görüşmek istiyorum",
];

/** Nem a regex nem as palavras padrão do agente turco passam. */
const NAO_PEDE = [
  "Yetkili servisle görüşmek istiyorum",
  "Yetkili servis var mı?",
  "Yetkili servise yönlendirir misiniz?",
  "Fiyatı görüşmek istiyorum",
  "Ustanız ne zaman gelir?",
  "İnsanlar çok memnun kalmış",
  "Bu sitede oturan insanlar nasıl?",
  "İnsanların yorumlarına baktım",
  "Temsilcilik adresiniz nerede?",
  "Operatör ücreti ne kadar?",
  "Fiyata operatör dahil mi?",
  "Operatörlü kepçe kiralıyor musunuz?",
  "Vinç operatörü yarın gelir mi?",
  "Hangi operatörü kullanıyorsunuz, Turkcell mi?",
  "Yetkili birimden onay gelmedi",
  "Kombi için randevu almak istiyorum",
  // "gerçek kişi" é a PESSOA FÍSICA da fatura, da escritura e do contrato.
  "Faturayı gerçek kişi adına mı keseceksiniz?",
  "Gerçek kişi mi tüzel kişi mi olarak fatura istiyorsunuz?",
  "Gerçek kişi olarak fatura kesilsin",
  "Tapu gerçek kişi adına mı olacak?",
  "Şirket değilim, gerçek kişiyim",
  // O relato e a recusa não são pedido (o português só aceita o infinitivo).
  "Satış temsilcinizle konuştum dün, teklif bekliyorum",
  "Operatörle konuştum, yarın kepçe gelecek",
  "İnsanla konuşmak istemiyorum",
  "Yetkililer bağlantıyı kesti",
  "Elektrik yetkilileri bağlantıyı yaptı mı?",
  "Yetkiliyle görüştüm, fiyatı onayladı",
  "Sizin yetkilinizle görüştük, indirim yapacaktı",
  "Sigorta temsilcisiyle görüştüm, hasar dosyası açıldı",
  "Yetkiliyle konuşmak istemiyorum, siz cevap verin",
  "Yetkiliyle görüşmeme gerek yok, siz yardımcı olun",
  "Yetkiliyle görüşmedim henüz",
];

describe("pedido de pessoa em turco", () => {
  for (const texto of PEDE_PESSOA) {
    it(`a regex passa para uma pessoa: ${texto}`, () => {
      expect(detectHumanHandoffRequest(texto)).toBe(true);
    });
  }

  for (const texto of NAO_PEDE) {
    it(`não passa no turno: ${texto}`, () => {
      expect(passaNoTurno(texto)).toBe(false);
    });
  }
});
