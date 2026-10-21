
import { ListaDeCampanhas } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Campanhas"));

export default function CampanhasPage() {
  // Auth e organização já vêm garantidas pelo layout de /app; a lista carrega
  // pela API, que confere o papel `manager` por conta própria.
  return <ListaDeCampanhas />;
}
