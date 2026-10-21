import { UserDetailClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Detalhe de Usuário — Admin Plataforma"));

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetailClient id={id} />;
}
