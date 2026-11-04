/**
 * O aviso de dado de cliente vencido sai no idioma da empresa.
 *
 * A Central grava o título e o corpo como vieram: a tela não passa aviso por `t()`.
 * Quem escreve é quem tem de saber o idioma.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { vencePropostasDeDado } from "@/lib/contacts/proposta-de-dado";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const propostas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, contact_id: `c${i}`, campo: "email" }));

let locale: string;
let pendentes: ReturnType<typeof propostas>;
let gravados: Record<string, string>[];

/** Encadeável como o PostgREST: o que importa é a tabela e o que foi inserido. */
function cliente() {
  return {
    from(tabela: string) {
      let inseriu = false;
      const resposta = () => {
        if (tabela === "organizations") return { data: { locale }, error: null };
        if (tabela === "contact_field_proposals") return { data: pendentes, error: null };
        return { data: inseriu ? { id: "item" } : null, error: null };
      };
      const cadeia: Record<string, unknown> = new Proxy(
        {},
        {
          get(_alvo, nome) {
            if (nome === "then") {
              return (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) =>
                Promise.resolve(resposta()).then(ok, erro);
            }
            if (nome === "maybeSingle") return async () => resposta();
            if (nome === "insert") {
              return (linha: Record<string, string>) => {
                inseriu = true;
                gravados.push(linha);
                return cadeia;
              };
            }
            return () => cadeia;
          },
        },
      );
      return cadeia;
    },
  };
}

async function avisoGravado(): Promise<Record<string, string>> {
  gravados = [];
  await vencePropostasDeDado(cliente() as never, ORG, new Date("2026-11-04T10:00:00Z"));
  expect(gravados).toHaveLength(1);
  return gravados[0]!;
}

beforeEach(() => {
  locale = "pt-BR";
  pendentes = propostas(1);
});

describe("vencePropostasDeDado — o aviso no idioma da empresa", () => {
  it("em português, o texto é o de sempre, no singular", async () => {
    const aviso = await avisoGravado();
    expect(aviso.title).toBe("Uma informação de cliente venceu sem alguém conferir");
    expect(aviso.body).toBe(
      "O assistente ouviu um dado na conversa com um cliente e ninguém confirmou a tempo. Ele saiu da ficha para não parecer que já estava salvo. Se a informação ainda importa, peça de novo ou preencha à mão.",
    );
  });

  it("em português, o texto é o de sempre, no plural", async () => {
    pendentes = propostas(3);
    const aviso = await avisoGravado();
    expect(aviso.title).toBe("3 informações de clientes venceram sem alguém conferir");
    expect(aviso.body).toBe(
      "O assistente ouviu alguns dados na conversa com clientes e ninguém confirmou a tempo. Eles saíram da ficha para não parecer que já estava salvo. Se a informação ainda importa, peça de novo ou preencha à mão.",
    );
  });

  it("em turco, nas duas formas e sem sobrar português", async () => {
    locale = "tr";
    const um = await avisoGravado();
    expect(um.title).toBe("Bir müşteri bilgisinin süresi kimse kontrol etmeden doldu");
    expect(um.body).toContain("kişi kartından çıkarıldı");

    pendentes = propostas(3);
    const varios = await avisoGravado();
    expect(varios.title).toBe("3 müşteri bilgisinin süresi kimse kontrol etmeden doldu");
    expect(varios.body).not.toMatch(/assistente|ficha/);
  });
});
