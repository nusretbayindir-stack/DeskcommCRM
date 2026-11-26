import type { ReactNode } from "react";

import { tituloDaAba } from "@/lib/i18n/titulo-da-aba";

// U43 (fork): layout só de título — a tela embaixo herda o nome da aba e
// renderiza igual. Ver tests/unit/toda-tela-do-app-tem-titulo-na-aba.test.ts.
export const generateMetadata = tituloDaAba((t) => t("Funis"));

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
