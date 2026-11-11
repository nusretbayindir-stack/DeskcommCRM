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

## Sonradan onaylanan terimler

Fransızca katalog (S2a Görev 6, PR #45) çevrilirken bu sözlükte olmayan terimler. Gece görevinin listesi (belge deposu `docs/handoff/2026-11-11-fr-terimler-onaya.md`) 2026-11-11'de okuyucunun okuma sayfasında onaylandı: 5 karar, 1 not; başka satıra itiraz yok. Aşağıdaki tablolar o sayfanın kaynağından alındı (`docs/handoff/2026-11-11-fr-terimler-sayfa-kaynagi.md`). Buradaki bir terimi değiştirmek de onay ister.

### Okuyucunun kararları

- **Görüşme menüsü** (pt Atendimento) → **Conversations**. Yalnız menü adı; cümle içinde "prise en charge" kalır (yukarıdaki Terimler tablosu). Katalogdaki `Atendimento` anahtarı ajandada da kullanılıyor (bekleme listesinde hizmet alanı, Ekip sayfasında sekme), orada "Conversations" yanlış okunur. Bu yüzden katalogda şimdilik "Prise en charge" duruyor; menü için ayrı anahtar Görev 7'de açılır ve menü o zaman "Conversations" olur.
- **Sağlayıcılar menüsü** (pt Provedores) → Fournisseurs.
- **Teklifler** (pt Propostas) → Offres.
- **Rol adı müdür** (pt Gerente, Gestor, Manager) → Manager.
- **Rol adı Admin** (pt Admin) → Administrateur. Yönetim bölümü anlamında cümle içinde geçen "Admin" (ör. "Admin › E-mail") → Administration.

### Menü ve ekran adları

Cümle içinde anıldığında da aynı yazılır (ör. "IA › Fournisseurs").

| Portekizce | Türkçe | Fransızca |
|---|---|---|
| Atendimento | Görüşme | Conversations (menü adı; bkz. yukarıdaki ilk karar) |
| CRM | CRM | CRM |
| Ver tudo em CRM / IA / Análise | Tümünü gör: CRM / AI / Analiz | Tout voir dans CRM / IA / Analyse |
| IA (menu) | AI | IA |
| Agente de IA | AI asistanı | Assistant IA |
| Agentes / Agentes IA | Asistanlar / AI asistanları | Assistants / Assistants IA |
| Canais | Kanallar | Canaux |
| Análise | Analiz | Analyse |
| Organização | Şirket | Entreprise |
| Configurações | Ayarlar | Paramètres |
| Configurações do app | Uygulama ayarları | Paramètres de l'application |
| Prospecção | Müşteri adayı bulma | Prospection |
| O dia a dia da venda | Satışın günlük işleyişi | La vente au quotidien |
| Inbox | Gelen kutusu | Boîte de réception |
| Radar | Radar | Radar |
| Agenda | Takvim | Agenda |
| Lista de espera | Bekleme listesi | Liste d'attente |
| Respostas rápidas | Hazır yanıtlar | Réponses rapides |
| Funis | Satış hunileri | Pipelines |
| Etapas do funil | Satış hunisi aşamaları | Étapes du pipeline |
| Campanhas | Kampanyalar | Campagnes |
| Contatos | Kişiler | Contacts |
| Empresas | Şirketler | Entreprises |
| Pessoas | Kişiler | Personnes |
| Tarefas | Görevler | Tâches |
| Planos de tarefa | Görev planları | Plans de tâches |
| Chamadas | Aramalar | Appels |
| Cold Call | Cold Call | Cold Call |
| Produtos | Ürünler | Produits |
| Preparar a venda | Satışı hazırla | Préparer la vente |
| Importações | İçe aktarmalar | Importations |
| Propostas | Teklifler | Offres |
| Modelos de proposta | Teklif şablonları | Modèles d'offre |
| Fechar a venda | Satışı kapat | Conclure la vente |
| Tipos de agendamento | Randevu türleri | Types de rendez-vous |
| Aviso de agendamento | Randevu bildirimi | Notification de rendez-vous |
| Sua empresa | Şirketiniz | Votre entreprise |
| Comandas | Adisyonlar | Additions |
| Financeiro | Finans | Finances |
| Montar o agente | Asistanı kur | Configurer l'assistant |
| Follow-ups | Takip mesajları | Messages de relance |
| Fluxos de atendimento | Görüşme akışları | Flux de prise en charge |
| Roteadores | Yönlendiriciler | Répartiteurs |
| Credenciais | Kimlik bilgileri | Identifiants |
| Provedores | Sağlayıcılar | Fournisseurs |
| Conhecimento | Bilgi | Connaissances |
| Ensinar o agente | Asistana öğretin | Former l'assistant |
| Memória | Hafıza | Mémoire |
| Skills | Beceriler | Compétences |
| Casos | Vakalar | Dossiers |
| Acompanhar o agente | Asistanı izle | Suivre l'assistant |
| Alertas | Uyarılar | Alertes |
| Aviso no WhatsApp | WhatsApp bildirimi | Notification WhatsApp |
| Execuções | Çalıştırmalar | Exécutions |
| Uso de IA | AI kullanımı | Utilisation de l'IA |
| Uso e orçamento | Kullanım ve bütçe | Utilisation et budget |
| Orçamento | Bütçe | Budget |
| Conexões | Bağlantılar | Connexions |
| Central de Conexões | Bağlantı merkezi | Centre de connexions |
| Webhooks | Webhooks | Webhooks |
| Faturamento | Ciro | Chiffre d'affaires |
| Dinheiro | Nakit | Argent |
| Honorários | Vekâlet ücretleri | Honoraires |
| Desempenho | Performans | Performances |
| Os números do período | Dönemin rakamları | Les chiffres de la période |
| Meta de vendas | Satış hedefi | Objectif de vente |
| Meta Ads | Meta Ads | Meta Ads |
| Atividades | Etkinlikler | Activités |
| Evolução da IA | AI gelişimi | Évolution de l'IA |
| O histórico que se consulta | Sorgulanan geçmiş | L'historique à consulter |
| Audit Log | Denetim kaydı | Journal d'audit |
| Perfil | Profil | Profil |
| Sua conta | Hesabınız | Votre compte |
| Segurança | Güvenlik | Sécurité |
| Notificações | Bildirimler | Notifications |
| App no celular | Telefonda uygulama | Application sur GSM |
| Equipe | Ekip | Équipe |
| Distribuição de atendimento | Görüşme dağıtımı | Répartition des prises en charge |
| Automações | Otomasyonlar | Automatisations |
| Tags | Etiketler | Étiquettes |
| Recursos opcionais | İsteğe bağlı özellikler | Fonctions optionnelles |
| Conversões | Dönüşümler | Conversions |
| Marca | Marka | Marque |
| Plano e cobrança | Plan ve ödeme | Formule et facturation |
| Cobrança | Ödeme | Facturation |
| LGPD (menu) | GDPR | RGPD |
| Dados e acesso | Veriler ve erişim | Données et accès |
| API Tokens | API token'ları | Jetons API |
| Chaves de API | API anahtarları | Clés API |
| Trunk SIP | SIP trunk | Trunk SIP |
| Servidor MCP externo | Harici MCP sunucusu | Serveur MCP externe |
| Extensões | Eklentiler | Extensions |
| Dados externos | Harici veriler | Données externes |
| Ajuda | Yardım | Aide |
| Operação | Operasyon | Opérations |
| Clientes | Müşteriler | Clients |
| Plataforma | Platform | Plateforme |
| Dashboard / Painel | Panel | Tableau de bord |
| Incidents | Olaylar | Incidents |
| Audit | Denetim | Audit |
| Tenants | Şirketler | Entreprises |
| Users | Kullanıcılar | Utilisateurs |
| Platform Admins | Platform Yöneticileri | Administrateurs de la plateforme |
| Usage | Kullanım | Utilisation |
| Google Agenda | Google Takvim | Google Agenda |
| API Oficial (Meta) | Resmî API (Meta) | API officielle (Meta) |
| E-mail | E-posta | E-mail |
| Destinos internos | İç hedefler | Destinations internes |
| Cadastro (admin menu, sign-up settings) | Kayıt | Inscription |
| Módulos | Modüller | Modules |
| Proteção de envio | Gönderim koruması | Protection des envois |
| Comportamento | Davranış | Comportement |
| Básico | Temel | Base |
| Biblioteca | Kütüphane | Bibliothèque |
| Grupos | Gruplar | Groupes |
| Central / Central de avisos | Bildirim merkezi | Centre de notifications |

### Çeviri sırasında sabitlenen terimler

| Portekizce | Türkçe | Fransızca |
|---|---|---|
| titular (dos dados) | veri sahibi (kişisel verisi işlenen kişi) | personne concernée |
| encarregado (da proteção de dados) | veri koruma görevlisi | délégué à la protection des données (DPO) |
| provedor | sağlayıcı («AI sağlayıcıları» → «Fournisseurs d'IA») | fournisseur |
| ficha (do cliente) | müşteri kartı | fiche |
| captação (formulário) | müşteri adayı formu | formulaire de prospects |
| chamada (de voz) | arama; sesli arama | appel; appel vocal |
| recibo | makbuz | reçu |
| carência | ek süre (ödeme gecikince tanınan) | délai de grâce |
| agendamento de envio / disparo agendado | zamanlanmış gönderim | envoi programmé |
| avisar | haber vermek | prévenir |
| reserva | rezervasyon | réservation |
| reserva (cópia) | yedek (veri yedeği) | sauvegarde |
| pós-venda | satış sonrası | après-vente |
| rascunho / publicada | taslak / yayında | brouillon / publiée |
| superado | yerine yenisi gelmiş (sürüm durumu) | remplacée |
| cifrar / cifra | şifrelemek / şifreleme | chiffrer / chiffrement |
| caixa / aresta | kutu / bağlantı çizgisi (otomasyon tasarımcısında) | bloc / liaison |
| nó | düğüm (akış şemasında) | nœud |
| molde | örnek şirket (kopyalanarak kullanılan) | exemple |
| 1ª, 2º | 1., 2. | 1re, 2e |
| aquecimento | numara ısındırma (yeni numarada gönderimi yavaş yavaş artırma) | montée en charge |
| credencial | kimlik bilgisi | identifiant |
| cobrança | ödeme talebi (tek bir tahsilat) | demande de paiement |
| setor | departman | service |
| ponto (endpoint) | nokta (bağlantı adresi) | point |

### Birleştirilen terimler

Farklı çevirmenlerin farklı yazdığı, düzeltme turunda bütün katalogda eşitlenen terimler. Parantezdeki sayı, değişen cümle sayısı.

- **Müdür / yönetici rolü** (pt gerente, gestor) → manager; «gestionnaire» ve «responsable» yazılan yerler eşitlendi (14). Rol adı da Manager (yukarıdaki kararlar).
- **Görüşme akışı ve senaryo** (pt roteiro): «Görüşme akışları» modülünde → flux (21); soğuk aramada → Script (3).
- **Hazır veri sorgusu** (pt receita) → requête prédéfinie (7). Bir cümlenin anlamı tamamen yanlıştı, düzeldi.
- **Toplu yayın** (pt broadcast; hızlı gönderimin yanındaki mod) → diffusion (6). «Toplu gönderim» (pt disparo) → envoi groupé olarak kaldı.
- **Geri dönüş, geri arama** (pt retorno; asistanın planladığı) → rappel (11). Vadesi geçmiş ödeme akışı «flux de relance»; girişten sonra dönülen adres «adresse de redirection» kaldı.
- **Materyal** (pt material) → tek bir belge için document, genel içerik için contenu (8).
- **Kimliğine bürünme** (pt impersonate; platform yöneticisi bir şirketin ekranını o şirketin gözüyle açar, yalnız platform yöneticisi görür) → suivi, düğmede « Suivre l'entreprise » (12).
- **Telefon rehberi** (pt agenda do celular) → répertoire (du GSM) (3).
- **Kurulumdaki AI çalışanı** (pt seu funcionário) → votre employé IA (13). Yalın «employé» insan gibi okunuyordu.
- **Operatör** (pt operador; sunucuyu işleten) → opérateur (1). Kişisel veri işleme anlamındaki «operador» → sous-traitant kaldı.
- **Asistanın görüşme aşaması** (pt passo do atendimento) → phase (6). Akış ve takip adımları «étape» kaldı.
- **Engellemek / engeller** (pt vetar, vetos) → bloquer / blocages (1).
- **Devral** düğmesi (pt Assumir; görüşmeyi asistandan alır) → Prendre la main (1).
- **Kutu ve bağlantı** (pt caixa, ligação; otomasyon tasarımcısında) → bloc, liaison (1). Mesaj yazma kutusu (pt caixa de mensagem) → zone de saisie (1).
- **Yolculuk** (pt jornada; araç seçicide) → parcours (1); yayımlanmış çalışma düzeni → horaire de travail (1).
- **Yeni kaynak** (pt Novo recurso; hazır yanıt ekranında) → Nouvelle réponse rapide; gelişim ekranında «her kaynak» → outil (2).
- **Abonelikten çıkma** (pt descadastro) → désabonnement (1).
- **İlk kurulum** (pt onboarding) → configuration initiale (2).
- **Gün adları** tek biçimde: Lun Mar Mer Jeu Ven Sam Dim ve Lundi … Dimanche (4). Düğme ve etiket oldukları için büyük harfle başlıyor; cümle içinde küçük harf kuralı geçerli.
- **AI token'ı** (pt LLM token; kullanım ölçüsü) → tokens (3). API anahtarı anlamındaki «jeton» kaldı.
- **Otomatiğe geri ver** düğmesi (pt Devolver ao automático; görüşmeyi yeniden asistana bırakır) → « Remettre en automatique » ve onu anan 4 cümle.
