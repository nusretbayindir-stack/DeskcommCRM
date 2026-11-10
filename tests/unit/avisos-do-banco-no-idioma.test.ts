import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FUNCOES_COM_TEXTO_DE_QUEM_CHAMA,
  marcasDoTexto,
  ORIGEM_DOS_AVISOS,
  padroesDoGatilho,
  pedacosDoAviso,
  type PassoDoGatilho,
  textoDoAvisoDoBanco,
  textoOriginalDoAvisoDoBanco,
} from "@/lib/ai/avisos-do-banco";
import { IDIOMA_PADRAO, IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";
import { preencher } from "@/lib/i18n/preencher";
import { IDIOMAS_EM_CONSTRUCAO } from "@/lib/i18n/registro";

/**
 * OS AVISOS QUE O BANCO GRAVA NA CENTRAL SAEM NO IDIOMA DA EMPRESA (S2a, U14):
 * a parte que se mede sem banco. O gatilho em si roda em
 * `tests/invariants/avisos-do-banco-no-idioma.test.ts`.
 *
 * O gatilho não muda as funções do upstream: ele reconhece o texto que elas
 * escrevem. O risco desse desenho é o upstream mudar um texto e ele voltar ao
 * português sem ninguém ver, ou uma função nova gravar na Central. Este
 * arquivo transforma os dois em vermelho, medindo a ÚLTIMA definição de cada
 * função no baseline — a que o banco instala (CLAUDE.md, doutrina 10).
 *
 * "Gravar na Central" aqui é: `insert into agent_inbox_items`, `update
 * agent_inbox_items set title/body = '<literal>'` (a anonimização) e chamar uma
 * das `FUNCOES_COM_TEXTO_DE_QUEM_CHAMA` com texto fixo (revisão do PR #43, I1/I2).
 */

const RAIZ = join(__dirname, "..", "..");
const BASELINE = readFileSync(join(RAIZ, "supabase", "baseline.sql"), "utf8");
const CAMINHO_DA_MIGRATION = join(RAIZ, "supabase", "migrations", "20261110170002_7002_central_no_idioma_da_empresa.sql");
const FUNCAO_DO_GATILHO = "fn_central_no_idioma_da_empresa";
const RECEBEM_O_TEXTO = Object.keys(FUNCOES_COM_TEXTO_DE_QUEM_CHAMA);

/** Varredura em ordem: para cada função, a última definição do arquivo vence. Aceita `"public"."fn_x"`. */
function ultimasDefinicoes(sql: string): Map<string, string> {
  const definicoes = new Map<string, string>();
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\.)?"?([a-z0-9_]+)"?\s*\(/gi)) {
    const resto = sql.slice(m.index);
    const abertura = /\bas\s+(\$[a-z_]*\$)/i.exec(resto);
    if (!abertura) continue;
    const marca = abertura[1]!;
    const fim = resto.indexOf(marca, abertura.index + abertura[0].length);
    if (fim < 0) continue;
    definicoes.set(m[1]!.toLowerCase(), resto.slice(0, fim + marca.length));
  }
  return definicoes;
}

/** As instruções que começam no padrão e vão até o `;`, sem comentários e sem cortar em `;` de string. */
function instrucoes(corpo: string, inicio: RegExp): string[] {
  const semComentario = corpo.replace(/--[^\n]*/g, "");
  const achadas: string[] = [];
  for (const m of semComentario.matchAll(inicio)) {
    let i = m.index;
    let emString = false;
    for (; i < semComentario.length; i++) {
      const c = semComentario[i];
      if (c === "'") emString = !emString;
      else if (c === ";" && !emString) break;
    }
    achadas.push(semComentario.slice(m.index, i));
  }
  return achadas;
}

/** Os literais de string do SQL, com `''` desfeito. */
function literais(sql: string): string[] {
  return [...sql.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]!.replace(/''/g, "'"));
}

/**
 * Texto, não identificador (`'job_dead'`, `'warn'`) nem separador (o `' '` do
 * `concat_ws`): tem espaço ao lado de outro caractere (`'Compromisso: '` conta).
 * Sem o `%s` do `format`.
 */
const ehTexto = (l: string) => /\S\s|\s\S/.test(l);
const semFormat = (l: string) => l.replace(/^%s/, "");

interface EscritaNaCentral {
  insercoes: number;
  /** Os literais de texto que a função escreve no título ou no corpo de um aviso. */
  textos: string[];
}

function escritaNaCentral(nome: string, corpo: string): EscritaNaCentral {
  const insercoes = instrucoes(corpo, /insert\s+into\s+(?:public\.)?agent_inbox_items\b/gi);
  const atualizacoes = instrucoes(corpo, /update\s+(?:public\.)?agent_inbox_items\b/gi).flatMap((u) =>
    [...u.matchAll(/\b(?:title|body)\s*=\s*'((?:[^']|'')*)'/gi)].map((m) => m[1]!.replace(/''/g, "'")),
  );
  const chamadas = RECEBEM_O_TEXTO.filter((f) => f !== nome).flatMap((f) =>
    instrucoes(corpo, new RegExp(`\\b(?:public\\.)?${f}\\s*\\(`, "gi")).flatMap(literais),
  );
  return {
    insercoes: insercoes.length,
    textos: [...insercoes.flatMap(literais), ...atualizacoes, ...chamadas].filter(ehTexto).map(semFormat),
  };
}

const DEFINICOES = ultimasDefinicoes(BASELINE);
const ESCRITAS = new Map([...DEFINICOES].map(([nome, corpo]) => [nome, escritaNaCentral(nome, corpo)]));
const FUNCOES_TRADUZIDAS = [...new Set(ORIGEM_DOS_AVISOS.flatMap((o) => o.funcoes))];

describe("avisos do banco: o que o gatilho reconhece é o que o banco escreve", () => {
  it("controle: a varredura acha as funções, inclusive as de nome entre aspas, e o texto de cada uma", () => {
    expect(DEFINICOES.size).toBeGreaterThan(400);
    for (const funcao of FUNCOES_TRADUZIDAS) {
      expect(DEFINICOES.get(funcao), funcao).toBeDefined();
      expect(ESCRITAS.get(funcao)!.textos.length, funcao).toBeGreaterThan(0);
    }
  });

  it("⭐ cada texto está, pedaço a pedaço, na última definição de cada função que o grava", () => {
    const sumidos = ORIGEM_DOS_AVISOS.flatMap((origem) =>
      origem.funcoes.flatMap((funcao) => {
        const escritos = ESCRITAS.get(funcao)?.textos ?? [];
        return pedacosDoAviso(origem)
          .filter((p) => !escritos.includes(p))
          .map((p) => `${funcao} (${origem.chave}): «${p}»`);
      }),
    );
    // Vermelho aqui: o upstream mudou o texto. O gatilho deixou de casar e o aviso voltou ao
    // português. Atualize o texto em lib/ai/avisos-do-banco.ts e no catálogo, e o jsonb do gatilho
    // numa migration nova.
    expect(sumidos).toEqual([]);
  });

  it("⭐ todo texto em português que essas funções gravam na Central tem padrão no gatilho", () => {
    const semPadrao = FUNCOES_TRADUZIDAS.flatMap((funcao) => {
      const conhecidos = ORIGEM_DOS_AVISOS.filter((o) => o.funcoes.includes(funcao)).flatMap(pedacosDoAviso);
      return (ESCRITAS.get(funcao)?.textos ?? [])
        .filter((l) => !conhecidos.includes(l))
        .map((l) => `${funcao}: «${l}»`);
    });
    expect(semPadrao).toEqual([]);
  });

  it("⭐ toda função que grava texto na Central no baseline está declarada (função nova do upstream = vermelho)", () => {
    const gravam = [...ESCRITAS]
      .filter(([nome, e]) => nome !== FUNCAO_DO_GATILHO && (e.insercoes > 0 || e.textos.length > 0))
      .map(([nome]) => nome)
      .sort();
    const declaradas = [...new Set([...FUNCOES_TRADUZIDAS, ...RECEBEM_O_TEXTO])].sort();
    expect(gravam).toEqual(declaradas);
  });

  it("as funções que gravam o texto recebido recebem mesmo título e corpo por parâmetro", () => {
    for (const [funcao, parametros] of Object.entries(FUNCOES_COM_TEXTO_DE_QUEM_CHAMA)) {
      const insercoes = instrucoes(DEFINICOES.get(funcao) ?? "", /insert\s+into\s+(?:public\.)?agent_inbox_items\b/gi).join("\n");
      expect(insercoes, funcao).not.toBe("");
      for (const p of parametros) expect(insercoes, `${funcao}.${p}`).toContain(p);
    }
  });
});

describe("avisos do banco: o gatilho e a tabela", () => {
  it("toda tradução existe, difere do português e tem as mesmas marcas", () => {
    for (const idioma of IDIOMAS) {
      if (idioma === IDIOMA_PADRAO) continue;
      for (const { chave } of ORIGEM_DOS_AVISOS) {
        const pt = textoOriginalDoAvisoDoBanco(chave);
        const traduzido = textoDoAvisoDoBanco(chave, idioma);
        expect(traduzido, `${idioma} ${chave}`).not.toBe(pt);
        expect(marcasDoTexto(traduzido).sort(), `${idioma} ${chave}`).toEqual(marcasDoTexto(pt).sort());
      }
    }
  });

  it("o padrão casa o texto que a função escreve e devolve a tradução com os valores dele", () => {
    const VALORES = { n: 3, motivo: "timeout (provedor) $1 \\x", titulo: "Revisão. 10h? [sala]" };
    for (const [idioma, passos] of Object.entries(padroesDoGatilho()) as [Idioma, PassoDoGatilho[]][]) {
      ORIGEM_DOS_AVISOS.forEach(({ chave }, i) => {
        const [padrao, substituicao, flags] = passos[i]!;
        const escrito = preencher(textoOriginalDoAvisoDoBanco(chave), VALORES);
        // A sintaxe usada (escape, grupos, âncoras) é a mesma no JS e no ARE do Postgres; só a
        // referência ao grupo muda: `\1` lá, `$1` aqui.
        const re = new RegExp(padrao, flags);
        expect(re.test(escrito), `${idioma} ${chave}`).toBe(true);
        const js = substituicao.replace(/\$/g, "$$$$").replace(/\\(\d)/g, "$$$1").replace(/\\\\/g, "\\");
        expect(escrito.replace(new RegExp(padrao, flags), js), `${idioma} ${chave}`).toBe(
          preencher(textoDoAvisoDoBanco(chave, idioma), VALORES),
        );
      });
    }
  });

  it("o erro técnico do job passa cru, mesmo quando contém a frase do motivo padrão", () => {
    for (const [idioma, passos] of Object.entries(padroesDoGatilho()) as [Idioma, PassoDoGatilho[]][]) {
      const motivo = "handler de envio indisponível";
      let corpo = preencher(textoOriginalDoAvisoDoBanco("acompanhamentoCorpo"), { motivo });
      for (const [padrao, substituicao, flags] of passos) {
        const js = substituicao.replace(/\$/g, "$$$$").replace(/\\(\d)/g, "$$$1").replace(/\\\\/g, "\\");
        corpo = corpo.replace(new RegExp(padrao, flags), js);
      }
      expect(corpo, idioma).toBe(preencher(textoDoAvisoDoBanco("acompanhamentoCorpo", idioma), { motivo }));
    }
  });

  it("idioma escondido e o padrão ficam fora do gatilho (português, como normalizarIdioma)", () => {
    const idiomas = Object.keys(padroesDoGatilho()).sort();
    expect(idiomas).toEqual(IDIOMAS.filter((i) => i !== IDIOMA_PADRAO).sort());
    for (const { codigo } of IDIOMAS_EM_CONSTRUCAO) expect(idiomas).not.toContain(codigo);
  });

  it("⭐ o jsonb da última definição do gatilho no baseline é o que a tabela gera", () => {
    const corpo = DEFINICOES.get(FUNCAO_DO_GATILHO);
    expect(corpo, "o baseline não define o gatilho").toBeDefined();
    const jsonb = /\$padroes\$([\s\S]*?)\$padroes\$/.exec(corpo!);
    expect(jsonb, "o gatilho perdeu o bloco $padroes$").not.toBeNull();
    // Vermelho aqui: o catálogo ou a tabela mudou e o gatilho não. Gere de novo com
    // `npx tsx scripts/i18n/padroes-dos-avisos-do-banco.ts` numa migration nova (a 7002 já foi aplicada).
    expect(JSON.parse(jsonb![1]!)).toEqual(padroesDoGatilho());
  });

  it("a migration 7002 aparece no baseline sem uma única diferença", () => {
    expect(existsSync(CAMINHO_DA_MIGRATION)).toBe(true);
    const migration = readFileSync(CAMINHO_DA_MIGRATION, "utf8");
    expect(migration.length).toBeGreaterThan(1000);
    expect(BASELINE.includes(migration)).toBe(true);
  });
});
