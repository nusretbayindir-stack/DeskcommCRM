import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { fusoOferecidoOuPadrao } from "@/lib/tempo/fusos";

import { NewTenantForm, type PlanoParaEscolher } from "./_form";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Novo Tenant — Admin Plataforma"));
export const dynamic = "force-dynamic";

/**
 * Com a cobrança ligada, o formulário oferece os planos ativos (spec da
 * cobrança §9); desligada, é o formulário de sempre. A leitura dos planos que
 * falha LANÇA: mostrar só "Sem cobrança" criaria isentas em silêncio.
 */
export default async function NewTenantPage() {
  const admin = createAdminClient();
  const ligada = await moduloLigado(admin, "cobranca");
  let planos: PlanoParaEscolher[] = [];
  if (ligada) {
    const { data, error } = await admin
      .from("cobranca_planos")
      .select("id, nome, preco_cents, intervalo, trial_dias")
      .is("arquivado_em", null)
      .order("nome");
    if (error) throw new Error(`planos de cobrança: leitura falhou (${error.code})`);
    planos = (data ?? []) as PlanoParaEscolher[];
  }
  // O fuso padrão da empresa nova é o da organização de quem cria. Resolvido
  // aqui, no servidor: o fuso do navegador divergiria do render do servidor.
  const usuario = await loadAuthUser();
  const ativa = usuario ? await resolveActiveOrg(usuario) : null;
  return <NewTenantForm cobranca={{ ligada, planos }} fusoInicial={fusoOferecidoOuPadrao(ativa?.timezone)} />;
}
