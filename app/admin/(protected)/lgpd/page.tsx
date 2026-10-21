import { LgpdAdminClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("LGPD — Admin"));

export default function AdminLgpdPage() {
  return <LgpdAdminClient />;
}
