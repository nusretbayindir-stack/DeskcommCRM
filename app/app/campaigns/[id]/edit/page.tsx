
import { EditarCampanha } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Editar campanha"));

export default async function EditarCampanhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditarCampanha id={id} />;
}
