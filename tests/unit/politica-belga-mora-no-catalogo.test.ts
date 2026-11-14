/**
 * S2a Task 15 — a política de privacidade belga mora no CATÁLOGO, não num
 * arquivo de texto fixo à parte.
 *
 * Até aqui havia duas traduções da mesma política: a de `lib/legal/politica-belga.ts`
 * (só para o visitante sem sessão numa instalação da Bélgica) e a do catálogo
 * (para quem tinha sessão). O texto belga é o que foi publicado e revisto; ele é a
 * fonte. Este teste prende cada frase publicada, byte a byte, no `nl.json` e no
 * `fr.json` — a cópia congelada do que estava no ar mora em
 * `tests/fixtures/politica-belga/publicada.json`.
 *
 * Uma única exceção, declarada: "Número da empresa (KBO/BCE)". Essa chave não é
 * só da política — é o rótulo do campo em três telas (cadastro da empresa,
 * painel da plataforma). O texto belga dizia apenas "ondernemingsnummer" /
 * "numéro d'entreprise"; o catálogo diz "Ondernemingsnummer (KBO)" /
 * "Numéro d'entreprise (BCE)", e o plano pede que a página em holandês cite o
 * KBO e a em francês o BCE. Fica a do catálogo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entradaDoCatalogo } from "@/lib/i18n/catalogos";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";

type Publicada = Record<"nl" | "fr", Record<string, string>>;

const PUBLICADA = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "politica-belga", "publicada.json"), "utf8"),
) as Publicada;

const ROTULO_DO_NUMERO = "Número da empresa (KBO/BCE)";

/**
 * Segunda exceção, declarada (decisão do dono, 2026-11-14): os três rótulos do
 * Google também são da tela da Agenda. Em francês o catálogo mantém o espaço
 * INSEPARÁVEL antes do `:`, como no resto do `fr.json` — o texto publicado tinha
 * espaço comum, e numa tela estreita o `:` caía sozinho na linha de baixo. Só
 * esse espaço muda; o resto do rótulo segue o publicado.
 */
const ROTULOS_DO_GOOGLE = ["Google Agenda:", "Google Meet:", "Google Ads:"];
const NBSP = " ";

const lerFonte = (caminho: string) => readFileSync(join(__dirname, "..", "..", caminho), "utf8");

describe("a política belga publicada está no catálogo", () => {
  it("a cópia congelada tem as duas línguas, com as mesmas frases", () => {
    expect(Object.keys(PUBLICADA.nl).length).toBeGreaterThan(30);
    expect(Object.keys(PUBLICADA.fr).sort()).toEqual(Object.keys(PUBLICADA.nl).sort());
  });

  it.each(["nl", "fr"] as const)("%s: cada frase publicada está no catálogo, byte a byte", (lingua) => {
    const divergentes = Object.entries(PUBLICADA[lingua])
      .filter(([chave]) => chave !== ROTULO_DO_NUMERO)
      .filter(([chave]) => !(lingua === "fr" && ROTULOS_DO_GOOGLE.includes(chave)))
      .filter(([chave, texto]) => entradaDoCatalogo(lingua, chave) !== texto)
      .map(([chave]) => chave);
    expect(divergentes, `${divergentes.length} frase(s) da política fora do catálogo`).toEqual([]);
  });

  it.each(ROTULOS_DO_GOOGLE)("fr: %s é o publicado com espaço inseparável antes do `:`", (chave) => {
    const publicado = PUBLICADA.fr[chave]!;
    expect(publicado).toMatch(/ :$/u);
    expect(entradaDoCatalogo("fr", chave)).toBe(publicado.replace(/ :$/u, `${NBSP}:`));
  });

  it("o rótulo do número da empresa fica o do catálogo, com KBO em holandês e BCE em francês", () => {
    expect(entradaDoCatalogo("nl", ROTULO_DO_NUMERO)).toMatch(/KBO/);
    expect(entradaDoCatalogo("fr", ROTULO_DO_NUMERO)).toMatch(/BCE/);
  });

  it("a frase dos direitos segue com limitação, portabilidade e oposição", () => {
    const chave = Object.keys(PUBLICADA.nl).find((c) => c.startsWith("O RGPD garante-lhe"))!;
    expect(entradaDoCatalogo("nl", chave)).toMatch(/beperk/);
    expect(entradaDoCatalogo("nl", chave)).toMatch(/overdra/);
    expect(entradaDoCatalogo("nl", chave)).toMatch(/bezwaar/);
    expect(entradaDoCatalogo("fr", chave)).toMatch(/limitation/);
    expect(entradaDoCatalogo("fr", chave)).toMatch(/portabilité/);
    expect(entradaDoCatalogo("fr", chave)).toMatch(/opposer/);
  });

  it("o perfil belga continua declarando que a lei foi revista por IA", () => {
    expect(perfilDoPais("BE").lei?.revisadaPorIa).toBe(true);
  });
});

describe("o texto fixo saiu do código", () => {
  it("`politica-belga.ts` não carrega mais a política nem lê o cabeçalho", () => {
    const fonte = lerFonte("lib/legal/politica-belga.ts");
    expect(fonte).not.toMatch(/\bPOLITICA_BELGA\b/);
    expect(fonte).not.toContain("idiomaBelgaDoCabecalho");
    expect(fonte).not.toContain("idiomaBelgaDoVisitante");
    expect(fonte).not.toContain("next/headers");
  });

  it("a página da política não tem mais um caminho de texto fixo", () => {
    const fonte = lerFonte("app/legal/privacy/page.tsx");
    expect(fonte).not.toContain("textoFixo");
    expect(fonte).not.toMatch(/\bPOLITICA_BELGA\b/);
    expect(fonte).toContain("lerEscolhaDeIdioma(");
    expect(fonte).toContain("idiomaDoVisitante(");
  });
});
