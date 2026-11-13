"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Rotulos = { nl: string; fr: string; tr: string };

/**
 * O "Voltar" do topo das páginas legais. O layout não recebe `?lang=` da página,
 * então o rótulo seguia só o navegador: quem abria `?lang=tr` lia "Terug". Aqui
 * o parâmetro decide — mas só onde a página também o obedece (`aceitaLang`; as
 * páginas legais o obedecem sempre desde a S2a Task 15); senão vale o `padrao`.
 */
function Link_({ padrao, rotulos, aceitaLang }: { padrao: string; rotulos: Rotulos; aceitaLang: boolean }) {
  const lang = useSearchParams().get("lang");
  const rotulo = aceitaLang && (lang === "nl" || lang === "fr" || lang === "tr") ? rotulos[lang] : padrao;
  return (
    <Link href="/login" className="text-sm underline underline-offset-2">
      {rotulo}
    </Link>
  );
}

export function VoltarDaPaginaLegal(props: { padrao: string; rotulos: Rotulos; aceitaLang: boolean }) {
  return (
    <Suspense
      fallback={
        <Link href="/login" className="text-sm underline underline-offset-2">
          {props.padrao}
        </Link>
      }
    >
      <Link_ {...props} />
    </Suspense>
  );
}
