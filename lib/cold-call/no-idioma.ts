/**
 * O COLD CALL NO IDIOMA DE QUEM USA (S2a Task 7b, U41). Arquivo do fork.
 *
 * As regras do módulo (`./regras.ts`) são do upstream e falam português,
 * espanhol e inglês. O que o fork acrescenta para o turco, o neerlandês e o
 * francês mora aqui, e `regras.ts` só chama: o roteiro inicial, as lacunas
 * dele e a chave de tela de "Follow-up".
 *
 * Teste: `tests/unit/cold-call-no-idioma.test.ts`.
 */

/**
 * A chave de TELA de um rótulo do Cold Call.
 *
 * "Follow-up" no Cold Call é "ligar de novo depois" — etapa e botão de
 * resultado —, e não a mensagem de acompanhamento do produto, que é o sentido
 * da frase no catálogo ("Takip mesajı", "Opvolgbericht", "Message de
 * relance"). O dado gravado segue "Follow-up": só a tela e o nome da etapa na
 * criação do funil passam por aqui.
 */
export function naTelaDoColdCall(rotulo: string): string {
  return rotulo === "Follow-up" ? "Follow-up@@cold-call" : rotulo;
}

/** O francês põe espaço inseparável antes de `? ! : ;` (como o catálogo `fr.json`). */
function comEspacoInseparavel(texto: string): string {
  return texto.replace(/ ([?!:;])/g, " $1");
}

/**
 * O roteiro com que o funil nasce, nas línguas do fork. Mesma forma e mesma
 * neutralidade dos de `regras.ts` (vai para toda instalação, não vende
 * produto). Turco e neerlandês na forma de cortesia ("siz", "u"), francês com
 * "vous", como os glossários aprovados.
 */
const ROTEIROS: Partial<Record<string, string>> = {
  tr: `# Açılış
- Merhaba, [müşterinin adı] firmasından biriyle mi görüşüyorum?
- Adım [adınız], [şirketiniz] firmasından arıyorum. Bu aramanın planlı olmadığını biliyorum. Nedenini anlatmak için 30 saniyenizi alabilir miyim? Sonra devam edip etmeyeceğimize siz karar verirsiniz.

# Kişi devam etmenize izin verirse
- [Olumlu yanıt] [sunduğunuz şey] konusunda çalıştığımız için arıyorum. Bu işi bugün nasıl yürütüyorsunuz?
- [İlgi] Sakin sakin anlatabilmem için kısa bir görüşme planlamak mantıklı olur mu? Hangi gün size uygun?
- [Randevu alındı] Daveti göndermek için ad, e-posta ve saati teyit edin.

# Kişi itiraz ederse
- [Vakti yok] Sorun değil. Sizi tekrar aramam için en uygun saat hangisi?
- [Zaten var] Anlıyorum. Başka bir seçeneğe bakmanızı ne sağlardı?
- [Mesajla gönderin] Tabii, gönderirim. Bunun için en iyi numara bu mu?
- [Yetkili değil] Bu işle kim ilgileniyor? Adını ve en uygun saati verebilir misiniz?`,
  nl: `# Opening
- Goedendag, spreek ik met iemand van [naam van de lead]?
- Mijn naam is [uw naam], van [uw bedrijf]. Ik weet dat dit gesprek niet gepland was. Mag ik 30 seconden van uw tijd om te vertellen waarom ik bel? Daarna beslist u of we verdergaan.

# Als de persoon u laat doorgaan
- [Positief antwoord] Ik bel omdat wij werken met [wat u aanbiedt]. Hoe pakt u dat vandaag aan?
- [Interesse] Zou het zinvol zijn om een kort gesprek in te plannen, zodat ik het rustig kan uitleggen? Welke dag past u het best?
- [Afspraak gemaakt] Bevestig naam, e-mailadres en tijdstip om de uitnodiging te sturen.

# Als de persoon afhoudt
- [Geen tijd] Geen probleem. Wanneer kan ik u het best terugbellen?
- [Heeft al iets] Begrepen. Wat zou u ertoe brengen om naar een andere oplossing te kijken?
- [Stuur het per bericht] Zeker, dat stuur ik u. Is dit nummer daarvoor het beste?
- [Niet de beslisser] Wie is daarvoor verantwoordelijk? Kunt u mij de naam en het beste tijdstip geven?`,
  fr: comEspacoInseparavel(`# Ouverture
- Bonjour, je suis bien en ligne avec quelqu'un de [nom du prospect] ?
- Je m'appelle [votre nom], de [votre entreprise]. Je sais que cet appel n'était pas prévu. Puis-je prendre 30 secondes pour vous expliquer pourquoi j'appelle ? Ensuite, vous décidez si nous continuons.

# Si la personne vous laisse continuer
- [Réponse positive] J'appelle parce que nous travaillons sur [ce que vous proposez]. Comment gérez-vous cela aujourd'hui ?
- [Intérêt] Serait-il utile de prévoir un court rendez-vous pour que je vous l'explique calmement ? Quel jour vous conviendrait ?
- [Rendez-vous pris] Confirmer le nom, l'e-mail et l'heure pour envoyer l'invitation.

# Si la personne bloque
- [Pas le temps] Aucun problème. Quel est le meilleur moment pour vous rappeler ?
- [A déjà une solution] Je comprends. Qu'est-ce qui vous amènerait à regarder une autre option ?
- [Envoyez-le par message] Bien sûr, je vous l'envoie. Ce numéro est-il le meilleur pour cela ?
- [N'est pas le décideur] Qui s'occupe de cela chez vous ? Pouvez-vous me donner son nom et le meilleur moment pour le joindre ?`),
};

/** O roteiro inicial do fork para a língua, ou `undefined` (aí vale o do upstream). */
export function roteiroDoFork(idioma: string): string | undefined {
  return ROTEIROS[idioma];
}

/**
 * As lacunas dos roteiros acima, que `linhasDoRoteiro` não conhece. Mesma
 * regra dela: o valor entra como texto, nunca como padrão do `replace`.
 */
export function preencherLacunasDoFork(
  roteiro: string,
  dados: { negocio: string; quemLiga: string; suaEmpresa?: string },
): string {
  return roteiro
    .replace(/\[(?:şirketiniz|uw bedrijf|votre entreprise)\]/gi, () => dados.suaEmpresa ?? "")
    .replace(/\[(?:müşterinin adı|naam van de lead|nom du prospect)\]/gi, () => dados.negocio)
    .replace(/\[(?:adınız|uw naam|votre nom)\]/gi, () => dados.quemLiga);
}
