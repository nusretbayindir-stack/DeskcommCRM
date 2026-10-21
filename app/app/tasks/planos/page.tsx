
import { PlanosDeTarefa } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Planos de tarefa"));

export default function PaginaDePlanosDeTarefa() {
  return <PlanosDeTarefa />;
}
