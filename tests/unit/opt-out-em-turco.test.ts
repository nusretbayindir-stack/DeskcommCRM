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
  // Revisão (review-turkce-demo-oncesi): flexões e ordens que escapavam.
  "Bana mesaj atma",
  "Mesaj atma bana!",
  "Mesaj gönderme artık",
  "Bana bir daha mesaj çekmeyin",
  "SMS atmayın",
  "SMS göndermeyin",
  "WhatsApp'tan yazmayın",
  "Bir daha yazmayın",
  "Artık yazmayın",
  "Bize yazmayın",
  "İstemiyorum, artık yazmayın",
  "Bana bir daha mesaj gelmesin",
  "Reklam göndermeyin",
  "Reklam istemiyorum",
  "Mesajlarınızla rahatsız etmeyin",
  "Listeden çıkar beni",
  "Listeden çıkarın lütfen",
  "Beni listenizden çıkartın",
  "Beni listeden siler misiniz",
  "Beni bu listeden çıkarın",
  "Beni yayın listesinden çıkarın",
  "Mesaj gönderimini durdurun",
  "Mesaj atmayı bırak",
  "Gece de gündüz de mesaj atmayın",
  // "RET" é a palavra que todo SMS comercial turco ensina (İYS: "RET yazıp
  // … gönderin"): o STOP do turco, sozinho.
  "RET",
  "Ret",
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
  // A mensagem AUTOMÁTICA ou o LEMBRETE: quem não quer o robô quer uma
  // pessoa, e quem não quer o lembrete não pediu para sumir. Um humano decide.
  "Otomatik mesaj istemiyorum, yetkiliyle görüşmek istiyorum",
  "Robot mesajı istemiyorum, gerçek bir insanla konuşmak istiyorum",
  "Bot mesajı istemiyorum",
  "Hazır mesaj istemiyorum, soruma cevap verin",
  "Otomatik mesaj atmayın, biri beni arasın",
  "Otomatik mesajları durdurun, bir yetkili yazsın",
  "Hatırlatma mesajı istemiyorum",
  "Randevu hatırlatma mesajlarını durdurun",
  "Hatırlatma mesajı göndermeyin, ben unutmam",
  // Troca para o TELEFONE: lead quente que pede ligação. Bloquear fecharia o
  // negócio como perdido; escalar faz alguém ligar.
  "Mesaj atmayın, arayın",
  "Mesaj atmayın direkt arayın lütfen",
  "Arayın, mesaj atmayın",
  "Bana yazmayın, arayın",
  "Bana yazmayın, sesli mesaj atın, araba kullanıyorum",
  "WhatsApp'tan yazmayın, arayın",
  // Apagar os dados (KVKK/GDPR) e o incômodo dito sem o verbo de cessação.
  "Numaramı silin",
  "Bilgilerimi silin",
  "Yazmayın",
  "Rahatsız etme",
  "Rahatsız ediyorsunuz",
  "Bıktım mesajlarınızdan",
  "Sürekli mesaj atıp rahatsız ediyorsunuz",
  "Engelleyeceğim",
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
  // QUANDO e COMO a mensagem chega — o cliente segue comprando, e escalar
  // calaria o agente na conversa. Nada.
  "Gece mesaj atmayın lütfen",
  "GECE MESAJ ATMAYIN",
  "Gece yarısı mesaj atmayın, sabah yazın",
  "Hafta sonu mesaj atmayın, pazartesi görüşürüz",
  "Mesai saatleri dışında mesaj göndermeyin",
  "Sabah 9'dan önce mesaj atmayın",
  "Bu saatte mesaj atmayın, yarın konuşalım",
  "Akşamları mesaj göndermeyin, işteyim",
  "Sesli mesaj atmayın, yazarak yazın",
  "Sesli mesaj göndermeyin lütfen, okuyorum sadece",
  "Sesli mesaj istemiyorum, yazılı cevap verin",
  "Uzun mesaj atmayın, kısa yazın",
  // O instrumental (`mesajla`) é o CANAL de um anexo — o "manda por email"
  // que o espanhol já corrigiu.
  "Faturayı mesajla göndermeyin, mail atın",
  "Fotoğrafları mesajla göndermeyin, e-postaya atın",
  // `abonelik` de serviço público: o contrato de gás, água e luz.
  "Doğalgaz aboneliğimi iptal ettim, sayacı sökmeniz lazım",
  "Doğalgaz aboneliğini iptal ettirdim, kombi sökümü yapar mısınız?",
  "Elektrik aboneliğini iptal ettirmem gerekiyor mu?",
  "Su aboneliği iptal edildi, ev sahibi ne yapmalı?",
  // Descrição, pergunta e o item específico — não pedido.
  "Arabadaki tıkırtı beni rahat bırakmıyor, ne zaman bakabilirsiniz?",
  "Bu ses beni rahat bırakmadı",
  "Komşuları rahatsız etmeyin, sessiz çalışın",
  "Lütfen sabah erken gelip komşuları rahatsız etmeyin",
  "2 kat boya yaptık, artık yeter mi?",
  "Artık yeter mi bu kadar parça?",
  "O evle artık ilgilenmiyorum, başka ilan var mı?",
  "O araçla artık ilgilenmiyorum, diğerini görebilir miyim?",
  // A lista de ESPERA vem antes, e o "listeden" de depois é dela.
  "Bekleme listesindeyim ama listeden çıkmak istiyorum, aracı başka yerden aldım",
  "Bekleme listesine yazmıştınız, beni listeden çıkarın, aracı aldım",
  "Eski numaramı silin, yenisi bu",
  "Mesaj atma imkanı var mı?",
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
