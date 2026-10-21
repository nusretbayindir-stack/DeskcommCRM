import { DashboardClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Dashboard — Admin Plataforma"));

export default function AdminDashboardPage() {
  return <DashboardClient />;
}
