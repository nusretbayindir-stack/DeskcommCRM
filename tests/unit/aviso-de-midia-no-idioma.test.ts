import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { DETALHE_TECNICO } from "@/lib/event-log/aviso-de-evento-morto";
import { traduzir } from "@/lib/i18n/dicionario";
import { MOTIVOS_DA_TRANSCRICAO } from "@/lib/messaging/media/escada-de-transcricao";
import { textoDoAvisoDeMidiaNaoLida } from "@/workers/media-derive-worker";

/**
 * O AVISO DE MÍDIA NÃO LIDA SAI NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * O aviso é montado de peças que cada chamada passa (motivo, consequência, o
 * que fazer). Uma peça nova em português sem tradução sairia em português no
 * meio de um aviso turco — por isso este teste lê as chamadas do próprio
 * worker e cobra espanhol e turco de cada texto fixo que elas passam.
 */

const FONTE = readFileSync("workers/media-derive-worker.ts", "utf8");

/** Os textos fixos que as chamadas de `avisarMidiaNaoLida` passam (motivo, consequência, o que fazer). */
function textosDasChamadas(): string[] {
  const arquivo = ts.createSourceFile("w.ts", FONTE, ts.ScriptTarget.Latest, true);
  const textos: string[] = [];
  const literal = (no: ts.Node | undefined) => {
    if (!no) return;
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) textos.push(no.text);
    if (ts.isObjectLiteralExpression(no)) {
      for (const p of no.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText(arquivo) === "modelo") literal(p.initializer);
      }
    }
    if (ts.isConditionalExpression(no)) {
      literal(no.whenTrue);
      literal(no.whenFalse);
    }
  };
  const visitar = (no: ts.Node) => {
    if (ts.isCallExpression(no) && no.expression.getText(arquivo) === "avisarMidiaNaoLida") {
      const [, , motivo, consequencia, , paraResolver] = no.arguments;
      literal(motivo);
      literal(consequencia);
      literal(paraResolver);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(arquivo);
  return textos;
}

/** Motivos que chegam prontos de outro módulo, e o motivo do teto (frase montada com dois desfechos). */
const MOTIVOS_DE_FORA = [
  MOTIVOS_DA_TRANSCRICAO.semModeloDeConversa,
  MOTIVOS_DA_TRANSCRICAO.modeloSemAudio,
  MOTIVOS_DA_TRANSCRICAO.ninguem,
  // Motivo fixo guardado numa constante local antes da chamada (a varredura só lê literais).
  "o áudio excede o limite de 25 MB da transcrição pela OpenRouter e não foi enviado ao serviço",
  "o limite de gasto com IA deste mês foi atingido e a IA está configurada para parar nele, então a foto não foi enviada ao provedor",
  "o limite de gasto com IA deste mês foi atingido e a IA está configurada para parar nele, então o áudio não foi enviado ao provedor",
];

describe("as peças do aviso, em todo idioma", () => {
  const textos = textosDasChamadas();

  it("a varredura acha as chamadas (controle: o verde abaixo não é vacuidade)", () => {
    expect(textos.length).toBeGreaterThanOrEqual(14);
    expect(textos).toContain("falta uma chave da OpenAI para transcrever");
    expect(textos).toContain("o provedor {provedor} não está disponível nesta instalação");
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: todo texto fixo das chamadas e todo motivo de fora tem tradução`, () => {
      const sem = [...textos, ...MOTIVOS_DE_FORA].filter((t) => traduzir(t, idioma) === t);
      expect(sem, `sem ${idioma}`).toEqual([]);
    });
  }
});

describe("o texto montado", () => {
  it("português: o de sempre, byte a byte", () => {
    expect(
      textoDoAvisoDeMidiaNaoLida({
        tipo: "áudio",
        motivo: "falta uma chave da OpenAI para transcrever",
        consequencia: "Enquanto isso, o agente responde avisando que não conseguiu abrir o arquivo.",
        detalheTecnico: "HTTP 401",
      }),
    ).toEqual({
      title: "O agente não conseguiu ler áudio que o cliente enviou",
      body:
        "Motivo: falta uma chave da OpenAI para transcrever. " +
        "Enquanto isso, o agente responde avisando que não conseguiu abrir o arquivo. " +
        "Para resolver, ajuste o modelo desse ponto em Agente de IA → Provedores, ou cadastre a chave necessária em Credenciais. " +
        `${DETALHE_TECNICO} HTTP 401`,
    });
    expect(
      textoDoAvisoDeMidiaNaoLida({
        tipo: "imagem",
        motivo: { modelo: "o modelo {modelo} não enxerga imagens", valores: { modelo: "gpt-x" } },
        consequencia: "C.",
        paraResolver: "R.",
      }),
    ).toEqual({
      title: "O agente não conseguiu ler imagem que o cliente enviou",
      body: "Motivo: o modelo gpt-x não enxerga imagens. C. R.",
    });
  });

  for (const idioma of ["tr", "es"] as const) {
    it(`${idioma}: título de cada tipo, moldura, padrões e rótulo traduzidos; valores crus`, () => {
      for (const tipo of ["imagem", "áudio", "documento", "vídeo", "mídia"]) {
        const pt = textoDoAvisoDeMidiaNaoLida({ tipo, motivo: "m", consequencia: "c" }).title;
        const traduzido = textoDoAvisoDeMidiaNaoLida({ tipo, motivo: "m", consequencia: "c" }, idioma).title;
        expect(traduzido, tipo).toBe(traduzir(pt, idioma));
        expect(traduzido, tipo).not.toBe(pt);
      }

      const aviso = textoDoAvisoDeMidiaNaoLida(
        {
          tipo: "imagem",
          motivo: { modelo: "o provedor {provedor} não está disponível nesta instalação", valores: { provedor: "acme {x}" } },
          consequencia: "Enquanto isso, o agente responde avisando que não conseguiu abrir o arquivo.",
          detalheTecnico: "HTTP 500",
        },
        idioma,
      );
      // A moldura também é traduzida (em espanhol ela também diz "Motivo:").
      expect(aviso.body.startsWith(traduzir("Motivo: {motivo}.", idioma).split("{motivo}")[0]!)).toBe(true);
      if (idioma === "tr") expect(aviso.body).not.toContain("Motivo:");
      expect(aviso.body).toContain(
        traduzir("Enquanto isso, o agente responde avisando que não conseguiu abrir o arquivo.", idioma),
      );
      expect(aviso.body).toContain(
        traduzir(
          "Para resolver, ajuste o modelo desse ponto em Agente de IA → Provedores, ou cadastre a chave necessária em Credenciais.",
          idioma,
        ),
      );
      if (idioma === "tr") {
        expect(aviso.body).not.toContain("Enquanto isso");
        expect(aviso.body).not.toContain("Para resolver");
      }
      expect(aviso.body).toContain("acme {x}");
      expect(aviso.body).toContain(traduzir("o provedor {provedor} não está disponível nesta instalação", idioma).replace("{provedor}", "acme {x}"));
      expect(aviso.body.endsWith(`${traduzir(DETALHE_TECNICO, idioma)} HTTP 500`)).toBe(true);
    });
  }
});
