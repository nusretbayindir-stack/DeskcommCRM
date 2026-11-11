# Hollandaca terim sözlüğü ve üslup kuralları

Bu dosya, `lib/i18n/traducoes/nl.json` kataloğunu çevirenlerin tek başvuru kaynağıdır. Kataloğun anahtarı Portekizce ekran metnidir. Değeri o metnin Hollandacasıdır: Belçika'da, Flaman kullanımıyla. Çeviri bağlamı için her anahtarın İspanyolcası, İngilizcesi ve Türkçesi de verilir. Türkçe metin Belçika'ya göre düzeltildiği için Portekizce metin Brezilya'ya özgü bir şey söylüyorsa Türkçesi esas alınır.

**Durum: onaylandı** (2026-11-08, ürün sahibi). Hollandaca katalog bu sözlükle çevrilir. Bir terimi ya da kuralı değiştirmek de ürün sahibinin onayını ister.

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

WhatsApp, Instagram, Meta, API, CSV, PIX, Stripe, Asaas, OpenAI, Anthropic, Claude, Supabase, Google, Gmail, GDPR, SMTP, JSON, PDF, URL, Webhook, Cold Call

Ürün adı (marka) da çevrilmez. "Cold Call" ekran ve huni adıdır, İngilizce kalır (kullanıcının kararı, 2026-11-09; Türkçe sözlükle aynı).

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

## Sonradan onaylanan terimler

Hollandaca katalog (S2a Görev 6, PR #44) çevrilirken bu sözlükte olmayan terimler. Liste (belge deposu `docs/handoff/2026-11-10-nl-terimler-onaya.md`) 2026-11-11'de ürün sahibinin okuma sayfasında onaylandı: 4 karar, not yok. Aşağıdaki tablolar o sayfanın kaynağından alındı (`docs/handoff/2026-11-11-nl-terimler-sayfa-kaynagi.md`). Buradaki bir terimi değiştirmek de onay ister.

### Ürün sahibinin kararları

- **Görüşme menüsü** (pt Atendimento) → Klantcontact (sözlükteki karşılık; Fransızcada menü "Conversations").
- **Rol adı müdür** (pt Gerente, Gestor, Manager) → Manager.
- **Meta şablon kategorisi UTILITY** (pt Utilidade) → **Hulpprogramma**, Meta'nın Hollandaca adı. "Service" yazılmaz: Meta'da "Service" ayrı bir kategori (müşterinin başlattığı konuşmalar).
- **Meta şablon kategorisi AUTHENTICATION** (pt Autenticação) → **Verificatie**, Meta'nın Hollandaca adı. Yalnız Meta kategorisi için. Bağlantı ya da sunucu kimlik doğrulaması "authenticatie" kalır. Katalogdaki tek başına `Autenticação` anahtarı asistanın MCP sunucusu ayarında da kullanıldığı için şimdilik "Authenticatie"; kategori için ayrı anahtar Görev 7'de açılır ve kampanya ekranındaki kategori adı o zaman "Verificatie" olur.

### Menü ve ekran adları

Cümle içinde anıldığında da aynı yazılır (ör. "AI › Aanbieders").

| Portekizce | Türkçe | Hollandaca |
|---|---|---|
| Atendimento | Görüşme | Klantcontact |
| CRM | CRM | CRM |
| Ver tudo em CRM / IA / Análise | Tümünü gör: CRM / AI / Analiz | Alles bekijken in CRM / AI / Analyse |
| IA (menu) | AI | AI |
| Agente de IA | AI asistanı | AI-assistent |
| Agentes / Agentes IA | Asistanlar / AI asistanları | Assistenten / AI-assistenten |
| Canais | Kanallar | Kanalen |
| Análise | Analiz | Analyse |
| Organização | Şirket | Bedrijf |
| Configurações | Ayarlar | Instellingen |
| Configurações do app | Uygulama ayarları | App-instellingen |
| Admin / Administração | Admin / Yönetim (yönetim bölümü) | Beheer |
| Prospecção | Müşteri adayı bulma | Prospectie |
| O dia a dia da venda | Satışın günlük işleyişi | De dagelijkse verkoop |
| Inbox | Gelen kutusu | Inbox |
| Radar | Radar | Radar |
| Agenda | Takvim | Agenda |
| Lista de espera | Bekleme listesi | Wachtlijst |
| Respostas rápidas | Hazır yanıtlar | Snelle antwoorden |
| Funis | Satış hunileri | Pijplijnen |
| Etapas do funil | Satış hunisi aşamaları | Fasen van de pijplijn |
| Campanhas | Kampanyalar | Campagnes |
| Contatos | Kişiler | Contacten |
| Empresas | Şirketler | Bedrijven |
| Pessoas | Kişiler | Personen |
| Tarefas | Görevler | Taken |
| Planos de tarefa | Görev planları | Takenplannen |
| Chamadas | Aramalar | Oproepen |
| Cold Call | Cold Call | Cold Call |
| Produtos | Ürünler | Producten |
| Preparar a venda | Satışı hazırla | De verkoop voorbereiden |
| Importações | İçe aktarmalar | Importen |
| Propostas | Teklifler | Offertes |
| Modelos de proposta | Teklif şablonları | Offertesjablonen |
| Fechar a venda | Satışı kapat | De verkoop afsluiten |
| Tipos de agendamento | Randevu türleri | Afspraaktypes |
| Aviso de agendamento | Randevu bildirimi | Afspraakmelding |
| Sua empresa | Şirketiniz | Uw bedrijf |
| Comandas | Adisyonlar | Rekeningen |
| Financeiro | Finans | Financiën |
| Montar o agente | Asistanı kur | De assistent opbouwen |
| Follow-ups | Takip mesajları | Opvolgberichten |
| Fluxos de atendimento | Görüşme akışları | Klantcontactflows |
| Roteadores | Yönlendiriciler | Verdelers |
| Credenciais | Kimlik bilgileri | Toegangsgegevens |
| Provedores | Sağlayıcılar | Aanbieders |
| Conhecimento | Bilgi | Kennis |
| Ensinar o agente | Asistana öğretin | De assistent trainen |
| Memória | Hafıza | Geheugen |
| Skills | Beceriler | Vaardigheden |
| Casos | Vakalar | Dossiers |
| Acompanhar o agente | Asistanı izle | De assistent opvolgen |
| Alertas | Uyarılar | Waarschuwingen |
| Aviso no WhatsApp | WhatsApp bildirimi | Melding via WhatsApp |
| Execuções | Çalıştırmalar | Uitvoeringen |
| Uso de IA | AI kullanımı | AI-gebruik |
| Uso e orçamento | Kullanım ve bütçe | Gebruik en budget |
| Orçamento | Bütçe | Budget |
| Conexões | Bağlantılar | Verbindingen |
| Central de Conexões | Bağlantı merkezi | Verbindingscentrum |
| Webhooks | Webhooks | Webhooks |
| Faturamento | Ciro | Omzet |
| Dinheiro | Nakit | Geld |
| Honorários | Vekâlet ücretleri | Erelonen |
| Desempenho | Performans | Prestaties |
| Os números do período | Dönemin rakamları | De cijfers van de periode |
| Meta de vendas | Satış hedefi | Verkoopdoel |
| Meta Ads | Meta Ads | Meta Ads |
| Atividades | Etkinlikler | Activiteiten |
| Evolução da IA | AI gelişimi | Evolutie van de AI |
| O histórico que se consulta | Sorgulanan geçmiş | De geschiedenis om te raadplegen |
| Audit Log | Denetim kaydı | Auditlog |
| Perfil | Profil | Profiel |
| Sua conta | Hesabınız | Uw account |
| Segurança | Güvenlik | Beveiliging |
| Notificações | Bildirimler | Meldingen |
| App no celular | Telefonda uygulama | App op de gsm |
| Equipe | Ekip | Team |
| Distribuição de atendimento | Görüşme dağıtımı | Verdeling van klantcontacten |
| Automações | Otomasyonlar | Automatiseringen |
| Tags | Etiketler | Labels |
| Recursos opcionais | İsteğe bağlı özellikler | Optionele functies |
| Conversões | Dönüşümler | Conversies |
| Marca | Marka | Merk |
| Plano e cobrança | Plan ve ödeme | Plan en facturatie |
| Cobrança | Ödeme | Facturatie |
| LGPD (menu) | GDPR | GDPR |
| Dados e acesso | Veriler ve erişim | Gegevens en toegang |
| API Tokens | API token'ları | API-tokens |
| Chaves de API | API anahtarları | API-sleutels |
| Trunk SIP | SIP trunk | SIP-trunk |
| Servidor MCP externo | Harici MCP sunucusu | Externe MCP-server |
| Extensões | Eklentiler | Extensies |
| Dados externos | Harici veriler | Externe gegevens |
| Ajuda | Yardım | Help |
| Operação | Operasyon | Operaties |
| Clientes | Müşteriler | Klanten |
| Plataforma | Platform | Platform |
| Dashboard / Painel | Panel | Dashboard |
| Incidents | Olaylar | Incidenten |
| Audit | Denetim | Audit |
| Tenants | Şirketler | Bedrijven |
| Users | Kullanıcılar | Gebruikers |
| Platform Admins | Platform Yöneticileri | Platformbeheerders |
| Usage | Kullanım | Gebruik |
| Google Agenda | Google Takvim | Google Agenda |
| API Oficial (Meta) | Resmî API (Meta) | Officiële API (Meta) |
| E-mail | E-posta | E-mail |
| Destinos internos | İç hedefler | Interne bestemmingen |
| Cadastro (admin menu, sign-up settings) | Kayıt | Registratie |
| Módulos | Modüller | Modules |
| Proteção de envio | Gönderim koruması | Verzendbescherming |
| Comportamento | Davranış | Gedrag |
| Básico | Temel | Basis |
| Biblioteca | Kütüphane | Bibliotheek |
| Grupos | Gruplar | Groepen |

### Çeviri sırasında seçilen terimler

| Portekizce | Türkçe | Hollandaca |
|---|---|---|
| titular (dos dados) | veri sahibi (kişisel verisi işlenen kişi) | betrokkene |
| encarregado (da proteção de dados) | veri koruma görevlisi | functionaris voor gegevensbescherming |
| provedor | sağlayıcı; «AI sağlayıcıları» | aanbieder; AI-aanbieders |
| ficha (do cliente) | müşteri kartı | fiche |
| captação (formulário) | müşteri adayı formu | leadformulier |
| chamada (de voz) | arama; sesli arama | oproep; spraakoproep |
| recibo | makbuz | ontvangstbewijs |
| carência | ek süre (ödeme gecikince tanınan) | respijtperiode |
| agendamento de envio / disparo agendado | zamanlanmış gönderim | geplande verzending |
| avisar | haber vermek | verwittigen |
| reserva | rezervasyon | reservatie |
| reserva (cópia) | yedek (veri yedeği) | back-up |
| pós-venda | satış sonrası | nazorg |
| rascunho / publicada | taslak / yayında | concept / gepubliceerd |
| superado | yerine yenisi gelmiş (sürüm durumu) | vervangen |
| cifrar / cifra | şifrelemek / şifreleme | versleutelen / versleuteling |
| caixa / aresta | kutu / bağlantı çizgisi (otomasyon tasarımcısında) | vak / verbinding |
| nó | düğüm (akış şemasında) | knooppunt |
| molde | örnek şirket (kopyalanarak kullanılan) | voorbeeld |
| 1ª, 2º | 1., 2. | 1e, 2e |

### Birleştirilen terimler

Farklı çevirmenlerin farklı yazdığı, düzeltme turunda bütün katalogda eşitlenen terimler. Parantezdeki sayı, değişen cümle sayısı.

- **Araç** (pt ferramenta; asistanın kullandığı) → tool; «hulpmiddel(en)» yazılan yerler eşitlendi (7).
- **Vaka** (pt demanda; menüde «Vakalar» = Dossiers) → dossier; «aanvraag» eşitlendi (9). «İstek üzerine» (pt sob demanda) → op aanvraag kaldı.
- **Hazır veri sorgusu** (pt receita) → standaardquery / standaardquery's; «vaste query», «recept» gibi yazımlar eşitlendi (11).
- **Tablo dosyası** (pt planilha) → spreadsheet; «rekenblad», «werkblad» eşitlendi (3).
- **Müdür rolü** (pt gestor; görüşme devretme penceresinde) → Manager; «Leidinggevende» eşitlendi (1). Rol adı da Manager (yukarıdaki kararlar).
- **Her zamanki AI** (pt IA de sempre) → gebruikelijke AI; «gewone AI» eşitlendi (17).
- **Kurulum ücreti** (pt implantação; ilk kurulumda alınan ücret) → opstartkosten; «installatiekosten» eşitlendi, çünkü bu üründe «installatie» sunucu kurulumu demek (3).
- **Deneme çalıştırması** (pt ensaio) → testrun; «proef», «proefrun» eşitlendi (3).
- **Öğrenilen ders** (pt aprendizado; asistanın çıkardığı) → leerpunt; «inzichten», «het geleerde» eşitlendi (5).
- **Telefon rehberi** (pt agenda do celular) → adresboek van de gsm; «telefoonboek», «contactenlijst» eşitlendi (3).
- **Alan kodu** (pt DDD) → netnummer; «zonenummer» eşitlendi (2).
- **Hesap planı** (pt plano de contas; muhasebe) → rekeningschema (1).
- **Toplu yayın** (pt broadcast; hızlı gönderimin yanındaki mod) → broadcast; «massaverzending» eşitlendi (7). «Toplu gönderim» (pt disparo) → massaverzending olarak kaldı.
- **Operatör** (pt operador; sunucuyu işleten) → operator; «exploitant», «beheerder» eşitlendi (6). Kişisel veri işleme anlamındaki operatör → verwerker (sözlük).
- **Uzman** (pt profissional; randevu veren kişi) → professional; «medewerker», «specialist» eşitlendi (4).
- **Gizli anahtar** (pt segredo; webhook imzası için) → geheim / handtekeninggeheim (18).
- **Gelmeme** (pt falta; randevuya gelmeyen müşteri) → no-show; durum etiketi «Gelmedi» (pt Faltou / Não compareceu) → «Niet opgedaagd» (16).
- **Admin rolü** (pt Admin; kullanıcı listesi, görüşme devretme) → Beheerder; «Beheer» eşitlendi (1). Menüdeki «Beheer» (yönetim bölümü) bu anahtar değil.
- **Gün kısaltmaları** tek biçimde: Ma Di Wo Do Vr Za Zo; «ma», «Woe», «Don» eşitlendi (3).
- **Kayıt** (pt enrollment; bir akışa ya da programa kaydolma) → inschrijving (3).
- **Geri dönüş** (pt retorno; asistanın planladığı geri arama) → opvolgmoment; «terugkoppeling», «opvolging» gibi yazımlar eşitlendi (28). İstisnalar: Meta reklam geri bildirimi «terugkoppeling», girişten sonra dönülen adres «terugkeeradres», «fluxo de retorno» «terugkeerflow», gönderilmiş ve sıradaki mesajlar «opvolgbericht» kaldı.
- **Görüşme akışı** (pt roteiro de atendimento; «Görüşme akışları» modülü, menüde «Klantcontactflows») → (klantcontact)flow; «scenario», «script» gibi yazımlar eşitlendi (22). Soğuk aramadaki senaryo → Script; genel senaryolar «script», beceriler «draaiboeken» kaldı.
