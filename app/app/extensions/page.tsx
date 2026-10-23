import { redirect } from "next/navigation";

import { ExtensionsManager } from "@/components/extensions/ExtensionsManager";
import { exigirProvaDeMfa, mfaEmDividaEstrita, requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Extensões"));

export default async function ExtensionsPage() {
  const user = await requireAuth();
  // As ações da instalação aqui exigem o código provado nesta sessão
  // (`regraPlatformAdmin`); quem as tem vai ao código antes, como no `/admin`.
  if (user.is_platform_admin && !user.support) await exigirProvaDeMfa(mfaEmDividaEstrita);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <ExtensionsManager
      key={activeOrg.orgId}
      organizationId={activeOrg.orgId}
      actorId={user.id}
      supportMode={Boolean(user.support)}
    />
  );
}
