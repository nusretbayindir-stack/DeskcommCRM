# Hollandaca terim sözlüğü ve üslup kuralları

Bu dosya, `lib/i18n/traducoes/nl.json` kataloğunu çevirenlerin tek başvuru kaynağıdır. Kataloğun anahtarı Portekizce ekran metnidir. Değeri o metnin Hollandacasıdır: Belçika'da, Flaman kullanımıyla. Çeviri bağlamı için her anahtarın İspanyolcası, İngilizcesi ve Türkçesi de verilir. Türkçe metin Belçika'ya göre düzeltildiği için Portekizce metin Brezilya'ya özgü bir şey söylüyorsa Türkçesi esas alınır.

**Durum: taslak.** Onaylayan: ürün sahibi. Bu sözlük onaylanmadan Hollandaca katalog çevrilmez.

Çeviri süreci:

1. `pnpm tsx scripts/i18n/lotes-para-traduzir.ts --idioma nl --tamanho 400 --saida <klasör>` komutu, eksik metinleri `lote-NNN.json` paketlerine böler.
2. Her paket çevrilir ve sonuç aynı klasöre `lote-NNN.nl.json` olarak yazılır. Biçim düzdür: `"anahtar": "Hollandacası"`.
3. `pnpm tsx scripts/i18n/juntar-lotes.ts --idioma nl --entrada <klasör>` komutu paketleri doğrular ve kataloğa birleştirir.

## Bozulmaz kurallar

Bunlar ekranı bozar. Birleştirme aracı ve testler bu tür hataları reddeder.

1. **Anahtar birebir korunur.** Tırnak, boşluk, nokta, büyük/küçük harf ve özel karakter (`›`, `—`, `×`, `…`, `“ ”`) dahil hiçbir şey değişmez. Anahtarı "düzeltmek" yeni bir anahtar yaratır. Gerçek ekran metni ise Portekizce kalır.
2. **Yer tutucular birebir korunur.** `{nome}` ve `{{nome}}` olduğu gibi kalır. Tek parantez ile çift parantez birbirine dönüşmez, içindeki ad çevrilmez. Sırası değişebilir, sayısı değişemez.
3. **Baştaki ve sondaki boşluk korunur.** `" (personalizada)"` gibi anahtarlar, ekranın başka bir kelimenin arkasına eklediği parçalardır. Anahtar boşlukla başlıyorsa Hollandacası da boşlukla başlar. Boşlukla bitiyorsa Hollandacası da boşlukla biter.
4. **Değer boş bırakılmaz.** Çevrilecek bir şey yoksa (örneğin yalnızca sembol, sayı veya marka adıysa) değer anahtarla aynı yazılır.
5. **HTML etiketleri, Markdown işaretleri, adresler ve e-posta adresleri** olduğu gibi kalır.
6. **"aanmelden" ve "afmelden" kullanılmaz.** Belçika'da "aanmelden" oturum açmak, Hollanda'da kayıt olmak demektir; okuyan hangisini kastettiğimizi bilemez. "afmelden" ise hem oturumu kapatmak hem abonelikten çıkmak demektir ve müşteri mesajında durdurma kelimesi olarak tanınır (Görev 8). Yerine: "Inloggen", "Uitloggen", "Account aanmaken", "Uitschrijven".

## Üslup

- **Kullanıcıya "u" ile hitap edilir,** iyelik "uw"dur: "Kies een plan", "Controleer uw verbinding". "je", "jij", "jouw" kullanılmaz; `tests/unit/catalogos-belgas-estao-no-idioma` bunları reddeder. Flaman konuşma dilindeki "ge" ve "gij" de kullanılmaz.
- **Düğmeler mastar hâlindedir.** Hollandaca yazılımlarda gelenek budur: "Opslaan", "Zoeken", "Verwijderen", "Nieuw contact toevoegen". Açıklama cümlelerinde emir kipi kullanılır: "Kies een plan." Türkçedeki "düğme emir kipindedir" kuralı burada geçerli değildir.
- **Belçika kullanımı seçilir.** Hollanda'ya özgü kelime yerine Flaman okurun doğal bulduğu kelime yazılır: "gsm" ("mobiel" değil), "openingsuren" ("openingstijden" değil), "fiche" (kişinin ya da şirketin kaydı), "dossier" (vaka), "btw" (küçük harf).
- **Kısa ve sade yazılır.** Ekran metnidir. Portekizcedeki uzun cümle Hollandacada daha kısa söylenebiliyorsa kısa olan seçilir.
- **Büyük harf kullanımı Portekizceyi izler.** Cümle başı büyük harfle başlar. Başlıkta her kelime büyük yazılmaz. Gün ve ay adları küçük harfle yazılır: "maandag", "oktober".
- **Sayıdan sonra çoğul gelir:** "3 berichten", "1 bericht". Ekran sayıyı ayrı bir parçanın önüne koyuyorsa (`incidentes`, `solicitações`, `conexões`), parça çoğul çevrilir: "incidenten", "aanvragen", "verbindingen". Türkçedeki "sayıdan sonra tekil" kuralı burada geçerli değildir.
- **Arama kutusu "Zoeken" ile başlar:** "Zoeken: naam, telefoon, laatste bericht…".
- **Brezilya'ya özgü yasa, belge ve para birimi geçmez.** Okuyan, Belçika'da çalışan bir şirkettir. `LGPD`, `CNPJ`, `BRL`, `R$`, `Procon` geçen değeri test reddeder. Karşılıklar aşağıdaki terim tablosundadır.
- **Fransızca kısaltma geçmez.** Hollandaca değerde `BCE`, `TVA`, `APD` yazılmaz; `KBO`, `btw`, `GBA` yazılır. Test bunu da denetler. "Número da empresa (KBO/BCE)" → "Ondernemingsnummer (KBO)".
- **Yer tutucunun önüne artikel ya da sıfat çekimi kurulmaz.** "de {nome}" veya "het {nome}" yazılmaz, çünkü adın cinsi bilinmez. Cümle yeniden kurulur: "Contact: {nome}", "Bedrijf: {nome}".
- **Cümle parçaları parça olarak çevrilir.** Bazı anahtarlar ekranda bir sayının veya başka bir metnin önüne ya da arkasına eklenir ("no máximo 1× a cada", "(publicada como v"). Anlam korunur. Gerekirse daha nötr bir kalıp seçilir.
- **"IA" her zaman "AI" olur.** Birleşik isimde kısa çizgiyle yazılır: "Agente de IA" → "AI-assistent", "orçamento de IA" → "AI-budget".
- **Tırnak işareti “…” biçimindedir.**
- **İngilizce iç terimler geçmez.** `tenant`, `actor`, `customer` yazılmaz (test reddeder): "bedrijf", "klant".

## Çevrilmeyecek adlar

Bu adlar olduğu gibi yazılır:

WhatsApp, Instagram, Meta, API, CSV, PIX, Stripe, Asaas, OpenAI, Anthropic, Claude, Supabase, Google, Gmail, GDPR, SMTP, JSON, PDF, URL, Webhook

Ürün adı (marka) da çevrilmez.

## Tarih kalıpları

Tarih kalıpları date-fns `nlBE` yerel ayarıyla biçimlenir. Portekizcedeki `'de'` ve `'às'` gibi sabit sözcükler kalmaz. Saatin önüne `'om'` gelir. Kalıp içindeki harfler (`d`, `M`, `y`, `E`, `H`, `m`) birer alan kodudur. Kalıba Hollandaca bir sözcük eklenmesi gerekiyorsa sözcük tek tırnak içine yazılır (`'om'`), yoksa date-fns onu alan kodu sanar.

| Portekizce kalıp | Hollandaca kalıp | Örnek çıktı |
|---|---|---|
| `d 'de' MMM` | `d MMM` | 19 okt. |
| `d 'de' MMMM` | `d MMMM` | 19 oktober |
| `d 'de' MMMM 'às' HH:mm` | `d MMMM 'om' HH:mm` | 19 oktober om 14:30 |
| `EEEE, d 'de' MMM` | `EEEE d MMM` | maandag 19 okt. |
| `EEEE, d 'de' MMMM` | `EEEE d MMMM` | maandag 19 oktober |
| `EEEE, d 'de' MMMM 'às' HH:mm` | `EEEE d MMMM 'om' HH:mm` | maandag 19 oktober om 14:30 |
| `MMMM 'de' yyyy` | `MMMM yyyy` | oktober 2026 |

`'de'` içermeyen kalıplar (`dd/MM/yyyy`, `HH:mm` gibi) olduğu gibi kalır.

## Terimler

Emin olunmayan bir terimde bu tablo esas alınır. Aynı Portekizce terim her yerde aynı Hollandaca karşılıkla çevrilir. Türkçe sütun, anlamı karşılaştırmak içindir.

| Portekizce | Türkçe | Hollandaca |
|---|---|---|
| lead | potansiyel müşteri | lead (çoğulu: leads) |
| funil | satış hunisi | pijplijn ("Funis de vendas": "Verkooppijplijnen") |
| etapa | aşama | fase |
| negócio / oportunidade | fırsat | verkoopkans |
| contato | kişi | contact |
| conversa | konuşma | gesprek |
| atendimento | görüşme (isim) | klantcontact. Fiil olarak "atender" bağlama göre "antwoorden" veya "behandelen" olur: "o assistente vai atender" → "de assistent antwoordt". |
| atendente | temsilci (insan) | medewerker. İspanyolcası "Agente" ise kastedilen AI asistanıdır: "assistent". |
| RGPD / LGPD | GDPR | GDPR |
| CNPJ | vergi numarası | ondernemingsnummer |
| CPF | kimlik numarası | identificatienummer ("rijksregisternummer" değil: ürün kişiden ulusal sicil numarası istemez) |
| CPF ou CNPJ | kimlik veya vergi numarası | identificatie- of ondernemingsnummer |
| KBO/BCE | KBO/BCE | KBO ("Número da empresa (KBO/BCE)": "Ondernemingsnummer (KBO)") |
| IVA / imposto | KDV | btw ("btw-nummer") |
| autoridade de proteção de dados (Belçika) | veri koruma kurumu | Gegevensbeschermingsautoriteit (GBA) |
| controlador / responsável pelo tratamento | veri sorumlusu | verwerkingsverantwoordelijke |
| subcontratante / operador (de dados) | veri işleyen | verwerker |
| prestador de serviço | hizmet veren | dienstverlener |
| contrato de serviço | hizmet sözleşmesi | dienstenovereenkomst |
| Política de Privacidade | Gizlilik Politikası | Privacyverklaring |
| tenant | şirket | bedrijf ("Tenants" menüsü: "Bedrijven") |
| empresa / organização | şirket | bedrijf |
| cross-tenant | tüm şirketler | alle bedrijven |
| rodízio | dönüşümlü atama | beurtrol ("fila do rodízio": "wachtrij van de beurtrol") |
| de (sayaç: "3 de 10") | "/" ("3 / 10") | "/" ("3 / 10"). Sayaç olmayan "de/da" tek başına çevrilmez. |
| duplicado (kayıt) | mükerrer kayıt | duplicaat |
| Moeda (alan türü) | para tutarı | bedrag |
| agente de IA | AI asistanı | AI-assistent |
| agente (tek başına) | asistan | assistent |
| follow-up | takip mesajı | opvolgbericht |
| etiqueta / tag | etiket | label |
| equipe / time | ekip | team |
| painel | panel | dashboard. Yönetici paneli: "beheerpaneel". |
| plano | plan | plan |
| cobrança | ödeme | facturatie |
| pagamento | ödeme | betaling |
| fatura | fatura | factuur |
| assinatura | abonelik | abonnement |
| teste grátis | ücretsiz deneme | gratis proefperiode |
| suspenso | askıya alınmış | opgeschort |
| conexão | bağlantı | verbinding |
| canal | kanal | kanaal |
| disparo | toplu gönderim | massaverzending |
| campanha | kampanya | campagne |
| roteador | yönlendirici | verdeler |
| transferir para humano | bir çalışana aktar | doorverbinden met een medewerker |
| caixa de entrada / Inbox | gelen kutusu | inbox |
| mensagem | mesaj | bericht |
| modelo (de mensagem) / template | şablon | sjabloon |
| resposta rápida | hazır yanıt | snel antwoord (WhatsApp Business'taki adıyla aynı) |
| agenda | takvim | agenda |
| agendamento / compromisso | randevu | afspraak |
| tarefa | görev | taak |
| configurações | ayarlar | instellingen |
| usuário | kullanıcı | gebruiker |
| senha | şifre | wachtwoord |
| entrar / login | giriş yap | inloggen |
| sair / logout | çıkış yap | uitloggen |
| criar conta / cadastrar-se | hesap oluştur | account aanmaken |
| permissão | yetki | toegangsrecht |
| papel / função | rol | rol |
| dono | sahip | eigenaar |
| administrador | yönetici | beheerder |
| relatório | rapor | rapport |
| desempenho | performans | prestaties |
| automação | otomasyon | automatisering |
| gatilho | tetikleyici | trigger |
| regra | kural | regel |
| fila | kuyruk | wachtrij |
| base de conhecimento | bilgi bankası | kennisbank |
| integração | entegrasyon | integratie |
| extensão | eklenti | extensie |
| módulo | modül | module |
| campo personalizado | özel alan | aangepast veld |
| responsável | sorumlu | verantwoordelijke |
| prospecção | müşteri adayı bulma | prospectie |
| janela de envio | gönderim aralığı | verzendvenster |
| fuso horário | saat dilimi | tijdzone |
| horário de atendimento | çalışma saatleri | openingsuren |
| instalação | kurulum | installatie |
| servidor | sunucu | server |
| telefone | telefon | telefoon. Cep telefonu: "gsm". |
| e-mail | e-posta | e-mail |
| Salvar | Kaydet | Opslaan |
| Cancelar | İptal | Annuleren |
| Excluir | Sil | Verwijderen |
| Arquivar | Arşivle | Archiveren |
| Editar | Düzenle | Bewerken |
| Voltar | Geri | Terug |
| Continuar | Devam et | Doorgaan |
| Tentar de novo | Tekrar dene | Opnieuw proberen |
| comanda | adisyon | rekening |
| caixa (o do dinheiro) | kasa | kassa |
| comissão | komisyon | commissie |
| fidelidade | sadakat | loyaliteit |
| esfriando (durum adı) | soğuyor | koelt af |
| Automático | Otomatik | Automatisch |
| acompanhar / acompanhamento (konuşmayı) | izle / izleme | opvolgen / opvolging |
| abordar / abordagem (müşteri adayına) | iletişime geç / ilk temas | contact opnemen / eerste contact |
| Central / Central de avisos | Bildirim merkezi | Meldingencentrum |
| cadastro (bir kişinin ya da şirketin kaydı) | kayıt | fiche |
| cadastro (kayıt olma) | kayıt | registratie |
| chamado | talep | aanvraag |
| capacidade (yetenek anlamında) | yetenek | mogelijkheid |
| jornada (asistanın özelliği; İngilizcesi "journey") | yolculuk | traject |
| jornada publicada / horário publicado (çalışma saatleri) | çalışma düzeni | werkrooster |
| skill | beceri | vaardigheid |
| caso | vaka | dossier |
| caso parado | bekleyen vaka | stilliggend dossier |
| acervo | arşiv | archief |
| carteira (müşteri) | portföy | portefeuille |
| quadro (kanban) | pano | bord |
| passagem (devir anlamında) | devir | overdracht |
| Central de Conexões | Bağlantı Merkezi | Verbindingscentrum |
| estornar | iade et | terugbetalen |
| setor (ekip içi birim) | departman | afdeling |
| meta (satış hedefi) | hedef | doel ("Meta de vendas": "Verkoopdoel") |
| atalho | kısayol | snelkoppeling |
| aviso | bildirim. Ekibe duyuru modülünde: duyuru. | melding. Ekibe duyuru modülünde: mededeling. |
| imagem (Docker, güncelleme ekranı) | imaj | image. Fotoğraf/görsel anlamında: afbeelding. |
| remetente | gönderen | afzender |
| fornecedor | tedarikçi | leverancier |
| recorrência / recorrente | yinelenen | terugkerend |
| revendedor | bayi | wederverkoper |
| fallback (asistan) | yedek | reserve ("Agente de fallback": "Reserve-assistent") |
| dispensar (öneri) | yok say | negeren |
| lateral (Gelen kutusunun yan paneli) | yan panel | zijpaneel |
| agente do servidor (güncelleme programı) | sunucu ajanı | serveragent (AI-assistent değildir) |

**CSV sütun adları çevrilmez.** `nome, telefone, email, cpf, nascimento, tags` gibi sütun adları içe aktarıcının tanıdığı başlıklardır (`lib/contacts/csv.ts`). Metinde olduğu gibi kalır.

**SSS işaretleri cümlede yer tutucuyla gelir.** İşaret cümleleri `{pergunta}` ve `{resposta}` yer tutucularını taşır; çevirmen bunları olduğu gibi korur, işaretin kendisini yazmaz. Hollandaca işaretler `## Vraag:` ve `## Antwoord:` olacak; `lib/ai/rag/ingest/marcadores-de-faq.ts` dosyasına Görev 7'de eklenir.

**Durdurma kelimeleri çevrilmez.** Metin müşterinin yazacağı bir kelimeyi söylüyorsa (`responda PARAR`, `envie SAIR`, `BAJA`, `STOP`), Hollandacada **STOP** yazılır: "Vraag de klant om STOP te sturen." Sistem bu kelimeyi her dilde tanır.

Tırnak içindeki örnek adlar (`etiqueta “cliente”` gibi) çevrilir: “klant”. Bunlar kayıtlı veri değil, açıklamadaki örneklerdir.

## Onayda karar verilecekler

Bu bölüm taslak içindir; onaydan sonra silinir. Her satırda seçilen karşılık ve diğer seçenek var. Değiştirmek istediğinizi yazmanız yeterli.

| Terim | Seçilen | Diğer seçenek | Neden bu seçildi |
|---|---|---|---|
| lead | lead | prospect | Flaman satış dilinde "leads opvolgen" yaygın |
| funil | pijplijn | verkooptrechter, salesfunnel | Hollandaca CRM ekranlarında aşamalı pano için yaygın ad |
| negócio / oportunidade | verkoopkans | deal | Herkesin anlayacağı Hollandaca kelime |
| plano | plan | formule | Yazılım fiyat sayfalarında yaygın; "formule" daha çok telefon ve enerji tarifeleri için |
| caixa de entrada | inbox | postvak IN | Kısa ve WhatsApp ekranlarıyla uyumlu |
| painel | dashboard | overzicht | Yazılımda yaygın |
| caso | dossier | zaak | Belçika'da "dossier" günlük dil |
| atendimento | klantcontact | behandeling, klantenservice | Ekranda hem destek hem satış görüşmesini kapsıyor |
| follow-up | opvolgbericht | follow-upbericht | Hollandaca ve kısa |
| CPF | identificatienummer | rijksregisternummer | Ürün kişiden ulusal sicil numarası istemez (GBA'nın 204/2025 kararı) |
