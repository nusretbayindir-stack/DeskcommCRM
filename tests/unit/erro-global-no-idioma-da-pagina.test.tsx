import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * U49 — A PÁGINA DE ERRO GLOBAL FALA A LÍNGUA DA PÁGINA QUE CAIU.
 *
 * Ela escolhia o idioma só pelo navegador (`navigator.languages`). Na Bélgica,
 * quem usa o navegador em inglês vê o produto inteiro em holandês (o servidor
 * escreve `<html lang="nl">` — a preferência da pessoa, a organização, o país
 * da instalação) e, só nesta página, português.
 *
 * Ordem: o `<html lang>` que o servidor escreveu → `navigator.languages` → o
 * padrão. A preferência salva da pessoa não é legível no navegador (vai para o
 * `user_metadata` pelo servidor); ela já chega aqui DENTRO do `<html lang>`.
 *
 * A armadilha: esta página desenha o próprio `<html lang={idioma}>`. Depois do
 * primeiro commit, `document.documentElement.lang` já é o estado inicial
 * (`pt-BR`). O valor tem de ser lido ANTES — e, quando o `<html>` é o desta
 * própria página (o servidor a desenhou porque o layout raiz caiu), o `lang`
 * dele não diz nada e vale o navegador.
 */
const TEXTOS: Record<string, Record<string, string>> = {
  nl: { "Algo deu errado": "Er is iets misgegaan" },
  fr: { "Algo deu errado": "Une erreur s'est produite" },
  tr: { "Algo deu errado": "Bir şeyler ters gitti" },
};

vi.mock("@sentry/nextjs", () => ({ captureException: () => "evento-de-teste" }));
vi.mock("@/lib/i18n/catalogos", () => ({
  IDIOMAS_COM_CATALOGO: ["tr", "nl", "fr"],
  entradaDoCatalogo: (idioma: string, texto: string) => TEXTOS[idioma]?.[texto],
  catalogoPronto: () => true,
  catalogoCarregado: () => true,
  carregarCatalogo: () => Promise.resolve(),
}));

import GlobalError from "@/app/global-error";

const linguasDoNavegador = (lista: string[]) => {
  Object.defineProperty(window.navigator, "languages", { value: lista, configurable: true });
};

const abrir = async () => {
  render(<GlobalError error={new Error("caiu")} reset={() => {}} />);
  await act(async () => {});
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  const html = document.documentElement;
  for (const nome of html.getAttributeNames()) html.removeAttribute(nome);
});

describe("a página de erro global no idioma da página", () => {
  it("⭐ o servidor escreveu nl, o navegador é inglês: holandês", async () => {
    document.documentElement.lang = "nl";
    linguasDoNavegador(["en-US", "en"]);
    await abrir();
    expect(screen.getByText("Er is iets misgegaan")).toBeTruthy();
  });

  it("o <html lang> vence o navegador mesmo quando o navegador é servido", async () => {
    document.documentElement.lang = "fr";
    linguasDoNavegador(["tr-TR", "tr"]);
    await abrir();
    expect(screen.getByText("Une erreur s'est produite")).toBeTruthy();
  });

  it("etiqueta regional (nl-BE) vale como o idioma", async () => {
    document.documentElement.lang = "nl-BE";
    linguasDoNavegador(["en-US"]);
    await abrir();
    expect(screen.getByText("Er is iets misgegaan")).toBeTruthy();
  });

  it("sem <html lang>, o navegador decide (como antes)", async () => {
    linguasDoNavegador(["fr-BE", "fr"]);
    await abrir();
    expect(screen.getByText("Une erreur s'est produite")).toBeTruthy();
  });

  it("o <html> que é desta própria página não conta: o navegador decide", async () => {
    // O servidor desenhou ESTA página (o layout raiz caiu): o `lang` é o padrão
    // dela, não uma escolha de ninguém.
    document.documentElement.lang = "pt-BR";
    document.documentElement.setAttribute("data-erro-global", "");
    linguasDoNavegador(["tr-TR"]);
    await abrir();
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();
  });

  it("os botões de idioma continuam trocando", async () => {
    document.documentElement.lang = "nl";
    linguasDoNavegador(["en-US"]);
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "TR" }));
    await act(async () => {});
    expect(screen.getByText("Bir şeyler ters gitti")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PT" }));
    await act(async () => {});
    expect(screen.getByText("Algo deu errado")).toBeTruthy();
  });
});
