/**
 * VISITANTE SEM IDIOMA CONHECIDO, NUMA INSTALAÇÃO BELGA: HOLANDÊS, NÃO PORTUGUÊS.
 *
 * ─── O defeito (S2a, decisão D6) ────────────────────────────────────────────
 *
 * `idiomaDoVisitante` tinha três degraus: preferência salva → `Accept-Language`
 * → pt-BR. Numa instalação na Bélgica, quem abre o login com o navegador em
 * inglês (comum em escritório belga) via a tela em PORTUGUÊS — uma língua que
 * ninguém ali lê. O degrau novo fica entre o navegador e o padrão: o idioma do
 * país da instalação (`PAIS_DA_INSTALACAO` → `perfilDoPais(...).idioma`), que
 * na Bélgica é `nl-BE` → `nl`.
 *
 * ─── O que se guarda ────────────────────────────────────────────────────────
 *
 *   - BE + navegador que o produto não serve (en-US) ou sem cabeçalho → nl;
 *   - BE + navegador que o produto serve (fr-BE, pt-BR) → o do navegador: o
 *     país é o ÚLTIMO recurso, não passa por cima de um sinal melhor;
 *   - PT, Brasil (sem declaração) → pt-BR, como antes: nenhum outro país muda;
 *   - a configuração que FALHA ao ser lida → pt-BR, nunca uma tela quebrada;
 *   - a preferência salva vence sempre, e nela o país nem é consultado;
 *   - o país só é lido quando o navegador não casou: o login é a tela mais
 *     aberta do produto, e uma leitura de banco por visita sem necessidade é
 *     custo sem resposta.
 *
 * O dublê está na leitura da configuração (`valorDaInstalacao`, a fronteira com
 * o banco); `perfilDoPais` e `idiomaDoTexto` rodam de verdade.
 *
 * Sabotagem que confirma a guarda: tirar o degrau do país deixa vermelhos os
 * dois casos de nl; ler o país antes do navegador deixa vermelhos fr-BE e
 * pt-BR na Bélgica.
 *
 * Confira com: pnpm vitest run tests/unit/idioma-do-visitante-na-belgica.test.ts
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  aceita: null as string | null,
  pais: null as string | null,
  falha: false,
  leituras: 0,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(h.aceita ? { "accept-language": h.aceita } : {}),
}));

vi.mock("@/lib/instalacao/config", () => ({
  valorDaInstalacao: async (chave: string) => {
    h.leituras += 1;
    if (chave !== "PAIS_DA_INSTALACAO") throw new Error(`chave inesperada: ${chave}`);
    if (h.falha) throw new Error("banco fora do ar");
    return { valor: h.pais, fonte: h.pais ? "tela" : "ausente" };
  },
}));

import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";

beforeEach(() => {
  h.aceita = null;
  h.pais = null;
  h.falha = false;
  h.leituras = 0;
});

describe("idiomaDoVisitante — último recurso pelo país da instalação", () => {
  it("Bélgica + navegador em inglês (não servido): holandês", async () => {
    h.pais = "BE";
    h.aceita = "en-US,en;q=0.9";
    expect(await idiomaDoVisitante(null)).toBe("nl");
    expect(h.leituras).toBe(1);
  });

  it("Bélgica + nenhum cabeçalho: holandês", async () => {
    h.pais = "BE";
    expect(await idiomaDoVisitante(null)).toBe("nl");
  });

  it("Bélgica + navegador em francês belga: francês, e o país nem é lido", async () => {
    h.pais = "BE";
    h.aceita = "fr-BE,fr;q=0.9,en;q=0.8";
    expect(await idiomaDoVisitante(null)).toBe("fr");
    expect(h.leituras).toBe(0);
  });

  it("Bélgica + navegador em português: português (o navegador vem antes do país)", async () => {
    h.pais = "BE";
    h.aceita = "pt-BR";
    expect(await idiomaDoVisitante(null)).toBe("pt-BR");
    expect(h.leituras).toBe(0);
  });

  it("Portugal + navegador em inglês: português, como antes", async () => {
    h.pais = "PT";
    h.aceita = "en-US";
    expect(await idiomaDoVisitante(null)).toBe("pt-BR");
  });

  it("sem país declarado (Brasil) + navegador em inglês: português, como antes", async () => {
    h.aceita = "en-US";
    expect(await idiomaDoVisitante(null)).toBe("pt-BR");
  });

  it("a configuração não pôde ser lida: português, sem quebrar a tela", async () => {
    h.falha = true;
    h.aceita = "en-US";
    expect(await idiomaDoVisitante(null)).toBe("pt-BR");
  });

  it("a preferência salva vence sempre — e o país nem é consultado", async () => {
    h.pais = "BE";
    h.aceita = "en-US";
    expect(await idiomaDoVisitante("tr")).toBe("tr");
    expect(h.leituras).toBe(0);
  });
});
