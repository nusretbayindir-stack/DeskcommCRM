import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { EditorDeModelo } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Modelo de proposta"));

export default async function EditorDeModeloPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const { slug } = await params;
  return <EditorDeModelo slug={slug} />;
}
