/**
 * FRASE EM PEDAÇOS NÃO SE TRADUZ PARA O TURCO.
 *
 * O português monta "3 de 10" e "chave da OpenAI" juntando pedaços: "de" e "da"
 * viravam chaves soltas do dicionário. Em turco a preposição vira sufixo e muda
 * de lugar, e as chaves soltas tinham virado "şunun:" — a tela dizia
 * "3 şunun: 10". O que este arquivo trava:
 *   1. o "de" de contagem, que em turco é "/" ("3 / 10");
 *   2. as frases que usavam "de"/"da" como preposição passam a ser UMA chave com
 *      marcador, e o português sai byte a byte como antes;
 *   3. dois valores turcos achados na mesma revisão (e-mail de exemplo e
 *      "Yapamadım").
 */
import { describe, expect, it } from "vitest";

import {
  fraseModelosSemFerramentas,
  fraseSemChave,
  fraseSemListaDeModelos,
} from "@/app/onboarding/setup-ai/_form";
import { traduzir } from "@/lib/i18n/dicionario";

const pt = (texto: string) => texto;
const tr = (texto: string) => traduzir(texto, "tr");

describe("o 'de' de contagem", () => {
  it("em turco é '/': '3 / 10', não '3 şunun: 10'", () => {
    expect(tr("de")).toBe("/");
  });
});

describe("onboarding: o nome da empresa de IA vai dentro da frase inteira", () => {
  it("português: as três frases ficam iguais às de antes", () => {
    expect(fraseSemChave("openai", pt)).toBe(
      "Não achei chave da OpenAI (GPT) nem cadastrada aqui, nem vinda da instalação. Cole a chave no campo acima («o cérebro dele») e crie o atendente de novo — ou cadastre em",
    );
    expect(fraseSemChave(null, pt)).toBe(
      "Não achei chave da inteligência escolhida na instalação nem cadastrada aqui, nem vinda da instalação. Cole a chave no campo acima («o cérebro dele») e crie o atendente de novo — ou cadastre em",
    );
    expect(fraseModelosSemFerramentas("openai", pt)).toBe(
      "Os modelos da OpenAI (GPT) que esta instalação conhece não sabem usar ferramentas — sem isso ele conversaria bem e nunca criaria um cliente nem moveria um negócio no funil. Escolha outra empresa de IA em",
    );
    expect(fraseSemListaDeModelos("openai", pt)).toBe(
      "Esta instalação ainda não tem a lista de modelos da OpenAI (GPT).",
    );
  });

  it.each([
    ["openai", "OpenAI (GPT)"],
    [null, "kurulumda seçilen yapay zekâ"],
  ] as const)("turco (%s): sem 'şunun', sem 'da' solto, com o nome da empresa", (id, nome) => {
    for (const frase of [fraseSemChave, fraseModelosSemFerramentas, fraseSemListaDeModelos]) {
      const texto = frase(id, tr);
      expect(texto).not.toContain("şunun");
      expect(texto).not.toMatch(/(?<!\p{L})da(?!\p{L})/u);
      expect(texto).toContain(nome);
    }
  });
});

describe("frases que usavam o 'de' como preposição", () => {
  it("agenda: «Consulta de Maria» vira «Consulta (Maria)»", () => {
    expect(tr("{titulo} de {quem}")).toBe("{titulo} ({quem})");
  });

  it("orçamento: o limiar e o teto ficam na frase turca", () => {
    const frase = tr("Me avisar ao passar de {pct}% de {teto}");
    expect(frase).toContain("{pct}");
    expect(frase).toContain("{teto}");
    expect(frase).not.toContain("Me avisar");
  });

  it("etiqueta: a exclusão nomeia a etiqueta e as três contagens", () => {
    const frase = tr("Excluir {tag} de {contatos} contato(s), {leads} lead(s) e {conversas} conversa(s).");
    for (const marcador of ["{tag}", "{contatos}", "{leads}", "{conversas}"]) {
      expect(frase).toContain(marcador);
    }
    expect(frase).not.toContain("Excluir");
  });

  it("operador: «Organizou o sistema em» não vira «şu yapıda»", () => {
    expect(tr("Organizou o sistema em")).toBe("Sistemi düzenledi:");
  });
});

describe("valores turcos da mesma revisão", () => {
  it("e-mail de exemplo sem letra turca (endereço de e-mail não leva ü)", () => {
    expect(tr("cliente@empresa.com")).toBe("musteri@sirket.com");
  });

  it("recusa do caso sem «Yapamadım»", () => {
    expect(tr("Não consegui: esse caso já foi respondido ou não existe.")).not.toMatch(/^Yapamadım/);
  });
});
