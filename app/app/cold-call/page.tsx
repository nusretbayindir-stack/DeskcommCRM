import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

import { ColdCall } from "./_client";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Cold Call"));

export default function ColdCallPage() {
  return <ColdCall />;
}
