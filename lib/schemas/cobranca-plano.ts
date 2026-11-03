import { z } from "zod";

import { INTERVALOS, MOEDAS, type Moeda } from "@/lib/cobranca/vocabulario";

/**
 * O plano de cobrança da instalação (`cobranca_planos`, spec da cobrança §2.2).
 * São os mesmos limites dos CHECKs da tabela, para a recusa sair com nome antes
 * do banco. A régua é a mesma na rota e no formulário de /admin/cobranca.
 * `moeda` é BRL por default; o plano em EUR (migration 7001, só Stripe) é o
 * único com IVA e implantação — o CHECK `cobranca_planos_extras_so_em_euro`
 * e `extraForaDoEuro` dizem a mesma regra. `respostas_mes` é só a cota exibida
 * na aba Clientes: não limita nada.
 */
const INT4_MAX = 2_147_483_647;
const campos = {
  nome: z.string().trim().min(1).max(60),
  preco_cents: z.number().int().min(500, "O preço mínimo é R$ 5,00: abaixo disso o boleto não sai."),
  intervalo: z.enum(INTERVALOS),
  trial_dias: z.number().int().min(0).max(90),
  max_assentos: z.number().int().min(1).max(INT4_MAX).nullable(),
  max_canais: z.number().int().min(1).max(INT4_MAX).nullable(),
  teto_ia_usd_cents: z.number().int().min(100).max(INT4_MAX).nullable(),
  padrao_no_cadastro: z.boolean(),
  oferecido_ao_cliente: z.boolean(),
  moeda: z.enum(MOEDAS),
  iva_percentual: z
    .number()
    .min(0)
    .max(100)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, "O IVA tem no máximo duas casas decimais."),
  implantacao_cents: z.number().int().min(500, "A implantação mínima é de 500 centavos.").nullable(),
  respostas_mes: z.number().int().min(1).max(INT4_MAX).nullable(),
};

const MENSAGEM_DO_EXTRA = "IVA e implantação só existem em plano em euro.";

/**
 * O campo que fura a regra "IVA e implantação só em euro", ou null. A rota de
 * edição a aplica sobre a linha atual somada ao que chega (a edição é parcial).
 */
export function extraForaDoEuro(p: {
  moeda: Moeda;
  iva_percentual: number | string;
  implantacao_cents: number | string | null;
}): "iva_percentual" | "implantacao_cents" | null {
  if (p.moeda === "EUR") return null;
  if (Number(p.iva_percentual) !== 0) return "iva_percentual";
  if (p.implantacao_cents !== null) return "implantacao_cents";
  return null;
}

export const novoPlanoSchema = z.strictObject({
  nome: campos.nome,
  preco_cents: campos.preco_cents,
  intervalo: campos.intervalo,
  trial_dias: campos.trial_dias,
  max_assentos: campos.max_assentos.optional(),
  max_canais: campos.max_canais.optional(),
  teto_ia_usd_cents: campos.teto_ia_usd_cents.optional(),
  padrao_no_cadastro: campos.padrao_no_cadastro.optional(),
  oferecido_ao_cliente: campos.oferecido_ao_cliente.optional(),
  moeda: campos.moeda.default("BRL"),
  iva_percentual: campos.iva_percentual.default(0),
  implantacao_cents: campos.implantacao_cents.optional(),
  respostas_mes: campos.respostas_mes.optional(),
}).superRefine((v, ctx) => {
  const campo = extraForaDoEuro({ ...v, implantacao_cents: v.implantacao_cents ?? null });
  if (campo !== null) ctx.addIssue({ code: "custom", message: MENSAGEM_DO_EXTRA, path: [campo] });
});

export const edicaoDoPlanoSchema = z
  .strictObject({ ...campos, arquivado: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para mudar.");

export const COLUNAS_DO_PLANO =
  "id, nome, preco_cents, moeda, intervalo, trial_dias, max_assentos, max_canais, teto_ia_usd_cents, padrao_no_cadastro, oferecido_ao_cliente, arquivado_em, created_at, updated_at, iva_percentual, implantacao_cents, respostas_mes";
