
import { ConfiguracaoDeCampanhas } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Configuração de campanhas"));

export default function ConfiguracaoDeCampanhasPage() {
  return <ConfiguracaoDeCampanhas />;
}
