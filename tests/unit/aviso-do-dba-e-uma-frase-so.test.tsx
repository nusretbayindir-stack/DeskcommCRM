/**
 * O AVISO DO DBA (Admin › Platform Admins) É UMA FRASE SÓ, NA ORDEM DO IDIOMA.
 *
 * Medido na v1.85.2 com o admin em turco: o aviso saía embaralhado em volta dos
 * nomes `platform_admins` e `api_audit_log`. A frase era três pedaços
 * traduzidos à parte, colados em volta de dois `<code>` — e a ordem do
 * português não é a do turco. Com a frase inteira e os nomes como marcadores,
 * cada idioma põe o nome onde a gramática dele pede.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DBAOnlyNotice } from "@/components/admin/platform-admins/DBAOnlyNotice";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

function aviso(idioma: string) {
  const { container } = render(
    <IdiomaProvider locale={idioma}>
      <DBAOnlyNotice />
    </IdiomaProvider>,
  );
  const paragrafo = [...container.querySelectorAll("p")].find((p) => p.querySelector("code"));
  return {
    texto: paragrafo?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    codigos: [...(paragrafo?.querySelectorAll("code") ?? [])].map((c) => c.textContent?.trim()),
  };
}

describe("o aviso de que só o DBA muda platform_admins", () => {
  it("em português, a tela de sempre, com os dois nomes em <code>", () => {
    const { texto, codigos } = aviso("pt-BR");
    expect(texto).toBe(
      "Conforme Spec 01 §3.4 T-04: adição, remoção ou alteração de platform_admins é feita exclusivamente via SQL pelo DBA, com nota explicativa em api_audit_log. Esta página é informativa e read-only — nenhum botão de modificação está disponível por design.",
    );
    expect(codigos).toEqual(["platform_admins", "api_audit_log"]);
  });

  it("em turco, o nome da tabela fica onde o turco o põe", () => {
    const { texto, codigos } = aviso("tr");
    expect(texto).toContain("platform_admins tablosuna");
    expect(texto).toContain("api_audit_log içine");
    expect(texto).not.toContain("şunun");
    expect(codigos).toEqual(["platform_admins", "api_audit_log"]);
  });
});
