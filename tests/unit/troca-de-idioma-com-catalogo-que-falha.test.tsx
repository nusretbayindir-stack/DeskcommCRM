import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O CATÁLOGO QUE NÃO VEIO NÃO TROCA A TELA PARA O PORTUGUÊS.
 *
 * A aba foi aberta antes de um deploy; a pessoa está em espanhol e aperta TR.
 * O arquivo do catálogo antigo já não existe e o `import()` falha. A tela fica
 * no idioma em que está — sem passar pelo português — e o console guarda o
 * motivo. Um pedido seguinte do mesmo idioma tenta de novo.
 *
 * Aqui roda o leitor do NAVEGADOR de verdade (`catalogos.navegador.ts`, o que o
 * `resolveAlias` entrega ao pacote); só a chegada do JSON é controlada.
 */
const controle = vi.hoisted(() => ({
  falhar: false,
  tentativas: 0,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: () => "evento-de-teste" }));

let raiz: HTMLDivElement;
let root: Root | undefined;
let erroNoConsole: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // O leitor guarda o que baixou no módulo. Cada caso começa com um leitor
  // novo: `resetModules` sozinho não basta, o resultado de um `vi.mock` fica
  // guardado; registrar de novo com `doMock` o descarta.
  vi.resetModules();
  vi.doMock("@/lib/i18n/catalogos", async () => await import("@/lib/i18n/catalogos.navegador"));
  vi.doMock("@/lib/i18n/traducoes/tr.json", async () => {
    controle.tentativas += 1;
    if (controle.falhar) throw new Error("o arquivo do catálogo sumiu no deploy");
    return { default: { "Plano atual": "Mevcut plan", "Algo deu errado": "Bir şeyler ters gitti" } };
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  controle.falhar = false;
  controle.tentativas = 0;
  erroNoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
  raiz = document.createElement("div");
  document.body.appendChild(raiz);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  raiz.remove();
  vi.restoreAllMocks();
});

const clicar = (rotulo: string) =>
  act(async () => {
    [...raiz.querySelectorAll("button")].find((b) => b.textContent === rotulo)?.click();
  });

/** Espera a tentativa EM CURSO do turco terminar (o leitor devolve a mesma promessa). */
async function terminarTentativa() {
  const leitor = await import("@/lib/i18n/catalogos");
  await act(async () => {
    await leitor.carregarCatalogo("tr");
  });
}

async function montarProvider(locale: string) {
  const { IdiomaProvider, useAplicarIdioma, useT } = await import("@/lib/i18n/IdiomaProvider");
  const pinturas: string[] = [];
  function Tela() {
    const t = useT();
    const aplicar = useAplicarIdioma();
    const texto = t("Plano atual");
    // Um registro por commit: o português de passagem apareceria aqui mesmo
    // que a tela voltasse ao espanhol logo depois.
    useLayoutEffect(() => {
      pinturas.push(texto);
    });
    return (
      <>
        <p>{texto}</p>
        <button type="button" onClick={() => aplicar("tr")}>
          tr
        </button>
      </>
    );
  }
  root = createRoot(raiz);
  await act(async () =>
    root?.render(
      <IdiomaProvider locale={locale}>
        <Tela />
      </IdiomaProvider>,
    ),
  );
  return pinturas;
}

const texto = () => raiz.querySelector("p")?.textContent;

describe("o seletor com o catálogo que não veio", () => {
  it("dois cliques em TR com o catálogo falhando: fica em espanhol em todo commit, uma tentativa, um erro", async () => {
    controle.falhar = true;
    const pinturas = await montarProvider("es");
    expect(texto()).toBe("Plan actual");

    await clicar("tr");
    await clicar("tr");
    await terminarTentativa();

    expect(texto()).toBe("Plan actual");
    expect(pinturas).not.toContain("Plano atual");
    expect(controle.tentativas).toBe(1);
    expect(erroNoConsole).toHaveBeenCalledTimes(1);
  });

  it("depois da falha, pedir o turco de novo tenta de novo e pinta quando chega", async () => {
    controle.falhar = true;
    const pinturas = await montarProvider("es");
    await clicar("tr");
    await terminarTentativa();
    expect(texto()).toBe("Plan actual");

    controle.falhar = false;
    await clicar("tr");
    await terminarTentativa();

    expect(texto()).toBe("Mevcut plan");
    expect(controle.tentativas).toBe(2);
    expect(pinturas).not.toContain("Plano atual");
  });
});

describe("a página de erro global com o catálogo que não veio", () => {
  afterEach(() => {
    cleanup();
  });

  it("TR com o catálogo falhando fica no idioma atual; o clique seguinte tenta de novo", async () => {
    const { traduzir } = await import("@/lib/i18n/dicionario");
    const { default: GlobalError } = await import("@/app/global-error");
    // Ela desenha o próprio `<html>` e `<body>`, e o React os põe nos do
    // documento: o título se lê no documento, não no contêiner do `render`.
    render(<GlobalError error={new Error("caiu")} reset={() => {}} />);
    const botao = (rotulo: string) => screen.getByRole("button", { name: rotulo });
    const titulo = () => document.querySelector("h1")?.textContent;
    const emEspanhol = traduzir("Algo deu errado", "es");

    await act(async () => {
      fireEvent.click(botao("ES"));
    });
    expect(titulo()).toBe(emEspanhol);

    controle.falhar = true;
    await act(async () => {
      fireEvent.click(botao("TR"));
    });
    await terminarTentativa();
    expect(titulo()).toBe(emEspanhol);
    expect(document.documentElement.lang).toBe("es");

    controle.falhar = false;
    await act(async () => {
      fireEvent.click(botao("TR"));
    });
    await terminarTentativa();
    expect(titulo()).toBe("Bir şeyler ters gitti");
  });
});
