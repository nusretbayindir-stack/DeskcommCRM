import { IncidentsClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Incidentes — Admin Plataforma"));

export default function AdminIncidentsPage() {
  return <IncidentsClient />;
}
