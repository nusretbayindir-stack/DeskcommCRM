import { act, startTransition } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdiomaProvider, useAplicarIdioma, useT } from "@/lib/i18n/IdiomaProvider";

/**
 * O CATÁLOGO CHEGA DEPOIS — E A TELA NÃO PISCA EM PORTUGUÊS.
 *
 * No navegador, o catálogo do idioma é baixado à parte (`catalogos.navegador.ts`).
 * O servidor já mandou o HTML traduzido; se a hidratação rodasse antes de o
 * catálogo chegar, `traduzir` cairia no português e a tela piscaria. Aqui o
 * catálogo é controlado à mão: chega quando o teste manda, e "falha" chegando
 * sem entradas, que é o contrato do leitor (nunca rejeita).
 */
const controle = vi.hoisted(() => ({
  prontos: new Set<string>(),
  semEntradas: new Set<string>(),
  pendentes: new Map<string, { promessa: Promise<void>; resolver: () => void }>(),
  TURCO: { "Plano atual": "Mevcut plan" } as Record<string, string>,
}));

vi.mock("@/lib/i18n/catalogos", () => ({
  IDIOMAS_COM_CATALOGO: ["tr"],
  entradaDoCatalogo: (idioma: string, texto: string) =>
    idioma === "tr" && controle.prontos.has("tr") && !controle.semEntradas.has("tr")
      ? controle.TURCO[texto]
      : undefined,
  catalogoPronto: (idioma: string) => idioma !== "tr" || controle.prontos.has(idioma),
  carregarCatalogo: (idioma: string) => {
    if (idioma !== "tr" || controle.prontos.has(idioma)) return Promise.resolve();
    const emCurso = controle.pendentes.get(idioma);
    if (emCurso) return emCurso.promessa;
    let resolver = () => {};
    const promessa = new Promise<void>((r) => {
      resolver = r;
    });
    controle.pendentes.set(idioma, { promessa, resolver });
    return promessa;
  },
}));

/** O catálogo "chega": com as entradas, ou vazio (a falha que o leitor engole). */
async function chegar(idioma: string, { comEntradas = true } = {}) {
  if (!comEntradas) controle.semEntradas.add(idioma);
  controle.prontos.add(idioma);
  const pendente = controle.pendentes.get(idioma);
  controle.pendentes.delete(idioma);
  await act(async () => {
    pendente?.resolver();
    await pendente?.promessa;
  });
}

function Tela() {
  const t = useT();
  const aplicar = useAplicarIdioma();
  return (
    <>
      <p>{t("Plano atual")}</p>
      <button type="button" onClick={() => aplicar("tr")}>
        tr
      </button>
      <button type="button" onClick={() => aplicar("es")}>
        es
      </button>
    </>
  );
}

const texto = (raiz: HTMLElement) => raiz.querySelector("p")?.textContent;
const clicar = (raiz: HTMLElement, rotulo: string) =>
  act(async () => {
    [...raiz.querySelectorAll("button")].find((b) => b.textContent === rotulo)?.click();
  });

let raiz: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  controle.prontos.clear();
  controle.semEntradas.clear();
  controle.pendentes.clear();
  raiz = document.createElement("div");
  document.body.appendChild(raiz);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  raiz.remove();
});

describe("a hidratação espera o catálogo do idioma", () => {
  it("o HTML do servidor fica intacto até o catálogo chegar, e sem erro de hidratação", async () => {
    controle.prontos.add("tr");
    raiz.innerHTML = renderToString(
      <IdiomaProvider locale="tr">
        <Tela />
      </IdiomaProvider>,
    );
    expect(texto(raiz)).toBe("Mevcut plan");

    // No navegador o catálogo ainda não chegou.
    controle.prontos.delete("tr");
    const erros: unknown[] = [];
    await act(async () => {
      startTransition(() => {
        root = hydrateRoot(
          raiz,
          <IdiomaProvider locale="tr">
            <Tela />
          </IdiomaProvider>,
          { onRecoverableError: (erro) => erros.push(erro) },
        );
      });
    });
    expect(texto(raiz)).toBe("Mevcut plan");

    await chegar("tr");
    expect(texto(raiz)).toBe("Mevcut plan");
    expect(erros).toEqual([]);
  });
});

describe("a troca de idioma pinta só com o catálogo na mão", () => {
  it("fica no idioma atual enquanto o turco não chega, e troca quando chega", async () => {
    root = createRoot(raiz);
    await act(async () =>
      root?.render(
        <IdiomaProvider locale="es">
          <Tela />
        </IdiomaProvider>,
      ),
    );
    expect(texto(raiz)).toBe("Plan actual");

    await clicar(raiz, "tr");
    await clicar(raiz, "tr");
    expect(texto(raiz)).toBe("Plan actual");

    await chegar("tr");
    expect(texto(raiz)).toBe("Mevcut plan");
  });

  it("o último pedido vence: voltar ao espanhol antes de o turco chegar não é desfeito por ele", async () => {
    root = createRoot(raiz);
    await act(async () =>
      root?.render(
        <IdiomaProvider locale="es">
          <Tela />
        </IdiomaProvider>,
      ),
    );

    await clicar(raiz, "tr");
    await clicar(raiz, "es");
    await chegar("tr");
    expect(texto(raiz)).toBe("Plan actual");
  });

  it("catálogo que não veio: a tela abre em português em vez de esperar para sempre", async () => {
    root = createRoot(raiz);
    await act(async () => {
      startTransition(() => {
        root?.render(
          <IdiomaProvider locale="tr">
            <Tela />
          </IdiomaProvider>,
        );
      });
    });
    await chegar("tr", { comEntradas: false });
    expect(texto(raiz)).toBe("Plano atual");
  });
});
