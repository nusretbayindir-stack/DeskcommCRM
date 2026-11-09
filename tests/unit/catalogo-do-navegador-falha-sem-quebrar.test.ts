import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O CATÁLOGO QUE NÃO CHEGA NÃO DERRUBA A TELA.
 *
 * Rede caiu, deploy trocou o arquivo no meio do caminho: o `import()` do
 * catálogo rejeita. O leitor do navegador engole a falha, deixa o registro no
 * console e declara que não há mais o que esperar — a tela abre em português
 * em vez de ficar suspensa para sempre. Um pedido explícito depois (trocar o
 * idioma) tenta de novo.
 */
vi.mock("@/lib/i18n/traducoes/tr.json", () => {
  throw new Error("rede caiu");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("o leitor do navegador quando o catálogo não chega", () => {
  it("não rejeita, registra uma vez, e para de fazer a tela esperar", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const navegador = await import("@/lib/i18n/catalogos.navegador");

    const tentativa = navegador.carregarCatalogo("tr");
    await expect(tentativa).resolves.toBeUndefined();

    expect(erro).toHaveBeenCalledTimes(1);
    expect(String(erro.mock.calls[0]?.[0])).toContain("[i18n] catálogo não carregou");
    expect(navegador.catalogoPronto("tr")).toBe(true);
    // Pronto para não suspender a tela, mas o texto NÃO está na mão: a troca
    // de idioma não pinta com isto (`useTrocaComCatalogo`).
    expect(navegador.catalogoCarregado("tr")).toBe(false);
    expect(navegador.entradaDoCatalogo("tr", "Plano atual")).toBeUndefined();

    // Um pedido explícito depois é uma tentativa nova, não a falha guardada.
    const outra = navegador.carregarCatalogo("tr");
    expect(outra).not.toBe(tentativa);
    await outra;
  });
});
