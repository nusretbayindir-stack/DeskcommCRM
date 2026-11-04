/**
 * A política de privacidade em holandês e francês, para o visitante belga sem sessão.
 *
 * O cliente da empresa cliente abre /legal/privacy sem conta. O produto não tem
 * essas duas línguas, e o texto saía em português: ele não conseguia ler.
 *
 * Holandês e francês não são idiomas do produto (`lib/i18n/registro.ts`): adicioná-los
 * lá cobraria o catálogo inteiro. Aqui é só esta página, por isso o texto mora neste
 * arquivo e não no dicionário. A chave é a frase em português da página, e
 * `tests/unit/politica-belga-em-holandes-e-frances.test.tsx` reprova frase nova da
 * página que não esteja aqui. Quando houver site próprio, este arquivo sai inteiro
 * e a página redireciona para lá.
 *
 * O vocabulário é o do contrato de serviço (Bijlage 2 e 3 / annexes 2 et 3):
 * verwerkingsverantwoordelijke, verwerker, leverancier; responsable du traitement,
 * sous-traitant, prestataire. Tradução revista por IA; não é parecer de advogado.
 *
 * A única diferença de conteúdo para o texto de origem está nos direitos: a frase
 * belga cita também limitação, portabilidade e oposição, como a Bijlage 3.
 */
import { headers } from "next/headers";

import { parseAcceptLanguage } from "@/lib/i18n/idiomas";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";

export type IdiomaBelga = "nl" | "fr";
export type EscolhaDeIdioma = IdiomaBelga | "tr";

/** Os links no topo da página. Cada nome está na própria língua, para quem procura a sua. */
export const IDIOMAS_DA_POLITICA_BELGA: readonly { codigo: EscolhaDeIdioma; nome: string }[] = [
  { codigo: "nl", nome: "Nederlands" },
  { codigo: "fr", nome: "Français" },
  { codigo: "tr", nome: "Türkçe" },
];

export const VOLTAR_NA_POLITICA_BELGA: Record<IdiomaBelga, string> = { nl: "Terug", fr: "Retour" };

/** O perfil do país traz o nome holandês da autoridade; a página em francês usa este. */
export const AUTORIDADE_EM_FRANCES = {
  nome: "Autorité de protection des données (APD)",
  site: "https://www.autoriteprotectiondonnees.be",
};

export const POLITICA_BELGA: Record<IdiomaBelga, Record<string, string>> = {
  nl: {
    "Política de Privacidade": "Privacyverklaring",
    "Como este serviço trata dados pessoais.": "Hoe deze dienst persoonsgegevens verwerkt.",
    "1. Quem é o responsável pelo tratamento": "1. Wie is de verwerkingsverantwoordelijke",
    "Nos dados tratados nas conversas de uma empresa com os clientes dela (contatos, mensagens, arquivos, agendamentos), o responsável pelo tratamento é essa empresa:":
      "Voor de gegevens die worden verwerkt in de gesprekken van een onderneming met haar klanten (contacten, berichten, bestanden, afspraken) is die onderneming de verwerkingsverantwoordelijke:",
    "a empresa que fala com você": "de onderneming die met u communiceert",
    "Número da empresa (KBO/BCE)": "ondernemingsnummer",
    "O prestador de serviço trata esses dados em nome dela, como subcontratante.":
      "De leverancier van de dienst verwerkt die gegevens namens haar, als verwerker.",
    "Nos dados da conta da empresa, dos contatos dela e de quem usa o sistema, o responsável pelo tratamento é o prestador de serviço indicado no contrato de serviço assinado com a empresa.":
      "Voor de accountgegevens van de onderneming, van haar contactpersonen en van de gebruikers van het systeem is de verwerkingsverantwoordelijke de leverancier die vermeld staat in de dienstverleningsovereenkomst die met de onderneming is ondertekend.",
    "Os autores do software de código aberto não operam o serviço e não têm acesso ao servidor nem aos dados.":
      "De auteurs van de open-sourcesoftware exploiteren de dienst niet en hebben geen toegang tot de server of de gegevens.",
    "2. Que dados são tratados": "2. Welke gegevens worden verwerkt",
    "De quem é atendido:": "Van personen die worden geholpen:",
    "nome, telefone, e-mail quando informado, conteúdo das conversas, arquivos enviados (imagens, áudios, documentos) e o histórico de negócios.":
      "naam, telefoonnummer, e-mailadres indien opgegeven, inhoud van de gesprekken, verzonden bestanden (afbeeldingen, spraakberichten, documenten) en de historiek van de verkooptrajecten.",
    "De quem usa o sistema:": "Van gebruikers van het systeem:",
    "nome, e-mail, papel de acesso e registro das ações realizadas.":
      "naam, e-mailadres, toegangsrol en logboek van de uitgevoerde acties.",
    "3. Para que são usados": "3. Waarvoor ze worden gebruikt",
    "Para atender, responder, registrar o andamento do atendimento e organizar a relação comercial — inclusive por agentes de inteligência artificial que atuam sob as regras definidas pela empresa. Registros de ação são mantidos para auditoria e segurança.":
      "Om klanten te helpen, te antwoorden, het verloop van de klantenservice vast te leggen en de commerciële relatie te organiseren, ook door AI-agenten die werken volgens de regels die de onderneming heeft bepaald. Logboeken van acties worden bewaard voor audit en beveiliging.",
    "4. Com quem são compartilhados": "4. Met wie ze worden gedeeld",
    "Os dados ficam nos servidores do serviço. Para funcionar, o prestador de serviço usa os fornecedores abaixo; a lista atualizada está no Anexo 2 do contrato de serviço:":
      "De gegevens staan op de servers van de dienst. Om de dienst te laten werken, doet de leverancier een beroep op de onderstaande dienstverleners; de actuele lijst staat in Bijlage 2 van de dienstverleningsovereenkomst:",
    "a plataforma de mensagens usada para conversar com o cliente;":
      "het berichtenplatform waarmee met de klant wordt gecommuniceerd;",
    "o provedor de inteligência artificial usado pelo serviço, que recebe o trecho da conversa necessário para gerar a resposta ou avaliar a conversa;":
      "de AI-aanbieder waarop de dienst een beroep doet en die het deel van het gesprek ontvangt dat nodig is om het antwoord op te stellen of het gesprek te beoordelen;",
    "quando o Jev é ligado (desligado por padrão), a TypeSafe AI, nos Estados Unidos, que recebe cada mensagem do cliente, sozinha e já sem CPF, telefone e e-mail, para avaliar se ele está irritado, se a mensagem tenta manipular o atendimento automático, a qual área da empresa ela se destina, se ela pede para falar com uma pessoa ou para parar de receber mensagens e, quando ela responde a um follow-up, em qual das saídas do fluxo ela se encaixa;":
      "wanneer Jev is ingeschakeld (standaard uitgeschakeld), TypeSafe AI in de Verenigde Staten, dat elk bericht van de klant afzonderlijk ontvangt, waaruit rijksregisternummer, telefoonnummer en e-mailadres vooraf zijn verwijderd, om te beoordelen of de klant geïrriteerd is, of het bericht de automatische klantenservice probeert te manipuleren, voor welke afdeling van de onderneming het bedoeld is, of het vraagt om met een persoon te spreken of om geen berichten meer te ontvangen en, wanneer het een opvolgbericht beantwoordt, bij welke uitkomst van de flow het past;",
    "quando uma chave de Mapas é cadastrada (desligado por padrão), o Google, que recebe as coordenadas da localização que o cliente compartilhou, para devolver a rua e a cidade aproximadas;":
      "wanneer een Maps-sleutel is ingesteld (standaard uitgeschakeld), Google, dat de coördinaten ontvangt van de locatie die de klant heeft gedeeld, om de straat en de stad bij benadering terug te geven;",
    "o provedor de infraestrutura onde o servidor está hospedado.":
      "de infrastructuuraanbieder waar de server wordt gehost.",
    "Os dados não são vendidos nem cedidos para publicidade de terceiros.":
      "De gegevens worden niet verkocht en niet afgestaan voor reclame van derden.",
    "5. Por quanto tempo": "5. Hoe lang",
    "Conversas e registros de negócio são mantidos enquanto houver relação com o cliente ou obrigação legal de guarda. Arquivos de mídia têm prazo próprio, configurado pela empresa. Registros de auditoria são mantidos por período mais longo, por serem prova de quem fez o quê. Ao fim do contrato de serviço, a empresa pode exportar os dados por 30 dias; depois disso, eles são apagados, salvo se a lei exigir guarda mais longa.":
      "Gesprekken en gegevens over verkooptrajecten worden bewaard zolang er een relatie met de klant bestaat of een wettelijke bewaarplicht geldt. Mediabestanden hebben een eigen termijn, die de onderneming instelt. Auditlogboeken worden langer bewaard, omdat ze bewijzen wie wat heeft gedaan. Na het einde van de dienstverleningsovereenkomst kan de onderneming de gegevens gedurende 30 dagen exporteren; daarna worden ze gewist, tenzij de wet een langere bewaring vereist.",
    "6. Seus direitos": "6. Uw rechten",
    "O RGPD garante-lhe confirmar se há tratamento, aceder aos seus dados, corrigir dados incompletos ou desatualizados, pedir anonimização ou eliminação, saber com quem foram partilhados e retirar o consentimento.":
      "De AVG geeft u het recht om te weten of uw gegevens worden verwerkt, ze in te zien, onvolledige of verouderde gegevens te laten verbeteren, anonimisering of wissing te vragen, de verwerking te laten beperken, uw recht op overdraagbaarheid uit te oefenen, bezwaar te maken tegen een verwerking op grond van gerechtvaardigd belang, te weten met wie ze zijn gedeeld en uw toestemming in te trekken.",
    "Envie o seu pedido à empresa que trata os seus dados; o prestador de serviço a ajuda a atendê-lo. Para os dados da sua conta, você pode escrever diretamente ao prestador de serviço.":
      "Stuur uw verzoek naar de onderneming die uw gegevens verwerkt; de leverancier helpt haar om het te beantwoorden. Voor de gegevens van uw account kunt u rechtstreeks aan de leverancier schrijven.",
    "Você também pode apresentar reclamação à autoridade de proteção de dados: {autoridade} ({site}).":
      "U kunt ook een klacht indienen bij de toezichthoudende autoriteit: {autoridade} ({site}).",
    "7. Segurança": "7. Beveiliging",
    "O acesso é controlado por conta, senha e papel. A verificação em duas etapas é opcional para todos e só pode ser exigida de quem administra. Cada organização hospedada só enxerga os próprios dados, e as chaves de integração são guardadas cifradas.":
      "De toegang wordt gecontroleerd via account, wachtwoord en rol. Verificatie in twee stappen is voor iedereen optioneel en kan alleen voor beheerders verplicht worden gesteld. Elke gehoste organisatie ziet alleen haar eigen gegevens, en de integratiesleutels worden versleuteld bewaard.",
    "8. Encarregado da proteção de dados e contato": "8. Functionaris voor gegevensbescherming en contact",
    "Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o encarregado da proteção de dados:":
      "Om uw rechten uit te oefenen of voor vragen over privacy kunt u terecht bij de functionaris voor gegevensbescherming:",
    "A empresa ainda não publicou um endereço de contato do encarregado da proteção de dados. Os pedidos devem ser feitos pelos canais de atendimento dela.":
      "De onderneming heeft nog geen contactadres van een functionaris voor gegevensbescherming gepubliceerd. Verzoeken verlopen via haar klantenservicekanalen.",
    "Para os dados da sua conta, fale com o prestador de serviço pelo e-mail indicado no contrato de serviço.":
      "Voor de gegevens van uw account kunt u de leverancier bereiken via het e-mailadres dat in de dienstverleningsovereenkomst staat.",
    "9. Dados do Google (Agenda, Meet e Google Ads)": "9. Google-gegevens (Agenda, Meet en Google Ads)",
    "Quando uma pessoa autorizada da organização conecta uma conta Google a este sistema, os dados recebidos do Google são usados somente para a função que ela pediu:":
      "Wanneer een bevoegde persoon van de organisatie een Google-account aan dit systeem koppelt, worden de van Google ontvangen gegevens alleen gebruikt voor de functie die die persoon heeft gevraagd:",
    "Google Agenda:": "Google Agenda:",
    "mostrar a ocupação da agenda, criar, alterar e cancelar os agendamentos feitos pelo próprio usuário e evitar choque de horários. O sistema guarda no servidor do serviço o título e o horário dos eventos para calcular a ocupação, e o cálculo de horários livres usa apenas o início, o fim e a situação deles. O sistema não lê e-mails.":
      "de bezetting van de agenda tonen, afspraken van de gebruiker zelf aanmaken, wijzigen en annuleren, en overlappingen vermijden. Het systeem bewaart de titel en het tijdstip van de afspraken op de server van de dienst om de bezetting te berekenen, en de berekening van vrije tijdstippen gebruikt alleen hun begin, einde en status. Het systeem leest geen e-mails.",
    "Google Meet:": "Google Meet:",
    "criar espaços de reunião do Google Meet quando a organização liga o Meet com acesso aberto; só o link gerado é devolvido pelo Google e guardado no servidor do serviço para o convite.":
      "Google Meet-vergaderruimtes aanmaken wanneer de organisatie Meet met open toegang inschakelt; alleen de aangemaakte link wordt door Google teruggegeven en op de server van de dienst bewaard voor de uitnodiging.",
    "Google Ads:": "Google Ads:",
    "enviar ao Google Ads as vendas que um anúncio trouxe, para que ele aprenda com elas, criar e listar ações de conversão e ler as métricas das campanhas da própria conta de anúncios.":
      "de verkopen die een advertentie heeft opgeleverd naar Google Ads sturen, zodat het ervan kan leren, conversieacties aanmaken en weergeven, en de statistieken lezen van de campagnes van het eigen advertentieaccount.",
    "Os dados do Google ficam no servidor do serviço, não são vendidos, não são usados para publicidade e não são usados para treinar modelos de inteligência artificial. O uso e a transferência das informações recebidas das APIs do Google seguem a Política de Dados de Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.":
      "De Google-gegevens staan op de server van de dienst, worden niet verkocht, niet gebruikt voor reclame en niet gebruikt om AI-modellen te trainen. Het gebruik en de overdracht van informatie die van Google-API's wordt ontvangen, volgen de Google API Services User Data Policy, inclusief de vereisten voor beperkt gebruik (Limited Use).",
    "A conexão com a Agenda pode ser desfeita a qualquer momento em Agenda → Desconectar, e a do Google Ads é retirada pelo prestador de serviço, a pedido. Em qualquer caso, a pessoa também pode revogar o acesso diretamente em":
      "De koppeling met de agenda kan op elk moment worden verbroken in het menu Agenda; die met Google Ads wordt op verzoek door de leverancier verwijderd. In elk geval kan de persoon de toegang ook rechtstreeks intrekken op",
  },
  fr: {
    "Política de Privacidade": "Déclaration de confidentialité",
    "Como este serviço trata dados pessoais.": "Comment ce service traite les données à caractère personnel.",
    "1. Quem é o responsável pelo tratamento": "1. Qui est le responsable du traitement",
    "Nos dados tratados nas conversas de uma empresa com os clientes dela (contatos, mensagens, arquivos, agendamentos), o responsável pelo tratamento é essa empresa:":
      "Pour les données traitées dans les conversations d'une entreprise avec ses clients (contacts, messages, fichiers, rendez-vous), le responsable du traitement est cette entreprise :",
    "a empresa que fala com você": "l'entreprise qui échange avec vous",
    "Número da empresa (KBO/BCE)": "numéro d'entreprise",
    "O prestador de serviço trata esses dados em nome dela, como subcontratante.":
      "Le prestataire du service traite ces données pour son compte, en tant que sous-traitant.",
    "Nos dados da conta da empresa, dos contatos dela e de quem usa o sistema, o responsável pelo tratamento é o prestador de serviço indicado no contrato de serviço assinado com a empresa.":
      "Pour les données de compte de l'entreprise, de ses personnes de contact et des utilisateurs du système, le responsable du traitement est le prestataire indiqué dans le contrat de prestation de services signé avec l'entreprise.",
    "Os autores do software de código aberto não operam o serviço e não têm acesso ao servidor nem aos dados.":
      "Les auteurs du logiciel libre n'exploitent pas le service et n'ont accès ni au serveur ni aux données.",
    "2. Que dados são tratados": "2. Quelles données sont traitées",
    "De quem é atendido:": "Des personnes prises en charge :",
    "nome, telefone, e-mail quando informado, conteúdo das conversas, arquivos enviados (imagens, áudios, documentos) e o histórico de negócios.":
      "nom, numéro de téléphone, adresse e-mail si elle est communiquée, contenu des conversations, fichiers envoyés (images, messages vocaux, documents) et historique des parcours de vente.",
    "De quem usa o sistema:": "Des utilisateurs du système :",
    "nome, e-mail, papel de acesso e registro das ações realizadas.":
      "nom, adresse e-mail, rôle d'accès et journal des actions effectuées.",
    "3. Para que são usados": "3. À quoi elles servent",
    "Para atender, responder, registrar o andamento do atendimento e organizar a relação comercial — inclusive por agentes de inteligência artificial que atuam sob as regras definidas pela empresa. Registros de ação são mantidos para auditoria e segurança.":
      "Pour prendre en charge les clients, répondre, enregistrer le suivi de la prise en charge et organiser la relation commerciale, y compris par des agents d'intelligence artificielle qui agissent selon les règles définies par l'entreprise. Les journaux d'actions sont conservés à des fins d'audit et de sécurité.",
    "4. Com quem são compartilhados": "4. Avec qui elles sont partagées",
    "Os dados ficam nos servidores do serviço. Para funcionar, o prestador de serviço usa os fornecedores abaixo; a lista atualizada está no Anexo 2 do contrato de serviço:":
      "Les données se trouvent sur les serveurs du service. Pour fonctionner, le prestataire fait appel aux fournisseurs ci-dessous ; la liste à jour figure à l'annexe 2 du contrat de prestation de services :",
    "a plataforma de mensagens usada para conversar com o cliente;":
      "la plateforme de messagerie utilisée pour échanger avec le client ;",
    "o provedor de inteligência artificial usado pelo serviço, que recebe o trecho da conversa necessário para gerar a resposta ou avaliar a conversa;":
      "le fournisseur d'intelligence artificielle utilisé par le service, qui reçoit l'extrait de conversation nécessaire pour générer la réponse ou évaluer la conversation ;",
    "quando o Jev é ligado (desligado por padrão), a TypeSafe AI, nos Estados Unidos, que recebe cada mensagem do cliente, sozinha e já sem CPF, telefone e e-mail, para avaliar se ele está irritado, se a mensagem tenta manipular o atendimento automático, a qual área da empresa ela se destina, se ela pede para falar com uma pessoa ou para parar de receber mensagens e, quando ela responde a um follow-up, em qual das saídas do fluxo ela se encaixa;":
      "lorsque Jev est activé (désactivé par défaut), TypeSafe AI, aux États-Unis, qui reçoit chaque message du client, isolément et déjà expurgé du numéro de registre national, du numéro de téléphone et de l'adresse e-mail, pour évaluer si le client est irrité, si le message tente de manipuler la prise en charge automatique, à quel service de l'entreprise il s'adresse, s'il demande à parler à une personne ou à ne plus recevoir de messages et, lorsqu'il répond à une relance, à quelle sortie du parcours il correspond ;",
    "quando uma chave de Mapas é cadastrada (desligado por padrão), o Google, que recebe as coordenadas da localização que o cliente compartilhou, para devolver a rua e a cidade aproximadas;":
      "lorsqu'une clé Maps est enregistrée (fonction désactivée par défaut), Google, qui reçoit les coordonnées de la position partagée par le client, pour renvoyer la rue et la ville approximatives ;",
    "o provedor de infraestrutura onde o servidor está hospedado.":
      "le fournisseur d'infrastructure qui héberge le serveur.",
    "Os dados não são vendidos nem cedidos para publicidade de terceiros.":
      "Les données ne sont ni vendues ni cédées à des fins de publicité de tiers.",
    "5. Por quanto tempo": "5. Combien de temps",
    "Conversas e registros de negócio são mantidos enquanto houver relação com o cliente ou obrigação legal de guarda. Arquivos de mídia têm prazo próprio, configurado pela empresa. Registros de auditoria são mantidos por período mais longo, por serem prova de quem fez o quê. Ao fim do contrato de serviço, a empresa pode exportar os dados por 30 dias; depois disso, eles são apagados, salvo se a lei exigir guarda mais longa.":
      "Les conversations et les données des parcours de vente sont conservées tant qu'il existe une relation avec le client ou une obligation légale de conservation. Les fichiers multimédias ont leur propre durée, configurée par l'entreprise. Les journaux d'audit sont conservés plus longtemps, car ils prouvent qui a fait quoi. À la fin du contrat de prestation de services, l'entreprise peut exporter les données pendant 30 jours ; ensuite, elles sont supprimées, sauf si la loi exige une conservation plus longue.",
    "6. Seus direitos": "6. Vos droits",
    "O RGPD garante-lhe confirmar se há tratamento, aceder aos seus dados, corrigir dados incompletos ou desatualizados, pedir anonimização ou eliminação, saber com quem foram partilhados e retirar o consentimento.":
      "Le RGPD vous donne le droit de savoir si vos données sont traitées, d'y accéder, de faire rectifier des données incomplètes ou obsolètes, de demander leur anonymisation ou leur effacement, de demander la limitation du traitement, d'exercer votre droit à la portabilité, de vous opposer à un traitement fondé sur l'intérêt légitime, de savoir avec qui elles ont été partagées et de retirer votre consentement.",
    "Envie o seu pedido à empresa que trata os seus dados; o prestador de serviço a ajuda a atendê-lo. Para os dados da sua conta, você pode escrever diretamente ao prestador de serviço.":
      "Adressez votre demande à l'entreprise qui traite vos données ; le prestataire l'aide à y répondre. Pour les données de votre compte, vous pouvez écrire directement au prestataire.",
    "Você também pode apresentar reclamação à autoridade de proteção de dados: {autoridade} ({site}).":
      "Vous pouvez également introduire une plainte auprès de l'autorité de contrôle : {autoridade} ({site}).",
    "7. Segurança": "7. Sécurité",
    "O acesso é controlado por conta, senha e papel. A verificação em duas etapas é opcional para todos e só pode ser exigida de quem administra. Cada organização hospedada só enxerga os próprios dados, e as chaves de integração são guardadas cifradas.":
      "L'accès est contrôlé par compte, mot de passe et rôle. La vérification en deux étapes est facultative pour tous et ne peut être exigée que des administrateurs. Chaque organisation hébergée ne voit que ses propres données, et les clés d'intégration sont conservées chiffrées.",
    "8. Encarregado da proteção de dados e contato": "8. Délégué à la protection des données et contact",
    "Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com o encarregado da proteção de dados:":
      "Pour exercer vos droits ou poser vos questions sur la confidentialité, contactez le délégué à la protection des données :",
    "A empresa ainda não publicou um endereço de contato do encarregado da proteção de dados. Os pedidos devem ser feitos pelos canais de atendimento dela.":
      "L'entreprise n'a pas encore publié d'adresse de contact d'un délégué à la protection des données. Les demandes doivent être adressées via ses canaux de service client.",
    "Para os dados da sua conta, fale com o prestador de serviço pelo e-mail indicado no contrato de serviço.":
      "Pour les données de votre compte, contactez le prestataire à l'adresse e-mail indiquée dans le contrat de prestation de services.",
    "9. Dados do Google (Agenda, Meet e Google Ads)": "9. Données Google (Agenda, Meet et Google Ads)",
    "Quando uma pessoa autorizada da organização conecta uma conta Google a este sistema, os dados recebidos do Google são usados somente para a função que ela pediu:":
      "Lorsqu'une personne autorisée de l'organisation connecte un compte Google à ce système, les données reçues de Google ne sont utilisées que pour la fonction qu'elle a demandée :",
    "Google Agenda:": "Google Agenda :",
    "mostrar a ocupação da agenda, criar, alterar e cancelar os agendamentos feitos pelo próprio usuário e evitar choque de horários. O sistema guarda no servidor do serviço o título e o horário dos eventos para calcular a ocupação, e o cálculo de horários livres usa apenas o início, o fim e a situação deles. O sistema não lê e-mails.":
      "afficher l'occupation de l'agenda, créer, modifier et annuler les rendez-vous de l'utilisateur lui-même et éviter les conflits d'horaires. Le système conserve sur le serveur du service le titre et l'horaire des événements pour calculer l'occupation, et le calcul des créneaux libres n'utilise que leur début, leur fin et leur statut. Le système ne lit pas les e-mails.",
    "Google Meet:": "Google Meet :",
    "criar espaços de reunião do Google Meet quando a organização liga o Meet com acesso aberto; só o link gerado é devolvido pelo Google e guardado no servidor do serviço para o convite.":
      "créer des espaces de réunion Google Meet lorsque l'organisation active Meet en accès ouvert ; seul le lien généré est renvoyé par Google et conservé sur le serveur du service pour l'invitation.",
    "Google Ads:": "Google Ads :",
    "enviar ao Google Ads as vendas que um anúncio trouxe, para que ele aprenda com elas, criar e listar ações de conversão e ler as métricas das campanhas da própria conta de anúncios.":
      "envoyer à Google Ads les ventes générées par une annonce, afin qu'il en tire des enseignements, créer et lister des actions de conversion et lire les statistiques des campagnes de son propre compte publicitaire.",
    "Os dados do Google ficam no servidor do serviço, não são vendidos, não são usados para publicidade e não são usados para treinar modelos de inteligência artificial. O uso e a transferência das informações recebidas das APIs do Google seguem a Política de Dados de Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.":
      "Les données Google se trouvent sur le serveur du service, ne sont pas vendues, ne sont pas utilisées à des fins publicitaires et ne sont pas utilisées pour entraîner des modèles d'intelligence artificielle. L'utilisation et le transfert des informations reçues des API Google respectent la Google API Services User Data Policy, y compris les exigences d'utilisation limitée (Limited Use).",
    "A conexão com a Agenda pode ser desfeita a qualquer momento em Agenda → Desconectar, e a do Google Ads é retirada pelo prestador de serviço, a pedido. Em qualquer caso, a pessoa também pode revogar o acesso diretamente em":
      "La connexion à l'agenda peut être rompue à tout moment dans le menu Agenda ; celle de Google Ads est retirée par le prestataire, sur demande. Dans tous les cas, la personne peut aussi révoquer l'accès directement sur",
  },
};

/** O `?lang=` da página. Valor estranho vale como nenhuma escolha. */
export function lerEscolhaDeIdioma(bruto: string | string[] | undefined): EscolhaDeIdioma | null {
  return bruto === "nl" || bruto === "fr" || bruto === "tr" ? bruto : null;
}

/**
 * A língua belga que o `Accept-Language` pede, ou `null` quando ele pede uma língua
 * que o produto serve: aí o caminho de sempre atende. Sem nenhum sinal útil abre em
 * holandês, a língua da maioria, e o link no topo leva ao francês.
 */
export function idiomaBelgaDoCabecalho(cabecalho: string | null | undefined): IdiomaBelga | null {
  const candidatos = (cabecalho ?? "")
    .split(",")
    .map((parte) => {
      const [tag, q] = parte.trim().split(";q=");
      const peso = q ? Number.parseFloat(q) : 1;
      return { tag: tag?.trim().toLowerCase() ?? "", peso: Number.isFinite(peso) ? peso : 1 };
    })
    .filter((candidato) => candidato.tag.length > 0)
    .sort((a, b) => b.peso - a.peso);

  for (const { tag } of candidatos) {
    const primario = tag.split("-")[0];
    if (primario === "nl" || primario === "fr") return primario;
    if (parseAcceptLanguage(tag)) return null;
  }
  return "nl";
}

/**
 * Em que língua belga o visitante SEM SESSÃO lê, ou `null` para o caminho de sempre.
 * Quem chama garante que não há sessão: com sessão vale o idioma da pessoa.
 */
export async function idiomaBelgaDoVisitante(
  pais: string | null | undefined,
  escolha: EscolhaDeIdioma | null,
): Promise<IdiomaBelga | null> {
  if (perfilDoPais(pais).codigo !== "BE") return null;
  if (escolha === "tr") return null;
  if (escolha) return escolha;
  return idiomaBelgaDoCabecalho((await headers()).get("accept-language"));
}
