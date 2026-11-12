/**
 * AS PALAVRAS DO COMANDO DA EQUIPE (S2a, decisão do dono de 2026-11-12).
 *
 * A equipe orienta a IA respondendo ao aviso do caso, pelo número interno:
 * `<PALAVRA> <id do caso> <texto>`. `RESPONDER` e `PERGUNTAR` são as palavras de
 * sempre e valem em toda organização. Cada idioma da Bélgica ganha as suas —
 * holandês ANTWOORD/VRAAG, francês RÉPONDRE/DEMANDER, turco YANITLA/SOR — e
 * TODAS valem em toda organização: a equipe de uma empresa belga mistura
 * línguas, e a tela de cada pessoa ensina a palavra da língua DELA (o painel
 * segue o idioma do usuário, o aviso no WhatsApp segue o da empresa).
 *
 * O que impede uma conversa comum de virar comando continua sendo o resto do
 * formato: só o número interno é lido, e só com o ID de 36 caracteres logo
 * depois da palavra. Uma palavra curta como "sor" não muda isso.
 *
 * A comparação ignora maiúsculas e acentos: "Répondre", "REPONDRE" e
 * "repondre" são a mesma palavra, e o "ı" do teclado turco ("yanıtla") também.
 */
import type { Idioma } from "@/lib/i18n/idiomas";

export type AcaoDoComando = "resolved" | "need_lead_info";

export type PalavrasDoComando = {
  /** Resolve o caso com a orientação da equipe. */
  readonly responder: string;
  /** Pede à IA que pergunte algo ao cliente. */
  readonly perguntar: string;
};

const DE_SEMPRE: PalavrasDoComando = { responder: "RESPONDER", perguntar: "PERGUNTAR" };

/** A palavra que o aviso ENSINA, por idioma da empresa. Sem entrada: as de sempre. */
const POR_IDIOMA: Readonly<Partial<Record<Idioma, PalavrasDoComando>>> = {
  nl: { responder: "ANTWOORD", perguntar: "VRAAG" },
  fr: { responder: "RÉPONDRE", perguntar: "DEMANDER" },
  tr: { responder: "YANITLA", perguntar: "SOR" },
};

export function palavrasDoComando(idioma: Idioma): PalavrasDoComando {
  return POR_IDIOMA[idioma] ?? DE_SEMPRE;
}

/** Maiúsculas sem acento: "Répondre" → "REPONDRE", "yanıtla" → "YANITLA", "İ" → "I". */
function chave(palavra: string): string {
  return palavra.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

const ACAO_DA_PALAVRA: ReadonlyMap<string, AcaoDoComando> = new Map(
  [DE_SEMPRE, ...Object.values(POR_IDIOMA)].flatMap((p): Array<[string, AcaoDoComando]> => [
    [chave(p.responder), "resolved"],
    [chave(p.perguntar), "need_lead_info"],
  ]),
);

/** A ação de uma palavra de comando, em qualquer idioma; `null` se não é uma. */
export function acaoDaPalavraDeComando(palavra: string): AcaoDoComando | null {
  return ACAO_DA_PALAVRA.get(chave(palavra)) ?? null;
}

/**
 * O texto COMEÇA com uma palavra de comando, sozinha ou seguida de espaço? É o
 * sinal de que a pessoa tentou o comando e errou o formato — ela ganha a ajuda.
 * "Sorun var" não começa com "SOR": a palavra inteira tem de ser a do comando.
 */
export function comecaComPalavraDeComando(texto: string | null | undefined): boolean {
  const primeira = (texto ?? "").trim().split(/\s/u, 1)[0] ?? "";
  return primeira !== "" && acaoDaPalavraDeComando(primeira) !== null;
}
