import { AuditClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Audit Log — Admin"));

export default function AdminAuditPage() {
  return <AuditClient />;
}
