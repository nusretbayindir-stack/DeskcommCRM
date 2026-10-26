import { z } from "zod";
import { IDIOMAS } from "@/lib/i18n/idiomas";
import { interfaceSettingsSchema, interfaceTemDestino } from "@/lib/navigation/interface";
import { fusoValido } from "@/lib/tempo/fusos";

/** Mesmo vocabulário no formulário e no limite HTTP. */
export const tenantCreationFields = {
  display_name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  legal_name: z.string().max(255).optional(),
  cnpj: z.string().max(18).optional(),
  plan: z.enum(["standard", "pro", "enterprise"]),
  /** Spec da cobrança §9: com a chave `cobranca` ligada, o plano de cobrança (ausente = isenta). */
  plano_id: z.string().uuid().optional(),
  owner_interface_settings: interfaceSettingsSchema.optional(),
  owner_email: z.string().trim().email(),
  /**
   * O idioma e o fuso da empresa nova, gravados ANTES do convite do dono (que
   * sai no idioma da organização). Ausentes = os defaults do banco (`pt-BR`,
   * São Paulo), como antes. Não entram no pedido da função SQL: quem os grava é
   * `gravarIdiomaEFuso` (`lib/organizacao/sementes-no-idioma.ts`).
   */
  locale: z.enum(IDIOMAS).optional(),
  timezone: z.string().trim().max(64).refine(fusoValido, "Fuso horário desconhecido").optional(),
};
export const createTenantSchema = z
  .object({ ...tenantCreationFields, plan: tenantCreationFields.plan.default("standard") })
  .refine(
    (v) => !v.owner_interface_settings || interfaceTemDestino(v.owner_interface_settings, "admin"),
    { message: "Selecione ao menos uma área de trabalho.", path: ["owner_interface_settings"] },
  );
