import { ImportsListClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Importações"));

export default function ImportsPage() {
  return <ImportsListClient />;
}
