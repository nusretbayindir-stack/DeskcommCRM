import { UsersClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const generateMetadata = tituloDaAba((t) => t("Usuários — Admin Plataforma"));

export default function AdminUsersPage() {
  return <UsersClient />;
}
