import { CompaniesListClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Empresas"));

export default function CompaniesPage() {
  return <CompaniesListClient />;
}
