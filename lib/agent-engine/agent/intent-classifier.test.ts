import { describe, expect, it, vi } from 'vitest';

import { buildClassifierPrompt, parseIntentVerdict, classifyIntent } from './intent-classifier';

const members = [
  { agentId: 'a1', intentName: 'vendas', intentDescription: 'Quer comprar ou saber preço', examples: ['quanto custa'] },
  { agentId: 'a2', intentName: 'suporte', intentDescription: 'Problema técnico', examples: [] },
];
const router = { id: 'r1', name: 'R', classifierModel: 'claude-haiku-4-5',
    classifierProvider: null, sticky: true, minConfidence: 0.6, fallbackAgentId: null, members };

describe('buildClassifierPrompt', () => {
  it('lista as intenções com descrição e a opção none', () => {
    const p = buildClassifierPrompt(members, 'quanto custa o plano?');
    expect(p).toContain('vendas');
    expect(p).toContain('Quer comprar ou saber preço');
    expect(p).toContain('suporte');
    expect(p).toContain('none');
    expect(p).toContain('quanto custa o plano?');
  });

  it('contexto recente vem antes da mensagem a classificar, na ordem recebida, com rótulo Lead/Agente', () => {
    const p = buildClassifierPrompt(members, 'Primeira', [
      { direction: 'inbound', body: 'Quero marcar uma consulta' },
      { direction: 'outbound', body: 'Qual data prefere: a primeira ou a segunda?' },
    ]);
    const posicoes = [
      'Contexto recente da conversa',
      'Lead: Quero marcar uma consulta',
      'Agente: Qual data prefere: a primeira ou a segunda?',
      'Mensagem do lead a classificar:\nPrimeira',
    ].map((trecho) => p.indexOf(trecho));
    expect(posicoes.every((i) => i >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  it('sem contexto, o prompt é byte a byte o de antes do contexto curto', () => {
    const antes = [
      'Você é um classificador auxiliar de intenção (NÃO responde ao lead).',
      'Intenções possíveis:',
      '- vendas: Quer comprar ou saber preço. Exemplos: quanto custa.',
      '- suporte: Problema técnico.',
      '- none: nenhuma das intenções acima se aplica.',
      '',
      'Mensagem do lead a classificar:',
      'oi',
      '',
      'Responda SOMENTE JSON: {"intent": "<nome exato de uma intenção da lista ou none>", "confidence": <0 a 1>}',
    ].join('\n');
    expect(buildClassifierPrompt(members, 'oi')).toBe(antes);
    expect(buildClassifierPrompt(members, 'oi', [])).toBe(antes);
  });
});

describe('parseIntentVerdict', () => {
  it('extrai intenção e confiança do JSON', () => {
    expect(parseIntentVerdict('{"intent":"vendas","confidence":0.9}', members)).toEqual({ intentName: 'vendas', confidence: 0.9 });
  });
  it('aceita JSON cercado de texto', () => {
    expect(parseIntentVerdict('Claro!\n{"intent":"suporte","confidence":0.7}\n', members)).toEqual({ intentName: 'suporte', confidence: 0.7 });
  });
  it('none vira intentName null', () => {
    expect(parseIntentVerdict('{"intent":"none","confidence":0.2}', members)).toEqual({ intentName: null, confidence: 0.2 });
  });
  it('intenção que não existe no router é recusada (modelo alucinou)', () => {
    expect(parseIntentVerdict('{"intent":"financeiro","confidence":0.95}', members)).toEqual({ intentName: null, confidence: 0, falhou: true });
  });
  it('JSON inválido vira veredito nulo, sem throw', () => {
    expect(parseIntentVerdict('desculpe, não sei', members)).toEqual({ intentName: null, confidence: 0, falhou: true });
  });
  it('JSON sem intenção não é resposta', () => {
    expect(parseIntentVerdict('{"confidence":0.9}', members)).toEqual({ intentName: null, confidence: 0, falhou: true });
  });
  it('confiança fora de 0..1 é clampada', () => {
    expect(parseIntentVerdict('{"intent":"vendas","confidence":7}', members).confidence).toBe(1);
  });
});

// Nome com ":" vira, no prompt, "- Yedek parça: parça, uygunluk ve fiyat: <descrição>",
// e o modelo devolve só o que vem antes do primeiro ":". Comparado letra a letra,
// o nome caía como alucinação e o turno ia calado para a reserva.
describe('parseIntentVerdict — nome que o modelo encurtou ou escreveu diferente', () => {
  const membrosDoDemo = [
    { agentId: 'p', intentName: 'Yedek parça: parça, uygunluk ve fiyat', intentDescription: 'Peça de carro', examples: [] },
    { agentId: 'm', intentName: 'Mutfak: tasarım ve keşif', intentDescription: 'Cozinha planejada', examples: [] },
    { agentId: 'i', intentName: 'İade ve şikâyet', intentDescription: 'Devolução', examples: [] },
  ];

  it('o nome até o ":" casa com a única intenção que começa assim, e devolve o nome inteiro', () => {
    expect(parseIntentVerdict('{"intent":"Yedek parça","confidence":0.9}', membrosDoDemo))
      .toEqual({ intentName: 'Yedek parça: parça, uygunluk ve fiyat', confidence: 0.9 });
  });

  it('maiúsculas, o İ/ı turco e acentos não separam o nome', () => {
    expect(parseIntentVerdict('{"intent":"MUTFAK: TASARIM VE KESIF","confidence":0.8}', membrosDoDemo))
      .toEqual({ intentName: 'Mutfak: tasarım ve keşif', confidence: 0.8 });
    expect(parseIntentVerdict('{"intent":"iade ve sikayet","confidence":0.8}', membrosDoDemo))
      .toEqual({ intentName: 'İade ve şikâyet', confidence: 0.8 });
  });

  it('pedaço que corta uma palavra no meio não casa', () => {
    expect(parseIntentVerdict('{"intent":"Yedek par","confidence":0.9}', membrosDoDemo))
      .toEqual({ intentName: null, confidence: 0, falhou: true });
  });

  it('começo que serve a duas intenções é recusado — o parse não escolhe por sorte', () => {
    const ambiguos = [
      { agentId: 'a', intentName: 'Yedek parça: fiyat', intentDescription: 'x', examples: [] },
      { agentId: 'b', intentName: 'Yedek parça: stok', intentDescription: 'y', examples: [] },
    ];
    expect(parseIntentVerdict('{"intent":"Yedek parça","confidence":0.9}', ambiguos))
      .toEqual({ intentName: null, confidence: 0, falhou: true });
  });

  it('o nome exato vence o começo de outro nome', () => {
    const encaixados = [
      { agentId: 'a', intentName: 'Satış', intentDescription: 'x', examples: [] },
      { agentId: 'b', intentName: 'Satış: kampanya', intentDescription: 'y', examples: [] },
    ];
    expect(parseIntentVerdict('{"intent":"satış","confidence":0.9}', encaixados))
      .toEqual({ intentName: 'Satış', confidence: 0.9 });
  });

  it('"None" em maiúscula é nenhuma, não falha', () => {
    expect(parseIntentVerdict('{"intent":"None","confidence":0.3}', membrosDoDemo))
      .toEqual({ intentName: null, confidence: 0.3 });
  });
});

describe('classifyIntent', () => {
  it('usa o modelo do router e purpose intent_router', async () => {
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: '{"intent":"vendas","confidence":0.88}' } });
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal: 'quanto custa' },
      { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never, runModelCall } as never);
    expect(out).toEqual({ intentName: 'vendas', confidence: 0.88 });
    const call = runModelCall.mock.calls[0]![2];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.purpose).toBe('intent_router');
  });

  it('leva o contexto recente até o prompt que vai ao modelo', async () => {
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: '{"intent":"vendas","confidence":0.9}' } });
    await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal: 'Primeira',
        recentMessages: [{ direction: 'outbound', body: 'Qual data prefere?' }] },
      { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never, runModelCall } as never);
    expect(runModelCall.mock.calls[0]![2].messages[0].content).toContain('Agente: Qual data prefere?');
  });

  it('falha do modelo devolve null (chamador cai no fallback) e NÃO lança', async () => {
    const runModelCall = vi.fn().mockRejectedValue(new Error('model not enabled'));
    const warn = vi.fn();
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal: 'oi' },
      { log: { info: vi.fn(), warn, error: vi.fn() } as never, runModelCall } as never);
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

// Saída que não é resposta vira "nenhuma" e o turno vai para a reserva. Antes
// isso não deixava rastro nenhum: só a falha da chamada ia para o log.
describe('classifyIntent — saída recusada deixa rastro no log', () => {
  const classificarCom = async (texto: string, signal: string) => {
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: texto } });
    const warn = vi.fn();
    const out = await classifyIntent({} as never, {} as never,
      { tenantId: 'o1', leadId: 'l1', jobId: 'j1', router, signal },
      { log: { info: vi.fn(), warn, error: vi.fn() } as never, runModelCall } as never);
    return { out, warn };
  };

  it('intenção fora da lista: o log diz qual nome voltou, sem o texto do cliente', async () => {
    const { out, warn } = await classificarCom('{"intent":"financeiro","confidence":0.95}', 'meu cartão 4111 venceu');
    expect(out).toEqual({ intentName: null, confidence: 0, falhou: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toMatchObject({ routerId: 'r1', intencaoDevolvida: 'financeiro' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('4111');
  });

  it('saída sem JSON: o log registra a recusa, mas não a prosa do modelo', async () => {
    const { warn } = await classificarCom('O cliente disse que o cartão 4111 venceu.', 'meu cartão 4111 venceu');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![1]).toMatchObject({ routerId: 'r1', intencaoDevolvida: null });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('4111');
  });

  it('nome devolvido que copia dado do cliente sai mascarado e curto', async () => {
    const longo = `fale com joao@exemplo.com ${'x'.repeat(200)}`;
    const { warn } = await classificarCom(JSON.stringify({ intent: longo, confidence: 0.9 }), 'oi');
    const devolvida = (warn.mock.calls[0]![1] as { intencaoDevolvida: string }).intencaoDevolvida;
    expect(devolvida).not.toContain('joao@exemplo.com');
    expect(devolvida).toContain('[EMAIL]');
    expect(devolvida.length).toBeLessThanOrEqual(80);
  });

  it('resposta aceita não escreve nada no log', async () => {
    const { warn } = await classificarCom('{"intent":"vendas","confidence":0.9}', 'quanto custa');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('classifyIntent — provedor do classificador', () => {
  const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as never;

  it('router com provedor próprio manda llmOverride junto do modelo', async () => {
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: '{"intent":"vendas","confidence":0.9}' } });
    await classifyIntent({} as never, {} as never,
      {
        tenantId: 'o1', leadId: null, jobId: null, signal: 'quanto custa',
        router: { ...router, classifierModel: 'gpt-5-mini', classifierProvider: 'openai' },
      },
      { log: log(), runModelCall } as never);
    const call = runModelCall.mock.calls[0]![2];
    expect(call.model).toBe('gpt-5-mini');
    // Sem isto o id de modelo da OpenAI seria enviado ao provedor da ORG.
    expect(call.llmOverride).toEqual({ provider: 'openai' });
  });

  it('sem provedor próprio NÃO manda override — a organização continua decidindo', async () => {
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: '{"intent":"vendas","confidence":0.9}' } });
    await classifyIntent({} as never, {} as never,
      {
        tenantId: 'o1', leadId: null, jobId: null, signal: 'oi',
        router: { ...router, classifierProvider: null },
      },
      { log: log(), runModelCall } as never);
    expect(runModelCall.mock.calls[0]![2]).not.toHaveProperty('llmOverride');
  });
});
