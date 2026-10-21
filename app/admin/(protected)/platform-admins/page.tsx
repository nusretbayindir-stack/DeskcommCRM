import { PlatformAdminsClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Platform Admins — Admin Plataforma"));

export default function AdminPlatformAdminsPage() {
  return <PlatformAdminsClient />;
}
