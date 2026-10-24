/**
 * O botão "Entrar com Google" só aparece quando o provedor NÃO está desligado.
 *
 * Só um `desligado` lido de verdade esconde o botão; `ligado` e `desconhecido`
 * (rede fora, GoTrue dormindo) mostram — esconder por dúvida tiraria a entrada
 * de quem a tem. A leitura é cara (rede, prazo de 4 s), então um resultado
 * DEFINITIVO fica em memória por um minuto; `desconhecido` não fica.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ estado: vi.fn() }));
vi.mock("@/lib/auth/provedor-google", () => ({ estadoDoProvedorGoogle: mocks.estado }));

async function carregar() {
  vi.resetModules();
  return import("@/lib/auth/botao-google");
}

describe("botaoGoogleVisivel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.estado.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("esconde só quando o provedor está desligado", async () => {
    const { botaoGoogleVisivel } = await carregar();
    mocks.estado.mockResolvedValueOnce("desligado");
    expect(await botaoGoogleVisivel()).toBe(false);
  });

  it("mostra quando está ligado", async () => {
    const { botaoGoogleVisivel } = await carregar();
    mocks.estado.mockResolvedValueOnce("ligado");
    expect(await botaoGoogleVisivel()).toBe(true);
  });

  it("mostra quando não deu para ler, e não grava essa dúvida", async () => {
    const { botaoGoogleVisivel } = await carregar();
    mocks.estado.mockResolvedValueOnce("desconhecido").mockResolvedValueOnce("desligado");
    expect(await botaoGoogleVisivel()).toBe(true);
    expect(await botaoGoogleVisivel()).toBe(false);
    expect(mocks.estado).toHaveBeenCalledTimes(2);
  });

  it("guarda o resultado definitivo por um minuto e depois lê de novo", async () => {
    const { botaoGoogleVisivel } = await carregar();
    mocks.estado.mockResolvedValue("desligado");
    await botaoGoogleVisivel();
    await botaoGoogleVisivel();
    expect(mocks.estado).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(61_000);
    mocks.estado.mockResolvedValue("ligado");
    expect(await botaoGoogleVisivel()).toBe(true);
    expect(mocks.estado).toHaveBeenCalledTimes(2);
  });
});
