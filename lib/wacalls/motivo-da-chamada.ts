/**
 * O motivo do fim de uma chamada, em linguagem de gente.
 *
 * O WaCalls devolve o vocabulário do `EndCallReason` dele — `user_ended`,
 * `do_not_disturb`, `timeout` — e a coluna `voice_calls.end_reason` guarda o
 * valor cru de propósito (é vocabulário de terceiro, sem CHECK, para não
 * quebrar quando o upstream ganhar um valor novo).
 *
 * O que NÃO pode acontecer é esse token chegar à tela. O aviso da Central
 * nascia com o corpo `Motivo: user_ended`: quem opera o CRM não fala inglês de
 * protocolo, e "user_ended" ainda por cima é ambíguo — o "user" ali é a pessoa
 * do outro lado, não quem lê o aviso.
 *
 * Motivo desconhecido NÃO é escondido: a frase diz que não sabemos e mostra o
 * token entre parênteses. Sumir com ele deixaria quem for investigar sem a
 * única pista que existe, e uma frase tranquilizadora onde não há informação é
 * pior que a informação estranha.
 */
import { traduzir } from '@/lib/i18n/dicionario';
import type { Idioma } from '@/lib/i18n/idiomas';

const MOTIVOS: Record<string, string> = {
  user_ended: 'Quem ligou desligou antes de alguém atender.',
  declined: 'A chamada foi recusada.',
  rejected: 'A chamada foi recusada.',
  timeout: 'O telefone tocou e ninguém atendeu.',
  busy: 'A linha estava ocupada.',
  cancelled: 'A chamada foi cancelada.',
  canceled: 'A chamada foi cancelada.',
  failed: 'A chamada falhou antes de completar.',
  do_not_disturb: 'O aparelho estava no modo "não perturbe".',
  unknown: 'A chamada terminou sem que o WhatsApp informasse o motivo.',
};

/** Frase em português para o `end_reason` cru do upstream. */
export function motivoDaChamadaEmPortugues(motivo: string | null | undefined): string {
  const cru = (motivo ?? '').trim();
  if (!cru) return MOTIVOS['unknown']!;
  const conhecido = MOTIVOS[cru.toLowerCase()];
  if (conhecido) return conhecido;
  return `A chamada terminou por um motivo que ainda não sabemos traduzir (${cru}).`;
}

/**
 * As mesmas frases de `MOTIVOS`, no idioma pedido (U14) — cada uma com o seu
 * literal, porque o aviso da Central é gravado no idioma da organização. A
 * tabela em português continua sendo a de cima, que a linha do tempo do
 * negócio também usa.
 */
const MOTIVOS_NO_IDIOMA: Record<string, (idioma: Idioma) => string> = {
  user_ended: (i) => traduzir('Quem ligou desligou antes de alguém atender.', i),
  declined: (i) => traduzir('A chamada foi recusada.', i),
  rejected: (i) => traduzir('A chamada foi recusada.', i),
  timeout: (i) => traduzir('O telefone tocou e ninguém atendeu.', i),
  busy: (i) => traduzir('A linha estava ocupada.', i),
  cancelled: (i) => traduzir('A chamada foi cancelada.', i),
  canceled: (i) => traduzir('A chamada foi cancelada.', i),
  failed: (i) => traduzir('A chamada falhou antes de completar.', i),
  do_not_disturb: (i) => traduzir('O aparelho estava no modo "não perturbe".', i),
  unknown: (i) => traduzir('A chamada terminou sem que o WhatsApp informasse o motivo.', i),
};

/** O motivo da chamada no idioma pedido; em português, byte a byte o de `motivoDaChamadaEmPortugues`. */
export function motivoDaChamadaNoIdioma(motivo: string | null | undefined, idioma: Idioma): string {
  if (idioma === 'pt-BR') return motivoDaChamadaEmPortugues(motivo);
  const cru = (motivo ?? '').trim();
  if (!cru) return MOTIVOS_NO_IDIOMA['unknown']!(idioma);
  const conhecido = MOTIVOS_NO_IDIOMA[cru.toLowerCase()];
  if (conhecido) return conhecido(idioma);
  return traduzir('A chamada terminou por um motivo que ainda não sabemos traduzir ({motivo}).', idioma).replace(
    '{motivo}',
    () => cru,
  );
}

/** O aviso de chamada perdida da Central (`voice_call_missed`), no idioma da organização. */
export function avisoDeChamadaPerdida(
  telefone: string,
  motivo: string | null | undefined,
  idioma: Idioma,
): { title: string; body: string } {
  return {
    title: traduzir('Chamada perdida de {telefone}', idioma).replace('{telefone}', () => telefone),
    body: motivoDaChamadaNoIdioma(motivo, idioma),
  };
}
