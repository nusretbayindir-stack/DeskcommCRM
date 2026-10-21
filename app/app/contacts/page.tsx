import { ContactsListClient } from "./_client";
import { env } from "@/lib/env";
import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

export const dynamic = "force-dynamic";
export const generateMetadata = tituloDaAba((t) => t("Contatos"));

export default function ContactsPage() {
  // A Nuvemshop só aparece na tela com a loja ligada — a régua do onboarding.
  return <ContactsListClient lojaLigada={env.NUVEMSHOP_ENABLED} />;
}
