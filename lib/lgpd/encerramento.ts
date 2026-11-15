/**
 * U53: regras puras do encerramento do pedido do titular pelo admin.
 *
 * Duas saídas, e só duas: "entregue_manualmente" (o relatório foi levado ao
 * titular por fora, a partir de `pending_review`) e "encerrado" (o pedido não
 * segue, com motivo, a partir de `received`). Sem banco e sem I/O, para a rota
 * e a tela dividirem a mesma regra.
 */
import { z } from "zod";

/** Marca gravada em `error_message` quando quem fechou foi o responsável. */
export const ENCERRADO_PELO_RESPONSAVEL = "encerrado_pelo_responsavel";

export const MOTIVOS_DE_ENCERRAMENTO = [
  "aberto_por_engano",
  "duplicado",
  "retirado_pelo_titular",
  "identidade_nao_confirmada",
  "outro",
] as const;

export type MotivoDeEncerramento = (typeof MOTIVOS_DE_ENCERRAMENTO)[number];

const MOTIVOS_QUE_PEDEM_NOTA: readonly MotivoDeEncerramento[] = [
  "identidade_nao_confirmada",
  "outro",
];

const nota = z.string().trim().max(500).optional();

export const encerramentoSchema = z
  .discriminatedUnion("acao", [
    z.object({ acao: z.literal("entregue_manualmente"), nota }),
    z.object({
      acao: z.literal("encerrado"),
      motivo_codigo: z.enum(MOTIVOS_DE_ENCERRAMENTO),
      nota,
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.acao !== "encerrado" || !MOTIVOS_QUE_PEDEM_NOTA.includes(v.motivo_codigo)) return;
    const tamanho = v.nota?.length ?? 0;
    if (tamanho < 10 || tamanho > 500) {
      ctx.addIssue({
        code: "custom",
        path: ["nota"],
        message: "A nota deve ter entre 10 e 500 caracteres para este motivo.",
      });
    }
  });

export type Encerramento = z.infer<typeof encerramentoSchema>;

/** O pedido foi fechado pelo responsável (e não por falha do worker). */
export function encerradoPeloResponsavel(p: {
  status: string;
  error_message: string | null;
}): boolean {
  return p.status === "failed" && p.error_message === ENCERRADO_PELO_RESPONSAVEL;
}
