import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DOIS LEITORES DE CATÁLOGO, UM CONTRATO.
 *
 * O servidor e o worker leem `catalogos.ts` (tudo na memória); o pacote do
 * navegador troca o módulo por `catalogos.navegador.ts` (cada idioma baixado à
 * parte) pelo `resolveAlias` do `next.config.ts`. Quem importa não sabe qual
 * dos dois recebeu — por isso os nomes têm de ser os mesmos, e o do navegador
 * não pode trazer catálogo nenhum de forma estática.
 */
const RAIZ = join(__dirname, "..", "..");
const FONTE_DO_NAVEGADOR = readFileSync(join(RAIZ, "lib", "i18n", "catalogos.navegador.ts"), "utf8");

beforeEach(() => {
  vi.resetModules();
});

describe("os dois leitores de catálogo", () => {
  it("expõem os mesmos nomes", async () => {
    const servidor = await import("@/lib/i18n/catalogos");
    const navegador = await import("@/lib/i18n/catalogos.navegador");
    expect(Object.keys(navegador).sort()).toEqual(Object.keys(servidor).sort());
  });

  it("conhecem os mesmos idiomas com catálogo", async () => {
    // Um idioma que o servidor traduz e o navegador não sabe baixar: o HTML
    // chega traduzido, a hidratação pinta em português, o React reclama e a
    // tela fica em português — e o pacote não acusa nada, porque catálogo
    // ausente não é violação. O tipo do mapa de carregadores é parcial, então
    // só este teste pega o esquecimento.
    const servidor = await import("@/lib/i18n/catalogos");
    const navegador = await import("@/lib/i18n/catalogos.navegador");
    expect([...navegador.IDIOMAS_COM_CATALOGO].sort()).toEqual([...servidor.IDIOMAS_COM_CATALOGO].sort());
  });

  it("o do navegador só busca catálogo sob demanda, nunca com import estático", () => {
    expect(FONTE_DO_NAVEGADOR).not.toMatch(/\bfrom\s*["'][^"']*traducoes\//);
    expect(FONTE_DO_NAVEGADOR).toMatch(/import\(\s*["']\.\/traducoes\/tr\.json["']\s*\)/);
  });

  it("no servidor não há o que esperar", async () => {
    const servidor = await import("@/lib/i18n/catalogos");
    expect(servidor.catalogoPronto("tr")).toBe(true);
    expect(servidor.catalogoCarregado("tr")).toBe(true);
    await expect(servidor.carregarCatalogo("tr")).resolves.toBeUndefined();
    expect(servidor.entradaDoCatalogo("tr", "Plano atual")).toBe("Mevcut plan");
  });
});

describe("o leitor do navegador", () => {
  it("o turco só existe depois de baixado, e o pedido repetido é o mesmo", async () => {
    const navegador = await import("@/lib/i18n/catalogos.navegador");
    expect(navegador.catalogoPronto("tr")).toBe(false);
    expect(navegador.catalogoCarregado("tr")).toBe(false);
    expect(navegador.entradaDoCatalogo("tr", "Plano atual")).toBeUndefined();

    const primeiro = navegador.carregarCatalogo("tr");
    expect(navegador.carregarCatalogo("tr")).toBe(primeiro);
    await primeiro;

    expect(navegador.catalogoPronto("tr")).toBe(true);
    expect(navegador.catalogoCarregado("tr")).toBe(true);
    expect(navegador.entradaDoCatalogo("tr", "Plano atual")).toBe("Mevcut plan");
  });

  it("idioma sem catálogo (português, espanhol) está sempre pronto", async () => {
    const navegador = await import("@/lib/i18n/catalogos.navegador");
    expect(navegador.catalogoPronto("pt-BR")).toBe(true);
    expect(navegador.catalogoPronto("es")).toBe(true);
    expect(navegador.catalogoCarregado("pt-BR")).toBe(true);
    expect(navegador.catalogoCarregado("es")).toBe(true);
    await expect(navegador.carregarCatalogo("es")).resolves.toBeUndefined();
  });
});
