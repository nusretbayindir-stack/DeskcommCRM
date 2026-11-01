/**
 * O AVISO DE CHAMADA PERDIDA SAI NO IDIOMA DA ORGANIZAÇÃO (U14).
 *
 * A Central mostra o título e o corpo gravados. Uma empresa turca lia
 * "Chamada perdida de +90…" e "O telefone tocou e ninguém atendeu." no meio da
 * tela turca. A frase do motivo continua sem o token cru, e o motivo
 * desconhecido continua carregando o token (ver `motivo-da-chamada.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  avisoDeChamadaPerdida,
  motivoDaChamadaEmPortugues,
  motivoDaChamadaNoIdioma,
} from '@/lib/wacalls/motivo-da-chamada';

describe('motivoDaChamadaNoIdioma em turco', () => {
  it.each([
    ['user_ended', 'Arayan kişi, biri açmadan kapattı.'],
    ['timeout', 'Telefon çaldı ama kimse açmadı.'],
    ['busy', 'Hat meşguldü.'],
    ['declined', 'Arama reddedildi.'],
    ['do_not_disturb', 'Telefon "rahatsız etme" modundaydı.'],
  ])('%s', (cru, frase) => {
    expect(motivoDaChamadaNoIdioma(cru, 'tr')).toBe(frase);
  });

  it('motivo desconhecido: diz que não sabe E mostra o cru, em turco', () => {
    expect(motivoDaChamadaNoIdioma('network_congestion', 'tr')).toBe(
      'Arama, henüz çeviremediğimiz bir nedenle sona erdi (network_congestion).',
    );
  });

  it('sem motivo: a frase de "o WhatsApp não informou", em turco', () => {
    expect(motivoDaChamadaNoIdioma(null, 'tr')).toBe('Arama, WhatsApp bir neden bildirmeden sona erdi.');
  });
});

describe('português sem mudança de byte', () => {
  it.each(['user_ended', 'declined', 'rejected', 'timeout', 'busy', 'cancelled', 'canceled', 'failed', 'do_not_disturb', 'unknown', 'network_congestion', null, ''])(
    '%s',
    (cru) => {
      expect(motivoDaChamadaNoIdioma(cru, 'pt-BR')).toBe(motivoDaChamadaEmPortugues(cru));
    },
  );

  it('o aviso em português é o de antes', () => {
    expect(avisoDeChamadaPerdida('+5511999990000', 'timeout', 'pt-BR')).toEqual({
      title: 'Chamada perdida de +5511999990000',
      body: 'O telefone tocou e ninguém atendeu.',
    });
  });
});

describe('avisoDeChamadaPerdida', () => {
  it('em turco: o telefone no título, o motivo no corpo', () => {
    expect(avisoDeChamadaPerdida('+905321112233', 'timeout', 'tr')).toEqual({
      title: '+905321112233 numarasından cevapsız arama',
      body: 'Telefon çaldı ama kimse açmadı.',
    });
  });

  it('a ponte de eventos grava o aviso por esta função, no idioma lido da organização', () => {
    // O insert mora no meio do handler de SSE e só roda contra Postgres (as
    // invariantes `voz-*`); aqui se prende a fiação.
    const ponte = readFileSync(join(process.cwd(), 'lib/wacalls/events-bridge.ts'), 'utf8');
    expect(ponte).toMatch(/idiomaDaOrgPeloPg\(pool, sess\.organizationId\)/);
    expect(ponte).toMatch(/avisoDeChamadaPerdida\(row\.peer_phone, ev\.reason, idioma\)/);
  });
});
