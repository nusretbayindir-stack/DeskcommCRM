import type { ToolSet } from 'ai';

/**
 * As ferramentas que falam com o cliente: cada chamada vira mensagem física no
 * WhatsApp e avança o `seq` do turno.
 */
export const FERRAMENTAS_QUE_ENVIAM = ['send_message', 'send_template'] as const;

type AnyExecute = (input: unknown, options: unknown) => unknown;
interface WrappableTool {
  execute?: AnyExecute;
}

/**
 * Envios de uma chamada de modelo saem na ORDEM DE CHEGADA, um depois do outro.
 *
 * O SDK executa as tool calls de um mesmo passo juntas (`Promise.all`) e na
 * ordem em que o modelo as escreveu. Três `send_message` no mesmo passo corriam
 * cada um pela própria cadeia `before_send` (gates com chamada de modelo, de
 * duração variável) e saía primeiro quem terminava primeiro — a pausa humana,
 * paga só pela primeira chamada, deixava as outras passarem na frente dela.
 * Medido ao vivo em 2026-10-30: a 2ª parte de uma resposta chegou antes da 1ª.
 *
 * Aqui cada envio só começa depois que o anterior TERMINOU, com sucesso ou com
 * falha (um envio que falhou não trava o seguinte; o erro volta a quem chamou).
 * As ferramentas de leitura não entram na fila e seguem em paralelo. A ordem
 * das chaves não muda: o prefixo do cache de prompt depende dela.
 *
 * Tem de ser o envoltório MAIS EXTERNO (`run-model-call.ts`, por fora de
 * `guardServiceTools`): a guarda consulta o banco antes de cada envio, e uma
 * fila por dentro dela receberia as chamadas na ordem em que as consultas
 * voltaram, não na do modelo.
 *
 * Estado 100% no closure desta chamada: uma fila por chamada de modelo — o envio
 * de uma conversa nunca espera o de outra.
 */
export function enviosEmOrdemDeChegada(tools: ToolSet | undefined): ToolSet | undefined {
  if (!tools) return tools;
  let fila: Promise<unknown> = Promise.resolve();
  const envolvidas: ToolSet = { ...tools };
  for (const nome of FERRAMENTAS_QUE_ENVIAM) {
    const def = tools[nome];
    if (def === undefined) continue;
    const tool = def as WrappableTool;
    if (tool.execute === undefined) continue;
    const execute = tool.execute.bind(def) as AnyExecute;
    envolvidas[nome] = {
      ...def,
      execute: (input: unknown, options: unknown): Promise<unknown> => {
        const vez = fila.then(() => execute(input, options));
        fila = vez.catch(() => undefined);
        return vez;
      },
    } as typeof def;
  }
  return envolvidas;
}
