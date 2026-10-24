/**
 * O OPT-OUT EM TURCO, calibrado como o português e o espanhol.
 *
 * Antes deste arquivo o detector não tinha uma palavra turca: só "STOP" (a
 * palavra que o rodapé turco oferece) bloqueava. "Bana bir daha mesaj
 * göndermeyin" passava em branco — pedido de KVKK/GDPR ignorado — e nada em
 * turco escalava para um humano.
 *
 * Os três corpora seguem a régua de `lib/opt-out/deteccao.ts`:
 *   - BLOQUEIA: verbo de cessação com OBJETO DE COMUNICAÇÃO (mesaj, bana yazmak,
 *     beni aramak), ou "beni/numaramı" saindo da lista;
 *   - ESCALA SEM BLOQUEAR: o sinal que pode ser outra coisa — "aboneliğimi
 *     iptal" pode ser o plano da academia; "iptal" sozinho pode ser a consulta;
 *   - NADA: a fala comum de oficina, loja de peças e imobiliária — "bu parçayı
 *     listeden çıkarın" é pedido de orçamento, não de descadastro.
 *
 * O texto turco chega com ı/İ e com ş, ç, ğ, ö, ü; maiúsculas sem o ponto
 * ("ATMAYIN") também. Cada lista mistura as grafias.
 */
import { describe, expect, it } from "vitest";

import { ehOptOutProvavel, ehPedidoDeOptOut } from "@/lib/opt-out/deteccao";

/** Pedidos de descadastro inequívocos: gravam `is_blocked`. */
const TURCO_PEDE_PARA_SAIR = [
  "STOP",
  "Bana bir daha mesaj göndermeyin",
  "Artık mesaj atmayın",
  "Lütfen mesaj göndermeyin.",
  "MESAJ ATMAYIN",
  "mesaj atmayin",
  "Bana yazmayın artık",
  "Beni aramayın, mesaj da atmayın",
  "Mesaj almak istemiyorum",
  "Artık mesaj istemiyorum",
  "Reklam mesajı istemiyorum",
  "Bu mesajları almak istemiyorum",
  "Beni listeden çıkarın",
  "BENİ LİSTEDEN ÇIKARIN",
  "Listenizden çıkmak istiyorum",
  "Numaramı listenizden silin",
  "Mesajlarınızı durdurun",
  "Mesaj göndermeyi bırakın",
];

/** O sinal que escala para um humano e NÃO bloqueia sozinho. */
const TURCO_AMBIGUO = [
  "Beni rahat bırakın",
  "Rahatsız etmeyin",
  "Beni rahatsız etmeyin lütfen",
  "Yeter artık",
  "Artık yeter",
  "Artık ilgilenmiyorum",
  "Zaten istemediğimi söyledim",
  "Aboneliğimi iptal etmek istiyorum",
  "Abonelikten çıkmak istiyorum",
  "Bildirim istemiyorum",
  "İptal",
  "Durdur",
];

/** Fala de cliente: não bloqueia e não escala. */
const TURCO_NAO_PEDE = [
  "Dur bir dakika, fiyatı tekrar söyler misiniz?",
  "Dur",
  "Ürünü listeden çıkardınız mı?",
  "Bu parçayı listeden çıkarın, diğerini alacağım",
  "Kampanya istemiyorum, normal fiyat yeterli",
  "Mesaj atmak istemiyorum, arayabilir misiniz?",
  "Size mesaj attım, cevap bekliyorum",
  "Randevuyu iptal etmek istiyorum",
  "Sipariş iptal mi oldu?",
  "Faturaya bunu yazmayın lütfen",
  "Beni yarın arayın",
  // Troca de canal, não descadastro — o espelho de "não quero receber
  // ligação, só whatsapp" no corpus português: quer seguir recebendo AQUI.
  "Beni aramayın, buradan yazın",
  "Telefonla aramayın, WhatsApp'tan yazın",
  "Abonelik ücreti ne kadar?",
  "Fiyat listesini gönderir misiniz?",
  "Mesajınızı aldım, teşekkürler",
  "Bildirim geldi ama açamadım",
  "Bu ürünü istemiyorum, başka modeliniz var mı?",
  "İstemiyorum, teşekkürler",
  "İlgilenmiyorum",
  "Yeterli olur, teşekkürler",
  "Kombi durdu, servis lazım",
];

describe("turco — o pedido inequívoco bloqueia", () => {
  for (const texto of TURCO_PEDE_PARA_SAIR) {
    it(`bloqueia: ${texto}`, () => {
      expect(ehPedidoDeOptOut(texto)).toBe(true);
    });
  }
});

describe("turco — o sinal ambíguo escala e não bloqueia", () => {
  for (const texto of TURCO_AMBIGUO) {
    it(`escala sem bloquear: ${texto}`, () => {
      expect(ehOptOutProvavel(texto), "escala").toBe(true);
      expect(ehPedidoDeOptOut(texto), "não bloqueia").toBe(false);
    });
  }
});

describe("turco — a fala comum não bloqueia nem escala", () => {
  for (const texto of TURCO_NAO_PEDE) {
    it(`nada: ${texto}`, () => {
      expect(ehOptOutProvavel(texto)).toBe(false);
    });
  }
});
