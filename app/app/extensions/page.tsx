import { redirect } from "next/navigation";

import { ExtensionsManager } from "@/components/extensions/ExtensionsManager";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Extensões"));

export default async function ExtensionsPage() {
  const user = await requireAuth();
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
