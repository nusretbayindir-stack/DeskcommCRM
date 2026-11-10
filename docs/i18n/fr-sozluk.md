# Fransızca terim sözlüğü ve üslup kuralları

Bu dosya, `lib/i18n/traducoes/fr.json` kataloğunu çevirenlerin tek başvuru kaynağıdır. Kataloğun anahtarı Portekizce ekran metnidir. Değeri o metnin Fransızcasıdır: Belçika'da, Belçika kullanımıyla. Çeviri bağlamı için her anahtarın İspanyolcası, İngilizcesi ve Türkçesi de verilir. Türkçe metin Belçika'ya göre düzeltildiği için Portekizce metin Brezilya'ya özgü bir şey söylüyorsa Türkçesi esas alınır.

**Durum: onaylandı** (2026-11-08, ürün sahibinin seçtiği Fransızca okuyucu; okuma ve not sayfasında). Fransızca katalog bu sözlükle çevrilir. Bir terimi ya da kuralı değiştirmek de onay ister.

Çeviri süreci:

1. `pnpm tsx scripts/i18n/lotes-para-traduzir.ts --idioma fr --tamanho 400 --saida <klasör>` komutu, eksik metinleri `lote-NNN.json` paketlerine böler.
2. Her paket çevrilir ve sonuç aynı klasöre `lote-NNN.fr.json` olarak yazılır. Biçim düzdür: `"anahtar": "Fransızcası"`.
3. `pnpm tsx scripts/i18n/juntar-lotes.ts --idioma fr --entrada <klasör>` komutu paketleri doğrular ve kataloğa birleştirir.

## Bozulmaz kurallar

Bunlar ekranı bozar. Birleştirme aracı ve testler bu tür hataları reddeder.

1. **Anahtar birebir korunur.** Tırnak, boşluk, nokta, büyük/küçük harf ve özel karakter (`›`, `—`, `×`, `…`, `“ ”`) dahil hiçbir şey değişmez. Anahtarı "düzeltmek" yeni bir anahtar yaratır. Gerçek ekran metni ise Portekizce kalır.
2. **Yer tutucular birebir korunur.** `{nome}` ve `{{nome}}` olduğu gibi kalır. Tek parantez ile çift parantez birbirine dönüşmez, içindeki ad çevrilmez. Sırası değişebilir, sayısı değişemez.
3. **Baştaki ve sondaki boşluk korunur.** `" (personalizada)"` gibi anahtarlar, ekranın başka bir kelimenin arkasına eklediği parçalardır. Anahtar boşlukla başlıyorsa Fransızcası da boşlukla başlar. Boşlukla bitiyorsa Fransızcası da boşlukla biter.
4. **Değer boş bırakılmaz.** Çevrilecek bir şey yoksa (örneğin yalnızca sembol, sayı veya marka adıysa) değer anahtarla aynı yazılır.
5. **HTML etiketleri, Markdown işaretleri, adresler ve e-posta adresleri** olduğu gibi kalır.
6. **Yer tutucunun önüne kesme işaretli artikel ya da edat kurulmaz.** "de {nome}" yazılırsa ad ünlüyle başladığında "d'" gerekir, "le {nome}" yazılırsa "l'" gerekir; ekran bunu bilemez. Cümle yeniden kurulur: "Contact : {nome}", "Entreprise : {nome}".

## Üslup

- **Kullanıcıya "vous" ile hitap edilir:** "Choisissez une formule", "Vérifiez votre connexion". "tu", "ton", "ta" kullanılmaz; `tests/unit/catalogos-belgas-estao-no-idioma` bunları reddeder. Tek istisna gerçek bir addır: "ton de voix" (ses tonu).
- **Düğmeler mastar hâlindedir.** Fransızca yazılımlarda gelenek budur: "Enregistrer", "Rechercher", "Supprimer", "Ajouter un contact". Açıklama cümlelerinde emir kipi "vous" ile kullanılır: "Choisissez une formule." Türkçedeki "düğme emir kipindedir" kuralı burada geçerli değildir.
- **Belçika kullanımı seçilir:** "GSM" (cep telefonu), "e-mail" ("courriel" değil; o Kanada kullanımıdır), "heures d'ouverture", "dossier" (vaka). Sayılar yazıyla geçerse Belçika biçimi kullanılır: "septante", "nonante".
- **Kısa ve sade yazılır.** Ekran metnidir. Portekizcedeki uzun cümle Fransızcada daha kısa söylenebiliyorsa kısa olan seçilir.
- **Büyük harf kullanımı Portekizceyi izler.** Cümle başı büyük harfle başlar. Başlıkta her kelime büyük yazılmaz. Gün ve ay adları küçük harfle yazılır: "lundi", "octobre".
- **Noktalama:** `:`, `;`, `?` ve `!` işaretlerinden önce bölünmez boşluk (U+00A0) bırakılır: "Contact : {nome}", "Voulez-vous continuer ?". Anahtarda bu işaretlerden önce boşluk yoksa da değerde bırakılır.
- **Tırnak işareti « … » biçimindedir,** içinde bölünmez boşlukla: « client ».
- **Kesme işareti düz yazılır:** `'` (aujourd'hui, l'entreprise).
- **Sayıdan sonra çoğul gelir:** "3 messages", "1 message". Ekran sayıyı ayrı bir parçanın önüne koyuyorsa (`incidentes`, `solicitações`, `conexões`), parça çoğul çevrilir: "incidents", "demandes", "connexions". Türkçedeki "sayıdan sonra tekil" kuralı burada geçerli değildir.
- **Arama kutusu "Rechercher" ile başlar:** "Rechercher : nom, téléphone, dernier message…".
- **Brezilya'ya özgü yasa, belge ve para birimi geçmez.** Okuyan, Belçika'da çalışan bir şirkettir. `LGPD`, `CNPJ`, `BRL`, `R$`, `Procon` geçen değeri test reddeder. Karşılıklar aşağıdaki terim tablosundadır.
- **Hollandaca kısaltma geçmez.** Fransızca değerde `KBO`, `btw`, `GBA` yazılmaz; `BCE`, `TVA`, `APD` yazılır. Test bunu da denetler. "Número da empresa (KBO/BCE)" → "Numéro d'entreprise (BCE)".
- **Cümle parçaları parça olarak çevrilir.** Bazı anahtarlar ekranda bir sayının veya başka bir metnin önüne ya da arkasına eklenir ("no máximo 1× a cada", "(publicada como v"). Anlam korunur. Gerekirse daha nötr bir kalıp seçilir.
- **"IA" Fransızcada "IA" kalır.** Türkçe ve Hollandacadaki "AI" kuralı burada geçerli değildir: "Agente de IA" → "assistant IA".
- **İngilizce iç terimler geçmez.** `tenant`, `actor`, `customer` yazılmaz (test reddeder): "entreprise", "client".

## Çevrilmeyecek adlar

Bu adlar olduğu gibi yazılır:

WhatsApp, Instagram, Meta, API, CSV, PIX, Stripe, Asaas, OpenAI, Anthropic, Claude, Supabase, Google, Gmail, RGPD, SMTP, JSON, PDF, URL, Webhook, Cold Call

Ürün adı (marka) da çevrilmez. Türkçe ve Hollandaca listedeki GDPR yerine Fransızcada RGPD yazılır. "Cold Call" ekran ve huni adıdır, İngilizce kalır (kullanıcının kararı, 2026-11-09; Türkçe sözlükle aynı).

## Tarih kalıpları

Tarih kalıpları date-fns `fr` yerel ayarıyla biçimlenir. Portekizcedeki `'de'` ve `'às'` gibi sabit sözcükler kalmaz. Saatin önüne `'à'` gelir. Kalıp içindeki harfler (`d`, `M`, `y`, `E`, `H`, `m`) birer alan kodudur. Kalıba Fransızca bir sözcük eklenmesi gerekiyorsa sözcük tek tırnak içine yazılır (`'à'`), yoksa date-fns onu alan kodu sanar. Sözcüğün kendisi kesme işareti içeriyorsa kesme işareti iki kez yazılır: `'aujourd''hui'`.

| Portekizce kalıp | Fransızca kalıp | Örnek çıktı |
|---|---|---|
| `d 'de' MMM` | `d MMM` | 19 oct. |
| `d 'de' MMMM` | `d MMMM` | 19 octobre |
| `d 'de' MMMM 'às' HH:mm` | `d MMMM 'à' HH:mm` | 19 octobre à 14:30 |
| `EEEE, d 'de' MMM` | `EEEE d MMM` | lundi 19 oct. |
| `EEEE, d 'de' MMMM` | `EEEE d MMMM` | lundi 19 octobre |
| `EEEE, d 'de' MMMM 'às' HH:mm` | `EEEE d MMMM 'à' HH:mm` | lundi 19 octobre à 14:30 |
| `MMMM 'de' yyyy` | `MMMM yyyy` | octobre 2026 |

`'de'` içermeyen kalıplar (`dd/MM/yyyy`, `HH:mm` gibi) olduğu gibi kalır.

## Terimler

Emin olunmayan bir terimde bu tablo esas alınır. Aynı Portekizce terim her yerde aynı Fransızca karşılıkla çevrilir. Türkçe sütun, anlamı karşılaştırmak içindir.

| Portekizce | Türkçe | Fransızca |
|---|---|---|
| lead | potansiyel müşteri | prospect |
| funil | satış hunisi | pipeline ("Funis de vendas": "Pipelines de vente") |
| etapa | aşama | étape |
| negócio / oportunidade | fırsat | opportunité |
| contato | kişi | contact |
| conversa | konuşma | conversation |
| atendimento | görüşme (isim) | prise en charge. Fiil olarak "atender" bağlama göre "répondre" veya "prendre en charge" olur: "o assistente vai atender" → "l'assistant répond". |
| atendente | temsilci (insan) | conseiller. İspanyolcası "Agente" ise kastedilen IA asistanıdır: "assistant". |
| RGPD / LGPD | GDPR | RGPD |
| CNPJ | vergi numarası | numéro d'entreprise |
| CPF | kimlik numarası | numéro d'identification ("numéro de registre national" değil: ürün kişiden ulusal sicil numarası istemez) |
| CPF ou CNPJ | kimlik veya vergi numarası | numéro d'identification ou d'entreprise |
| KBO/BCE | KBO/BCE | BCE ("Número da empresa (KBO/BCE)": "Numéro d'entreprise (BCE)") |
| IVA / imposto | KDV | TVA ("numéro de TVA") |
| autoridade de proteção de dados (Belçika) | veri koruma kurumu | Autorité de protection des données (APD) |
| controlador / responsável pelo tratamento | veri sorumlusu | responsable du traitement |
| subcontratante / operador (de dados) | veri işleyen | sous-traitant |
| prestador de serviço | hizmet veren | prestataire |
| contrato de serviço | hizmet sözleşmesi | contrat de service |
| Política de Privacidade | Gizlilik Politikası | Déclaration de confidentialité |
| tenant | şirket | entreprise ("Tenants" menüsü: "Entreprises") |
| empresa / organização | şirket | entreprise |
| cross-tenant | tüm şirketler | toutes les entreprises |
| rodízio | dönüşümlü atama | rotation ("fila do rodízio": "file de rotation") |
| de (sayaç: "3 de 10") | "/" ("3 / 10") | "/" ("3 / 10"). Sayaç olmayan "de/da" tek başına çevrilmez. |
| duplicado (kayıt) | mükerrer kayıt | doublon |
| Moeda (alan türü) | para tutarı | montant |
| agente de IA | AI asistanı | assistant IA |
| agente (tek başına) | asistan | assistant |
| follow-up | takip mesajı | message de relance |
| etiqueta / tag | etiket | étiquette |
| equipe / time | ekip | équipe |
| painel | panel | tableau de bord. Yönetici paneli: "panneau d'administration". |
| plano | plan | formule |
| cobrança | ödeme | facturation |
| pagamento | ödeme | paiement |
| fatura | fatura | facture |
| assinatura | abonelik | abonnement |
| teste grátis | ücretsiz deneme | essai gratuit |
| suspenso | askıya alınmış | suspendu |
| conexão | bağlantı | connexion |
| canal | kanal | canal |
| disparo | toplu gönderim | envoi groupé |
| campanha | kampanya | campagne |
| roteador | yönlendirici | répartiteur |
| transferir para humano | bir çalışana aktar | transférer à un conseiller |
| caixa de entrada / Inbox | gelen kutusu | boîte de réception |
| mensagem | mesaj | message |
| modelo (de mensagem) / template | şablon | modèle |
| resposta rápida | hazır yanıt | réponse rapide (WhatsApp Business'taki adıyla aynı) |
| agenda | takvim | agenda |
| agendamento / compromisso | randevu | rendez-vous |
| tarefa | görev | tâche |
| configurações | ayarlar | paramètres |
| usuário | kullanıcı | utilisateur |
| senha | şifre | mot de passe |
| entrar / login | giriş yap | se connecter |
| sair / logout | çıkış yap | se déconnecter |
| criar conta / cadastrar-se | hesap oluştur | créer un compte |
| permissão | yetki | autorisation |
| papel / função | rol | rôle |
| dono | sahip | propriétaire |
| administrador | yönetici | administrateur |
| relatório | rapor | rapport |
| desempenho | performans | performances |
| automação | otomasyon | automatisation |
| gatilho | tetikleyici | déclencheur |
| regra | kural | règle |
| fila | kuyruk | file d'attente |
| base de conhecimento | bilgi bankası | base de connaissances |
| integração | entegrasyon | intégration |
| extensão | eklenti | extension |
| módulo | modül | module |
| campo personalizado | özel alan | champ personnalisé |
| responsável | sorumlu | responsable |
| prospecção | müşteri adayı bulma | prospection |
| janela de envio | gönderim aralığı | plage d'envoi |
| fuso horário | saat dilimi | fuseau horaire |
| horário de atendimento | çalışma saatleri | heures d'ouverture |
| instalação | kurulum | installation |
| servidor | sunucu | serveur |
| telefone | telefon | téléphone. Cep telefonu: "GSM". |
| e-mail | e-posta | e-mail |
| Salvar | Kaydet | Enregistrer |
| Cancelar | İptal | Annuler |
| Excluir | Sil | Supprimer |
| Arquivar | Arşivle | Archiver |
| Editar | Düzenle | Modifier |
| Voltar | Geri | Retour |
| Continuar | Devam et | Continuer |
| Tentar de novo | Tekrar dene | Réessayer |
| comanda | adisyon | addition |
| caixa (o do dinheiro) | kasa | caisse |
| comissão | komisyon | commission |
| fidelidade | sadakat | fidélité |
| esfriando (durum adı) | soğuyor | en refroidissement |
| Automático | Otomatik | Automatique |
| acompanhar / acompanhamento (konuşmayı) | izle / izleme | suivre / suivi |
| abordar / abordagem (müşteri adayına) | iletişime geç / ilk temas | contacter / premier contact |
| Central / Central de avisos | Bildirim merkezi | Centre de notifications |
| cadastro (bir kişinin ya da şirketin kaydı) | kayıt | fiche |
| cadastro (kayıt olma) | kayıt | inscription |
| chamado | talep | demande |
| capacidade (yetenek anlamında) | yetenek | capacité |
| jornada (asistanın özelliği; İngilizcesi "journey") | yolculuk | parcours |
| jornada publicada / horário publicado (çalışma saatleri) | çalışma düzeni | horaire de travail |
| skill | beceri | compétence |
| caso | vaka | dossier |
| caso parado | bekleyen vaka | dossier en attente |
| acervo | arşiv | archives |
| carteira (müşteri) | portföy | portefeuille |
| quadro (kanban) | pano | tableau |
| passagem (devir anlamında) | devir | passation |
| Central de Conexões | Bağlantı Merkezi | Centre de connexions |
| estornar | iade et | rembourser |
| setor (ekip içi birim) | departman | service ("service comptabilité" gibi) |
| meta (satış hedefi) | hedef | objectif ("Meta de vendas": "Objectif de vente") |
| atalho | kısayol | raccourci |
| aviso | bildirim. Ekibe duyuru modülünde: duyuru. | notification. Ekibe duyuru modülünde: annonce. |
| imagem (Docker, güncelleme ekranı) | imaj | image. Fotoğraf/görsel anlamında da: image. |
| remetente | gönderen | expéditeur |
| fornecedor | tedarikçi | fournisseur |
| recorrência / recorrente | yinelenen | récurrence / récurrent |
| revendedor | bayi | revendeur |
| fallback (asistan) | yedek | de secours ("Agente de fallback": "Assistant de secours") |
| dispensar (öneri) | yok say | ignorer |
| lateral (Gelen kutusunun yan paneli) | yan panel | panneau latéral |
| agente do servidor (güncelleme programı) | sunucu ajanı | agent du serveur (assistant IA değildir) |

**CSV sütun adları çevrilmez.** `nome, telefone, email, cpf, nascimento, tags` gibi sütun adları içe aktarıcının tanıdığı başlıklardır (`lib/contacts/csv.ts`). Metinde olduğu gibi kalır.

**SSS işaretleri cümlede yer tutucuyla gelir.** İşaret cümleleri `{pergunta}` ve `{resposta}` yer tutucularını taşır; çevirmen bunları olduğu gibi korur, işaretin kendisini yazmaz. Fransızca işaretler `## Question :` ve `## Réponse :` olacak; `lib/ai/rag/ingest/marcadores-de-faq.ts` dosyasına Görev 7'de eklenir.

**Durdurma kelimeleri çevrilmez.** Metin müşterinin yazacağı bir kelimeyi söylüyorsa (`responda PARAR`, `envie SAIR`, `BAJA`, `STOP`), Fransızcada **STOP** yazılır: "Demandez au client d'envoyer STOP." Sistem bu kelimeyi her dilde tanır.

Tırnak içindeki örnek adlar (`etiqueta “cliente”` gibi) çevrilir: « client ». Bunlar kayıtlı veri değil, açıklamadaki örneklerdir.
