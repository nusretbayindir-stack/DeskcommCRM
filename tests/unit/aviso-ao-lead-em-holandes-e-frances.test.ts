/**
 * O AVISO AO LEAD EM NEERLANDÊS E EM FRANCÊS — a mesma régua de `aviso-ao-lead-em-turco`.
 *
 * O cliente lê o aviso no idioma da ORGANIZAÇÃO (doc S2a, Task 7). Uma empresa
 * belga grava `nl` ou `fr`, ou, vindo de outro caminho, `nl-BE` e `fr-BE`: as
 * duas formas caem nas frases do idioma, e não no português. O tratamento é o
 * formal dos glossários ("u" em neerlandês, "vous" em francês).
 */
import { describe, expect, it } from "vitest";

import { textoDoAviso, type MotivoDoAviso } from "@/lib/escalacao/aviso-ao-lead";
import type { QuemPodeAssumir } from "@/lib/escalacao/disponibilidade";
import { normalizeCopy } from "@/lib/agent-engine/spinning/engine";
import { SPINNING_DEFAULTS } from "@/lib/agent-engine/spinning/defaults";

const MOTIVOS: MotivoDoAviso[] = ["pediu_humano", "suspeita_de_opt_out", "orcamento_de_ia", "outro"];
const ESTADOS: Array<{ rotulo: string; quem: QuemPodeAssumir | null }> = [
  { rotulo: "leitura falhou", quem: null },
  { rotulo: "instalação fresca", quem: { disponiveis: 0, total: 0 } },
  { rotulo: "fora de expediente", quem: { disponiveis: 0, total: 3 } },
  { rotulo: "com gente livre", quem: { disponiveis: 2, total: 3 } },
];
const PALAVRAS_EM_PORTUGUES = /\b(você|seu|sua|equipe|atendente|não|já|ninguém|aguarde|conversa)\b/i;

const IDIOMAS = [
  {
    codigo: "nl",
    regional: "nl-BE",
    // O "je" informal e suas formas; o glossário pede "u".
    informal: /(?<!\p{L})(je|jij|jou|jouw|jullie|jezelf)(?!\p{L})/iu,
    // Palavras que só o neerlandês tem: prova de que a frase é do idioma.
    doIdioma: /(?<!\p{L})(u|uw|wij|we|ons|onze|ik|een|het)(?!\p{L})/iu,
    convidaAEsperar: /wacht|even geduld|blijf|wachtrij/i,
  },
  {
    codigo: "fr",
    regional: "fr-BE",
    // O "tu" e suas formas; o glossário pede "vous".
    informal: /(?<!\p{L})(tu|ton|ta|tes|toi|te)(?!\p{L})|(?<!\p{L})t['’]/iu,
    doIdioma: /(?<!\p{L})(vous|votre|vos|nous|notre|je|j['’]ai|une?)(?!\p{L})/iu,
    convidaAEsperar: /patient|attend|restez|file/i,
  },
] as const;

describe.each(IDIOMAS)("o aviso sai em $codigo para organização em $codigo", (idioma) => {
  const casos = MOTIVOS.flatMap((motivo) => ESTADOS.map((estado) => ({ motivo, ...estado })));

  it.each(casos)("$motivo / $rotulo: no idioma de verdade, formal, e não o português", ({ motivo, quem }) => {
    const texto = textoDoAviso(motivo, quem, "lead-1", idioma.codigo);
    expect(texto).not.toBe(textoDoAviso(motivo, quem, "lead-1", "pt-BR"));
    expect(texto).toMatch(idioma.doIdioma);
    expect(texto).not.toMatch(PALAVRAS_EM_PORTUGUES);
    expect(texto).not.toMatch(idioma.informal);
    expect(texto).not.toContain("—");
  });

  it.each(casos)("$motivo / $rotulo: a forma regional cai no mesmo texto", ({ motivo, quem }) => {
    expect(textoDoAviso(motivo, quem, "lead-1", idioma.regional)).toBe(
      textoDoAviso(motivo, quem, "lead-1", idioma.codigo),
    );
  });

  it.each(casos)("$motivo / $rotulo: ao menos 3 redações entre 50 leads", ({ motivo, quem }) => {
    const textos = new Set(
      Array.from({ length: 50 }, (_, i) => textoDoAviso(motivo, quem, `lead-${i}`, idioma.codigo)),
    );
    expect(textos.size).toBeGreaterThanOrEqual(3);
  });

  it("não cabe na isenção do spinning, como os outros idiomas (o desarme segue necessário)", () => {
    for (const motivo of MOTIVOS) {
      const t = normalizeCopy(textoDoAviso(motivo, null, "lead-1", idioma.codigo));
      expect(t.length, motivo).toBeGreaterThan(SPINNING_DEFAULTS.allowlistMaxLength);
    }
  });

  it("o estado da equipe muda o fecho", () => {
    const fechos = new Set(ESTADOS.slice(1).map(({ quem }) => textoDoAviso("outro", quem, "lead-1", idioma.codigo)));
    expect(fechos.size).toBe(3);
  });

  it("quem pediu para parar não recebe convite para esperar", () => {
    for (const { quem, rotulo } of ESTADOS) {
      for (let i = 0; i < 20; i++) {
        const t = textoDoAviso("suspeita_de_opt_out", quem, `lead-${i}`, idioma.codigo);
        expect(t, rotulo).not.toMatch(idioma.convidaAEsperar);
      }
    }
  });

  it("fora de expediente não promete prazo curto nem convida a esperar na conversa", () => {
    for (let i = 0; i < 30; i++) {
      const t = textoDoAviso("pediu_humano", { disponiveis: 0, total: 3 }, `lead-${i}`, idioma.codigo);
      expect(t).not.toMatch(idioma.convidaAEsperar);
    }
  });
});

describe("o português e os outros idiomas não mudam", () => {
  it("sem locale, ou idioma sem frases próprias, segue em português", () => {
    const pt = textoDoAviso("pediu_humano", null, "lead-1", "pt-BR");
    expect(textoDoAviso("pediu_humano", null, "lead-1", null)).toBe(pt);
    expect(textoDoAviso("pediu_humano", null, "lead-1", "de")).toBe(pt);
  });
});
