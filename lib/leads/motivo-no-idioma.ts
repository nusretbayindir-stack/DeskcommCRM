/**
 * O PORQUÊ DA LINHA DO TEMPO NO IDIOMA DA TELA, quando ele tem dado no meio.
 *
 * O `reason` das atividades é gravado em português, no vocabulário canônico, e
 * a tela traduz na LEITURA com `t(item.reason)` (#600; vigiado em
 * `o-que-o-banco-guarda-fica-canonico.test.ts`). O dicionário só casa frase
 * inteira, e duas famílias de frase são montadas com dado:
 * `stageChangeReason` ("Movido de Avaliação para Proposta enviada") e o diff do
 * checkpoint ("Nova objeção: … · Próxima ação: …"). Em turco a linha do tempo
 * mostrava "Movido de Yeni talep para Teklif".
 *
 * Aqui essas frases viram chave com marcador, escrita como literal (a varredura
 * de `i18n-espanhol-cobre-a-tela.test.ts` cobra cada uma), e o dado volta para
 * o lugar dele. O que não é dessas famílias devolve `null` e a tela segue com o
 * `t(item.reason)` de sempre. Lê a linha já gravada: o histórico antigo também
 * sai traduzido. Em português o resultado é byte a byte o texto gravado.
 */

type T = (texto: string) => string;
type Frase = { padrao: RegExp; frase: (t: T) => string };

/** `stageChangeReason` (`lib/leads/activity-emitter.ts`). */
const TROCA_DE_ETAPA: Frase[] = [
  { padrao: /^Movido de (?<de>.+?) para (?<para>.+)$/s, frase: (t) => t("Movido de {de} para {para}") },
  { padrao: /^Movido para (?<para>.+)$/s, frase: (t) => t("Movido para {para}") },
];

/** Rótulos do diff do checkpoint (`lib/leads/checkpoint-diff.ts`). */
const ROTULOS_DO_CHECKPOINT: Frase[] = [
  { padrao: /^Nova objeção: (?<texto>.+)$/s, frase: (t) => t("Nova objeção: {texto}") },
  { padrao: /^(?<n>\d+) novas objeções: (?<texto>.+)$/s, frase: (t) => t("{n} novas objeções: {texto}") },
  { padrao: /^Novo compromisso: (?<texto>.+)$/s, frase: (t) => t("Novo compromisso: {texto}") },
  {
    padrao: /^(?<n>\d+) novos compromissos: (?<texto>.+)$/s,
    frase: (t) => t("{n} novos compromissos: {texto}"),
  },
  { padrao: /^Próxima ação: (?<texto>.+)$/s, frase: (t) => t("Próxima ação: {texto}") },
];

/** O sufixo que `stage-operations.ts` acrescenta quando a etapa de origem foi arquivada. */
const ETAPA_ARQUIVADA = /^(?<frase>.+) \(a etapa «(?<etapa>.+)» foi arquivada\)$/s;

function preencher(modelo: string, valores: Record<string, string>): string {
  return Object.entries(valores).reduce((texto, [chave, valor]) => texto.replace(`{${chave}}`, valor), modelo);
}

function pelaLista(texto: string, lista: Frase[], t: T): string | null {
  for (const { padrao, frase } of lista) {
    const achado = padrao.exec(texto);
    if (achado?.groups) return preencher(frase(t), achado.groups);
  }
  return null;
}

function trocaDeEtapa(texto: string, t: T): string | null {
  const arquivada = ETAPA_ARQUIVADA.exec(texto);
  if (arquivada?.groups) {
    const frase = pelaLista(arquivada.groups.frase!, TROCA_DE_ETAPA, t);
    if (frase !== null) {
      return frase + preencher(t(" (a etapa «{etapa}» foi arquivada)"), { etapa: arquivada.groups.etapa! });
    }
  }
  return pelaLista(texto, TROCA_DE_ETAPA, t);
}

/**
 * A frase traduzida, ou `null` quando o motivo não é de uma das famílias com
 * dado — aí quem chama traduz o texto inteiro: `motivoNoIdioma(r, t) ?? t(r)`.
 */
export function motivoNoIdioma(motivo: string, t: T): string | null {
  // O motivo livre que a API anexa depois do travessão fica como veio.
  const travessao = motivo.indexOf(" — ");
  const cabeca = travessao === -1 ? motivo : motivo.slice(0, travessao);
  const cauda = travessao === -1 ? "" : motivo.slice(travessao);
  const etapa = trocaDeEtapa(cabeca, t);
  if (etapa !== null) return etapa + cauda;

  const partes = motivo.split(" · ").map((parte) => pelaLista(parte, ROTULOS_DO_CHECKPOINT, t));
  return partes.every((parte) => parte !== null) ? partes.join(" · ") : null;
}
