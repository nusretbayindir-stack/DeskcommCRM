import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * A PÁGINA DE ERRO GLOBAL TAMBÉM ESPERA O CATÁLOGO.
 *
 * Ela roda sem provider (o layout raiz caiu) e traduz com `traduzir` direto.
 * No navegador o catálogo do idioma é baixado à parte: o botão de idioma só
 * pinta depois de ele chegar, senão a página trocaria para o português.
 */
const controle = vi.hoisted(() => ({
  pronto: false,
  resolver: () => {},
  TURCO: { "Algo deu errado": "Bir şeyler ters gitti" } as Record<string, string>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: () => "evento-de-teste" }));
vi.mock("@/lib/i18n/catalogos", () => ({
  IDIOMAS_COM_CATALOGO: ["tr"],
  entradaDoCatalogo: (idioma: string, texto: string) =>
    idioma === "tr" && controle.pronto ? controle.TURCO[texto] : undefined,
  catalogoPronto: (idioma: string) => idioma !== "tr" || controle.pronto,
  carregarCatalogo: (idioma: string) =>
    idioma !== "tr" || controle.pronto
      ? Promise.resolve()
      : new Promise<void>((r) => {
          controle.resolver = () => {
            controle.pronto = true;
            r();
          };
        }),
}));

import GlobalError from "@/app/global-error";

describe("a página de erro global", () => {
  it("só troca para o turco depois que o catálogo chega", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={new Error("caiu")} reset={() => {}} />);
    expect(screen.getByText("Algo deu errado")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "TR" }));
    expect(screen.getByText("Algo deu errado")).toBeTruthy();

    await act(async () => {
      controle.resolver();
    });
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();
  });
});
