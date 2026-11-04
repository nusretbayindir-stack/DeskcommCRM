/**
 * O ACEITE DO RISCO DE CONECTAR UM NÚMERO NOVO POR QR.
 *
 * A conexão por QR não é o caminho oficial da Meta: o WhatsApp pode restringir ou
 * encerrar o número. Quem compra o serviço aceita esse risco na tela (cláusula 9 do
 * contrato), e o aceite fica no audit, que não se apaga.
 *
 * A exigência mora em `connectWahaChannel`, e não só na tela: aba velha e chamada
 * direta à API não passaram pelo aviso. Reconectar e parear de novo um canal que já
 * existe não passam por aqui.
 *
 * Este módulo também roda no navegador: o cliente monta o corpo com `corpoDoRiscoQr`
 * e o servidor lê com `lerRiscoDoQr`, para os dois lados não divergirem.
 */
import { z } from "zod";

/** Mude quando o texto do aviso mudar de forma relevante: o audit guarda qual foi aceito. */
export const VERSAO_DO_AVISO_QR = "2026-11-04";

export type OrigemDoRiscoQr = "onboarding" | "conexoes";

export interface RiscoDoQrAceito {
  aceito: true;
  versao: string;
  origem: OrigemDoRiscoQr;
}

const corpoSchema = z.object({
  risco_qr: z.object({
    aceito: z.literal(true),
    // O valor vem do cliente e vai para o audit, que é append-only: tem teto.
    versao: z.string().trim().min(1).max(40),
  }),
});

/** O aceite que veio no corpo da requisição, ou `null`. A origem é de quem chama, nunca do corpo. */
export function lerRiscoDoQr(corpo: unknown, origem: OrigemDoRiscoQr): RiscoDoQrAceito | null {
  const lido = corpoSchema.safeParse(corpo);
  return lido.success ? { aceito: true, versao: lido.data.risco_qr.versao, origem } : null;
}

/** O corpo que o cliente envia depois que a pessoa aceita o aviso. */
export function corpoDoRiscoQr(): { risco_qr: { aceito: true; versao: string } } {
  return { risco_qr: { aceito: true, versao: VERSAO_DO_AVISO_QR } };
}
