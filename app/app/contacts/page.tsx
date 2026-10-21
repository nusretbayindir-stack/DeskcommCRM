import { ContactsListClient } from "./_client";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Contatos"));

export default function ContactsPage() {
  return <ContactsListClient />;
}
