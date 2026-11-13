/**
 * OS RÓTULOS DO BRIEFING DA PASSAGEM NO IDIOMA DA EMPRESA (U46). Arquivo do fork.
 *
 * O cartão que a equipe recebe quando a IA passa uma conversa tem os títulos
 * dele traduzidos (`cartao-da-passagem.ts`), mas o CORPO — o resumo montado por
 * `montarBriefingDaPassagem` — saía com os rótulos em português. Texto para a
 * equipe é no idioma da ORGANIZAÇÃO (`organizations.locale`, doc S2a D4), não no
 * do contato nem no de quem lê: o corpo é gravado uma vez e lido por todos.
 *
 * `Record<Idioma, …>`: idioma novo no registro sem rótulos aqui é erro de tipo,
 * não português silencioso no meio do resumo. O português é o texto de sempre,
 * byte a byte (`tests/unit/briefing-da-passagem-no-idioma.test.ts`).
 *
 * Só os RÓTULOS mudam. O que é dado — a fala do cliente, o texto de quem passou,
 * o resumo que a IA escreveu, os compromissos — segue como veio.
 */
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";

import { FRASE_DO_MOTIVO, MARCA_DO_JEV, PISO_DO_BRIEFING, type MotivoDaPassagem } from "./passagem";

export interface RotulosDoBriefing {
  porQue: string;
  quemPassouEscreveu: string;
  clienteQuer: string;
  jaTentou: string;
  ultimasMensagens: string;
  dadosColetados: string;
  /** O título do cartão quando só há campos coletados: "Dados coletados: CEP, nome". */
  tituloDosCampos: string;
  contextoAcumulado: string;
  compromissos: string;
  objecoes: string;
  proximaAcao: string;
  caso: string;
  bloqueio: string;
  pessoaQueEscalou: string;
  /** As duas linhas de `renderDeclaracaoParaHumano`. */
  pessoaQuer: string;
  prometido: string;
  /** "(até amanhã)" — o prazo de uma promessa. */
  ate: string;
  piso: string;
}

/** Francês: espaço inseparável antes de `:`, como o catálogo `fr.json`. */
const NBSP = " ";

export const ROTULOS_DO_BRIEFING: Record<Idioma, RotulosDoBriefing> = {
  "pt-BR": {
    porQue: "Por que a IA passou: ",
    quemPassouEscreveu: "Quem passou escreveu: ",
    clienteQuer: "O que o cliente quer (segundo a IA — confira): ",
    jaTentou: "O que a IA já tentou:",
    ultimasMensagens: "Últimas mensagens do cliente (palavras dele): ",
    dadosColetados: "Dados coletados automaticamente (confira antes de usar):",
    tituloDosCampos: "Dados coletados: ",
    contextoAcumulado: "Contexto acumulado (segundo a IA — confira):",
    compromissos: "Compromissos: ",
    objecoes: "Objeções: ",
    proximaAcao: "Próxima ação: ",
    caso: "Caso: ",
    bloqueio: "Bloqueio: ",
    pessoaQueEscalou: "A pessoa que escalou escreveu: ",
    pessoaQuer: "O que a pessoa quer: ",
    prometido: "Prometido a ela: ",
    ate: "até ",
    piso: PISO_DO_BRIEFING,
  },
  es: {
    porQue: "Por qué la IA pasó la conversación: ",
    quemPassouEscreveu: "Quien la pasó escribió: ",
    clienteQuer: "Lo que quiere el cliente (según la IA — verifíquelo): ",
    jaTentou: "Lo que la IA ya intentó:",
    ultimasMensagens: "Últimos mensajes del cliente (sus palabras): ",
    dadosColetados: "Datos recopilados automáticamente (verifíquelos antes de usarlos):",
    tituloDosCampos: "Datos recopilados: ",
    contextoAcumulado: "Contexto acumulado (según la IA — verifíquelo):",
    compromissos: "Compromisos: ",
    objecoes: "Objeciones: ",
    proximaAcao: "Próxima acción: ",
    caso: "Caso: ",
    bloqueio: "Bloqueo: ",
    pessoaQueEscalou: "La persona que escaló escribió: ",
    pessoaQuer: "Lo que la persona quiere: ",
    prometido: "Prometido a la persona: ",
    ate: "hasta ",
    piso: "Todavía no hay resumen acumulado (conversación reciente) — abra la conversación en el CRM para ver el contexto completo.",
  },
  tr: {
    porQue: "AI konuşmayı neden devretti: ",
    quemPassouEscreveu: "Devreden şunu yazdı: ",
    clienteQuer: "Müşterinin istediği (AI'ya göre — kontrol edin): ",
    jaTentou: "AI'nın zaten denedikleri:",
    ultimasMensagens: "Müşterinin son mesajları (kendi sözleri): ",
    dadosColetados: "Otomatik toplanan bilgiler (kullanmadan önce kontrol edin):",
    tituloDosCampos: "Toplanan bilgiler: ",
    contextoAcumulado: "Birikmiş bağlam (AI'ya göre — kontrol edin):",
    compromissos: "Verilen sözler: ",
    objecoes: "İtirazlar: ",
    proximaAcao: "Sonraki adım: ",
    caso: "Vaka: ",
    bloqueio: "Engel: ",
    pessoaQueEscalou: "Vakayı yükselten ekip üyesi şunu yazdı: ",
    pessoaQuer: "Kişinin istediği: ",
    prometido: "Kişiye verilen söz: ",
    ate: "son tarih ",
    piso: "Henüz birikmiş özet yok (yeni konuşma) — tüm bağlam için konuşmayı CRM'de açın.",
  },
  nl: {
    porQue: "Waarom de AI heeft doorgegeven: ",
    quemPassouEscreveu: "Toelichting bij de overdracht: ",
    clienteQuer: "Wat de klant wil (volgens de AI — controleer dit): ",
    jaTentou: "Wat de AI al heeft geprobeerd:",
    ultimasMensagens: "Laatste berichten van de klant (eigen woorden): ",
    dadosColetados: "Automatisch verzamelde gegevens (controleer ze voor gebruik):",
    tituloDosCampos: "Verzamelde gegevens: ",
    contextoAcumulado: "Opgebouwde context (volgens de AI — controleer dit):",
    compromissos: "Toezeggingen: ",
    objecoes: "Bezwaren: ",
    proximaAcao: "Volgende actie: ",
    caso: "Dossier: ",
    bloqueio: "Blokkering: ",
    pessoaQueEscalou: "Wie het dossier heeft geëscaleerd, schreef: ",
    pessoaQuer: "Wat de persoon wil: ",
    prometido: "Beloofd aan de persoon: ",
    ate: "tegen ",
    piso: "Nog geen opgebouwde samenvatting (recent gesprek) — open het gesprek in het CRM voor de volledige context.",
  },
  fr: {
    porQue: `Pourquoi l'IA a passé la conversation${NBSP}: `,
    quemPassouEscreveu: `La personne qui a passé la conversation a écrit${NBSP}: `,
    clienteQuer: `Ce que veut le client (selon l'IA — à vérifier)${NBSP}: `,
    jaTentou: `Ce que l'IA a déjà essayé${NBSP}:`,
    ultimasMensagens: `Derniers messages du client (ses propres mots)${NBSP}: `,
    dadosColetados: `Données collectées automatiquement (à vérifier avant usage)${NBSP}:`,
    tituloDosCampos: `Données collectées${NBSP}: `,
    contextoAcumulado: `Contexte accumulé (selon l'IA — à vérifier)${NBSP}:`,
    compromissos: `Engagements${NBSP}: `,
    objecoes: `Objections${NBSP}: `,
    proximaAcao: `Prochaine action${NBSP}: `,
    caso: `Dossier${NBSP}: `,
    bloqueio: `Blocage${NBSP}: `,
    pessoaQueEscalou: `La personne qui a escaladé le dossier a écrit${NBSP}: `,
    pessoaQuer: `Ce que veut la personne${NBSP}: `,
    prometido: `Promis à la personne${NBSP}: `,
    ate: "d'ici ",
    piso: "Pas encore de résumé accumulé (conversation récente) — ouvrez la conversation dans le CRM pour le contexte complet.",
  },
};

/** Os rótulos de um idioma; desconhecido (ou ausente) vale o português de sempre. */
export function rotulosDoBriefing(idioma: Idioma | null | undefined): RotulosDoBriefing {
  return ROTULOS_DO_BRIEFING[idioma ?? IDIOMA_PADRAO] ?? ROTULOS_DO_BRIEFING[IDIOMA_PADRAO];
}

/**
 * A frase do motivo, com a marca do Jev. As frases já moram no catálogo, porque
 * o corpo curto do aviso da Central as traduz (`corpoCurtoDoAviso`): a mesma
 * frase nos dois lugares, com a mesma tradução.
 */
export function fraseDoMotivoNoIdioma(
  codigo: MotivoDaPassagem,
  percebidoPeloJev: boolean,
  idioma: Idioma | null | undefined,
): string {
  const lingua = idioma ?? IDIOMA_PADRAO;
  const frase = traduzir(FRASE_DO_MOTIVO[codigo], lingua);
  return percebidoPeloJev ? `${frase} ${traduzir(MARCA_DO_JEV, lingua)}` : frase;
}

/**
 * O piso ("sem resumo acumulado") em QUALQUER idioma — para quem LÊ a linha
 * gravada (`cartao-da-passagem.ts`) reconhecer a passagem sem contexto, seja
 * ela antiga (português) ou nova (no idioma da empresa).
 */
export function ehPisoDoBriefing(corpo: string): boolean {
  const alvo = corpo.trim();
  return Object.values(ROTULOS_DO_BRIEFING).some((r) => r.piso.trim() === alvo);
}

/**
 * O corpo traz a irritação percebida pelo Jev, em qualquer idioma — a mesma
 * frase que `fraseDoMotivoNoIdioma` grava (em português, `MOTIVO_PERCEBIDO_PELO_JEV`).
 */
export function temMarcaDoJev(corpo: string): boolean {
  return (Object.keys(ROTULOS_DO_BRIEFING) as Idioma[]).some((idioma) =>
    corpo.includes(fraseDoMotivoNoIdioma("low_sentiment", true, idioma)),
  );
}
