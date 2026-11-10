import { describe, expect, it } from "vitest";

import { recordLegacyNotice, type LegacyRecoveryCause } from "@/lib/ai/agents/legacy-notice";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * O AVISO DO AGENTE LEGADO SAI NO IDIOMA DA EMPRESA (S2a, U14).
 *
 * `fn_agent_legacy_notice` grava na Central o título e o corpo que recebe: quem
 * traduz é `recordLegacyNotice`. Antes ela mandava português fixo, e as guardas
 * da Central não viam, porque a gravação passa por `rpc(...)`. O português
 * continua o de antes, byte a byte.
 */

const CAUSAS: LegacyRecoveryCause[] = [
  "sem_canal",
  "sem_credencial",
  "sem_modelo",
  "modelo_ambiguo",
  "sem_versao",
  "migracao_falhou",
  "pronto",
];

type Rpc = { nome: string; args: Record<string, unknown> };

function banco(locale: string | null, opcoes: { leituraFalha?: boolean } = {}) {
  const rpcs: Rpc[] = [];
  const db = {
    from: (tabela: string) => {
      expect(tabela).toBe("organizations");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              opcoes.leituraFalha ? { data: null, error: { message: "falhou" } } : { data: { locale }, error: null },
          }),
        }),
      };
    },
    rpc: async (nome: string, args: Record<string, unknown>) => {
      rpcs.push({ nome, args });
      return { data: true, error: null };
    },
  };
  return { db: db as never, rpcs };
}

describe("aviso do agente legado no idioma da empresa", () => {
  it("empresa em turco: título e corpo em turco", async () => {
    const { db, rpcs } = banco("tr");
    await recordLegacyNotice(db, "org", "agente", "sem_canal");
    expect(rpcs).toHaveLength(1);
    const { p_title, p_body } = rpcs[0]!.args;
    expect(p_title).toBe(traduzir("Agente precisa concluir a configuração", "tr"));
    expect(p_title).not.toBe("Agente precisa concluir a configuração");
    expect(p_body).toContain(traduzir("Conecte ou escolha um canal de WhatsApp para este agente.", "tr"));
    expect(p_body).not.toContain("Abra IA");
  });

  it("empresa em português: o texto de antes, byte a byte", async () => {
    const { db, rpcs } = banco("pt-BR");
    await recordLegacyNotice(db, "org", "agente", "sem_canal");
    await recordLegacyNotice(db, "org", "agente", "pronto");
    expect(rpcs[0]!.args).toMatchObject({
      p_code: "sem_canal",
      p_title: "Agente precisa concluir a configuração",
      p_body: "Conecte ou escolha um canal de WhatsApp para este agente. Abra IA → Agentes → Recuperar agente legado.",
    });
    expect(rpcs[1]!.args).toMatchObject({
      p_code: "pronto",
      p_title: "Agente recuperado",
      p_body:
        "A configuração foi recuperada. As respostas usam a versão publicada do agente. Abra IA → Agentes → Recuperar agente legado.",
    });
  });

  it("leitura do idioma falha: português, e o aviso é gravado", async () => {
    const { db, rpcs } = banco(null, { leituraFalha: true });
    await recordLegacyNotice(db, "org", "agente", "sem_modelo");
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]!.args.p_title).toBe("Agente precisa concluir a configuração");
  });

  it("toda causa tem turco e espanhol", async () => {
    for (const idioma of ["tr", "es"] as const) {
      for (const causa of CAUSAS) {
        const { db, rpcs } = banco(idioma);
        await recordLegacyNotice(db, "org", "agente", causa);
        const { p_title, p_body } = rpcs[0]!.args as { p_title: string; p_body: string };
        const ptTitulo = causa === "pronto" ? "Agente recuperado" : "Agente precisa concluir a configuração";
        expect(p_title, `${idioma} ${causa}`).not.toBe(ptTitulo);
        expect(p_body, `${idioma} ${causa}`).not.toContain("Abra IA");
        expect(p_body, `${idioma} ${causa}`).not.toMatch(/\{causa\}/);
      }
    }
  });
});
