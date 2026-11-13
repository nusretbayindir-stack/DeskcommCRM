import { describe, expect, it } from "vitest";

import fixture from "@/tests/fixtures/convites-2649-html-main.json";
import type { MarcaDeSaida } from "@/lib/branding/saida";
import { montarTemplateDeAcesso, type ModeloDeAcesso } from "@/lib/email/templates/acesso-gotrue";
import { buildInviteEmail } from "@/lib/email/templates/invite";

// Gravado contra a main antes do porte, com entradas sintéticas. A extração da
// moldura não autoriza trocar cor, fonte, texto ou idioma de quem já recebia.
const opcoes = {
  inviterName: "Ana",
  orgName: "Equipe sintética",
  role: "agent",
  acceptUrl: "https://crm.example.test/team/accept-invite/token",
  expiresAt: new Date("2026-11-01T12:00:00Z"),
  // O convite deste fork sai no idioma da empresa; em português é o da main.
  idioma: "pt-BR" as const,
};

// Fork (S2a Task 12): os moldes de acesso falam nl/fr/tr por ramo do GoTrue, então
// o texto deles muda de propósito; a moldura (fundo, fonte, logo) é conferida contra
// este mesmo fixture em `tests/unit/acesso-gotrue-no-idioma.test.ts`.
const CASOS_BYTE_A_BYTE = fixture.casos.filter((caso) => caso.tipo === "convite");

describe("limpeza dos e-mails preserva a identidade distribuída", () => {
  it.each(CASOS_BYTE_A_BYTE)("$tipo, logo $marca.logoUrl: saída byte a byte da main", (caso) => {
    const marca = caso.marca as MarcaDeSaida;
    const atual =
      caso.tipo === "convite"
        ? buildInviteEmail({ ...opcoes, marca })
        : montarTemplateDeAcesso(caso.tipo as ModeloDeAcesso, marca);
    expect(atual).toEqual(caso.esperado);
  });

  it("a URL do convite não vira atributo nem elemento HTML, e continua copiável", () => {
    const acceptUrl = 'https://crm.example.test/aceitar?a=1&b="><img src=x onerror=alert(1)>';
    const caso = fixture.casos[0];
    if (!caso) throw new Error("Falta o caso sintético de convite no fixture da main.");
    const marca = caso.marca as MarcaDeSaida;
    const { html, text } = buildInviteEmail({ ...opcoes, marca, acceptUrl });
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("a")?.getAttribute("href")).toBe(acceptUrl);
    expect(doc.querySelector("img[onerror]")).toBeNull();
    expect(doc.querySelector("span")?.textContent).toBe(acceptUrl);
    expect(text).toContain(acceptUrl);
    expect(html).toContain("&amp;b=&quot;&gt;&lt;img");
  });
});
