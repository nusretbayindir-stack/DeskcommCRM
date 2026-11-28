import { PeopleListClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Pessoas"));

export default function PeoplePage() {
  return <PeopleListClient />;
}
