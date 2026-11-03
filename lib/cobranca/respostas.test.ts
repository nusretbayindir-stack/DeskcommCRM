import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: h.warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { blocosExtras, lerRespostasDoMes, TAMANHO_DO_BLOCO, textoDasRespostas } from "./respostas";

/**
 * As respostas do assistente no mês (S4, aba Clientes): o número que o fim do
 * mês fatura à mão em blocos de 250 (contrato, anexo 1). Só exibição.
 */
beforeEach(() => {
  vi.clearAllMocks();
});

describe("blocosExtras", () => {
  it("o bloco é de 250 respostas (anexo 1)", () => expect(TAMANHO_DO_BLOCO).toBe(250));

  it.each([
    [312, 300, 1],
    [300, 300, 0],
    [551, 300, 2],
    [0, 300, 0],
  ])("%i respostas com cota %i → %i bloco(s) extra(s)", (respostas, cota, blocos) =>
    expect(blocosExtras(respostas, cota)).toBe(blocos));

  it("plano sem cota: null", () => expect(blocosExtras(10, null)).toBeNull());
});

describe("lerRespostasDoMes", () => {
  const AGORA = new Date("2026-12-15T12:00:00Z");

  it("chama a função do banco com a org e o instante, e devolve o número", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 312, error: null });
    expect(await lerRespostasDoMes({ rpc } as never, "org-1", AGORA)).toBe(312);
    expect(rpc).toHaveBeenCalledWith("fn_respostas_do_assistente_no_mes", { p_org: "org-1", p_agora: AGORA.toISOString() });
  });

  it("⭐ erro do banco: null, e o log leva só o código do erro (nem a org, nem a mensagem)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42883", message: "function fn_x(org-1) does not exist" } });
    expect(await lerRespostasDoMes({ rpc } as never, "org-1", AGORA)).toBeNull();
    expect(h.warn).toHaveBeenCalledWith("cobranca.respostas_ilegiveis", { erro: "42883" });
  });

  it("chamada que lança (rede): null, sem derrubar a tela", async () => {
    const rpc = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await lerRespostasDoMes({ rpc } as never, "org-1", AGORA)).toBeNull();
    expect(h.warn).toHaveBeenCalledWith("cobranca.respostas_ilegiveis", { erro: "sem_resposta" });
  });
});

describe("textoDasRespostas (a célula da aba Clientes)", () => {
  const t = (s: string) => s;

  it("⭐ acima da cota: número, cota e blocos extras", () =>
    expect(textoDasRespostas(551, 300, t)).toBe("551 / 300 · +2 blocos extras"));
  it("um bloco só, no singular", () => expect(textoDasRespostas(312, 300, t)).toBe("312 / 300 · +1 bloco extra"));
  it("dentro da cota: número e cota", () => expect(textoDasRespostas(120, 300, t)).toBe("120 / 300"));
  it("plano sem cota: só o número", () => expect(textoDasRespostas(42, null, t)).toBe("42"));
  it("número ilegível: —", () => expect(textoDasRespostas(null, 300, t)).toBe("—"));
});
