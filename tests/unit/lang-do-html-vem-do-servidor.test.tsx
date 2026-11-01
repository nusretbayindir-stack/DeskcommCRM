/**
 * O `lang` DO HTML QUE O SERVIDOR MANDA É O DE QUEM ABRE (U10).
 *
 * O layout raiz escrevia `<html lang="pt-BR">` para todo mundo, e só o
 * `IdiomaProvider` corrigia — no cliente, depois da hidratação (ver
 * `agenda-e-lang-seguem-o-idioma` e `lang-das-telas-fora-do-app`). Até lá, uma
 * conta em turco recebia HTML turco marcado como português: o navegador oferece
 * "traduzir do português" e o leitor de tela começa com a voz errada. O idioma
 * sai da mesma cadeia do título da aba (`idiomaDaRequisicao`: perfil, depois o
 * navegador do visitante).
 */
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadAuthUser: vi.fn(),
  idiomaDoVisitante: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ loadAuthUser: mocks.loadAuthUser }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: mocks.idiomaDoVisitante }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "fonte" }) }));
vi.mock("@/lib/branding/instalacao", () => ({
  marcaDaInstalacao: vi.fn(async () => null),
  motivoDoFallback: vi.fn(() => null),
  registrarEstadoDaMarca: vi.fn(),
}));

beforeEach(() => {
  mocks.loadAuthUser.mockReset();
  mocks.idiomaDoVisitante.mockReset();
});

async function htmlDoLayout(): Promise<ReactElement<{ lang: string }>> {
  const { default: RootLayout } = await import("@/app/layout");
  return (await RootLayout({ children: null })) as ReactElement<{ lang: string }>;
}

describe("o <html> do layout raiz", () => {
  it("com sessão, o lang é o idioma da pessoa", async () => {
    mocks.loadAuthUser.mockResolvedValue({ idioma: "tr" });
    const html = await htmlDoLayout();
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("tr");
  });

  it("sem sessão, o lang segue o navegador do visitante", async () => {
    mocks.loadAuthUser.mockResolvedValue(null);
    mocks.idiomaDoVisitante.mockResolvedValue("es");
    expect((await htmlDoLayout()).props.lang).toBe("es");
  });

  it("português continua português", async () => {
    mocks.loadAuthUser.mockResolvedValue({ idioma: "pt-BR" });
    expect((await htmlDoLayout()).props.lang).toBe("pt-BR");
  });
});
