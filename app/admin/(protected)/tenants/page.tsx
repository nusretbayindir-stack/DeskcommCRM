import { TenantsClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Tenants — Admin Plataforma"));

export default function AdminTenantsPage() {
  return <TenantsClient />;
}
