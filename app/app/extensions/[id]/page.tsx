import { redirect } from "next/navigation";

import { ExtensionGuide } from "@/components/extensions/ExtensionGuide";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Guia da extensão"));

export default async function ExtensionGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ card?: string | string[] }>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const selectedCardId = typeof query.card === "string" ? query.card : undefined;

  return (
    <ExtensionGuide
      key={`${activeOrg.orgId}:${id}`}
      organizationId={activeOrg.orgId}
      installationId={id}
      selectedCardId={selectedCardId}
    />
  );
}
