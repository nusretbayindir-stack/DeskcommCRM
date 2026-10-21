import { UsageClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Uso & Custo — Admin Plataforma"));

export default function AdminUsagePage() {
  return <UsageClient />;
}
