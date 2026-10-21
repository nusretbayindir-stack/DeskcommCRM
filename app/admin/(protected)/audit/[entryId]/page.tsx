import { AuditDetailClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

interface AuditDetailPageProps {
  params: Promise<{ entryId: string }>;
}

export const generateMetadata = tituloDaAba((t) => t("Audit Entry — Admin"));

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  const { entryId } = await params;
  return <AuditDetailClient entryId={entryId} />;
}
