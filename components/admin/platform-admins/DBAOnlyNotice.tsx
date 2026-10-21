"use client";
import Link from "next/link";
import { Info } from "@/lib/ui/icons";
import { useT } from "@/hooks/i18n/useT";

/**
 * Os nomes que a frase cita em `<code>`, pelos marcadores que ela usa.
 *
 * A frase é UMA só, com marcadores, e não três pedaços colados em volta dos
 * `<code>`: traduzidos à parte, os pedaços saíam na ordem do português — em
 * turco o aviso vinha embaralhado (v1.85.2). Cada idioma põe o marcador onde a
 * gramática dele pede, e o nome nunca é traduzido.
 */
const NOMES_EM_CODIGO: Record<string, string> = {
  "{tabela}": "platform_admins",
  "{auditoria}": "api_audit_log",
};

export function DBAOnlyNotice() {
  const t = useT();
  const frase = t(
    "Conforme Spec 01 §3.4 T-04: adição, remoção ou alteração de {tabela} é feita exclusivamente via SQL pelo DBA, com nota explicativa em {auditoria}. Esta página é informativa e read-only — nenhum botão de modificação está disponível por design.",
  );
  return (
    <div
      role="note"
      className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900"
    >
      <Info size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-semibold">
          {t("Gerenciamento de Platform Admins é restrito ao DBA")}
        </p>
        <p className="text-sm leading-relaxed text-blue-800">
          {frase.split(/(\{tabela\}|\{auditoria\})/).map((parte, i) =>
            parte in NOMES_EM_CODIGO ? (
              <code key={i} className="rounded-md bg-blue-100 px-1 font-mono text-xs">
                {NOMES_EM_CODIGO[parte]}
              </code>
            ) : (
              parte
            ),
          )}
        </p>
        <p className="pt-1">
          <Link
            href="/runbook/platform-admin-management.md"
            className="text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
          >
            {t("Ver runbook →")}
          </Link>
        </p>
      </div>
    </div>
  );
}
