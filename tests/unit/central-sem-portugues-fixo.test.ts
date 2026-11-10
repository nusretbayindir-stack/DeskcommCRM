import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { FUNCOES_COM_TEXTO_DE_QUEM_CHAMA } from "@/lib/ai/avisos-do-banco";

/**
 * NENHUM TEXTO FIXO EM PORTUGUÊS VAI PARA A CENTRAL (S2a Task 5, U14 — revisão
 * final, I1/I2).
 *
 * A guarda `central-fala-o-idioma-da-org` é de vizinhança: um arquivo que
 * traduz UM aviso passava com outro aviso em português ao lado. Esta lê o
 * código: em toda gravação na Central — `.insert/.update/.upsert` sobre
 * `agent_inbox_items`, `insertInboxItem(...)` e SQL `insert into
 * agent_inbox_items` — o `title`/`body` não pode ser prosa portuguesa fixa.
 * Resolve constantes do próprio arquivo (`TITULO`, `TEXTOS.x`), concatenação,
 * template e ternário; o que passa por `traduzir(...)` está traduzido. E o
 * idioma da Central não pode ser fixado em `"pt-BR"`.
 *
 * Exceção só com motivo, e só encolhe.
 */

const RAIZ = process.cwd();

function arquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/**
 * Funções do banco que gravam na Central o texto que recebem
 * (`fn_agent_legacy_notice`…): a gravação é a `rpc(...)`, e o título e o corpo
 * são os parâmetros dela. Fonte: `lib/ai/avisos-do-banco.ts`, que
 * `avisos-do-banco-no-idioma.test.ts` confere contra o baseline.
 */
const PARAMETROS_DE_TEXTO: Record<string, readonly string[]> = FUNCOES_COM_TEXTO_DE_QUEM_CHAMA;

const GRAVA_NA_CENTRAL = new RegExp(
  `agent_inbox_items|\\binsertInboxItem\\s*\\(|\\b(${Object.keys(PARAMETROS_DE_TEXTO).join("|")})\\b`,
);

/** Prosa portuguesa: tem espaço e acento português ou palavra de ligação. */
function ehProsa(texto: string): boolean {
  const t = texto.trim();
  if (!/\s/.test(t) || t.length < 12) return false;
  return /[ãõçáéíóúâêô]/i.test(t) || /\b(não|de|do|da|dos|das|que|para|com|sem|uma|um|foi|está|ou|em|no|na|ao|e|o|a|os|as)\b/i.test(t);
}

interface Achado {
  arquivo: string;
  linha: number;
  texto: string;
}

function analisar(caminho: string, fonte: string): Achado[] {
  const arq = ts.createSourceFile(caminho, fonte, ts.ScriptTarget.Latest, true);
  const declaracoes = new Map<string, ts.Expression[]>();
  const coletar = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) && no.initializer) {
      const lista = declaracoes.get(no.name.text) ?? [];
      lista.push(no.initializer);
      declaracoes.set(no.name.text, lista);
    }
    ts.forEachChild(no, coletar);
  };
  coletar(arq);

  const desembrulhar = (e: ts.Expression): ts.Expression => {
    let x = e;
    while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x) || ts.isSatisfiesExpression(x)) {
      x = x.expression;
    }
    return x;
  };

  /** Os textos fixos que uma expressão pode valer (vazio = desconhecido ou traduzido). */
  const textos = (e: ts.Expression, visitados = new Set<string>()): string[] => {
    const x = desembrulhar(e);
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return [x.text];
    if (ts.isTemplateExpression(x)) return [x.head.text + x.templateSpans.map((s) => ` ${s.literal.text}`).join("")];
    if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const esq = textos(x.left, visitados);
      const dir = textos(x.right, visitados);
      return [`${esq.join(" ")} ${dir.join(" ")}`];
    }
    if (ts.isConditionalExpression(x)) return [...textos(x.whenTrue, visitados), ...textos(x.whenFalse, visitados)];
    if (ts.isBinaryExpression(x) && (x.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || x.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      return [...textos(x.left, visitados), ...textos(x.right, visitados)];
    }
    if (ts.isIdentifier(x)) {
      if (visitados.has(x.text)) return [];
      visitados.add(x.text);
      return (declaracoes.get(x.text) ?? []).flatMap((d) => textos(d, visitados));
    }
    if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression)) {
      const chave = `${x.expression.text}.${x.name.text}`;
      if (visitados.has(chave)) return [];
      visitados.add(chave);
      return (declaracoes.get(x.expression.text) ?? []).flatMap((d) => {
        const obj = desembrulhar(d);
        if (!ts.isObjectLiteralExpression(obj)) return [];
        const prop = obj.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(arq).replace(/["']/g, "") === x.name.text,
        );
        return prop && ts.isPropertyAssignment(prop) ? textos(prop.initializer, visitados) : [];
      });
    }
    // Chamadas (traduzir, preencher, montadores) e o resto: não é texto fixo aqui.
    return [];
  };

  const achados: Achado[] = [];
  const registrar = (no: ts.Node, candidatos: string[]) => {
    for (const t of candidatos) {
      if (ehProsa(t)) {
        achados.push({
          arquivo: relative(RAIZ, caminho).split("\\").join("/"),
          linha: arq.getLineAndCharacterOfPosition(no.getStart()).line + 1,
          texto: t.slice(0, 80),
        });
      }
    }
  };

  /** title/body (ou os parâmetros de texto de uma `rpc`) em objetos dentro dos argumentos de uma gravação. */
  const varrerObjetos = (raiz: ts.Node, nomes: readonly string[] = ["title", "body"]) => {
    const visitar = (no: ts.Node) => {
      if (ts.isPropertyAssignment(no) && nomes.includes(no.name.getText(arq).replace(/["']/g, ""))) {
        registrar(no, textos(no.initializer));
      }
      if (ts.isShorthandPropertyAssignment(no) && nomes.includes(no.name.text)) {
        registrar(no, textos(no.name));
      }
      ts.forEachChild(no, visitar);
    };
    visitar(raiz);
  };

  const visitar = (no: ts.Node) => {
    if (ts.isCallExpression(no)) {
      const alvo = no.expression.getText(arq);
      const ehGravacaoSupabase =
        ts.isPropertyAccessExpression(no.expression) &&
        ["insert", "update", "upsert"].includes(no.expression.name.text) &&
        alvo.includes("agent_inbox_items");
      const ehInsertInboxItem = /(^|\.)insertInboxItem$/.test(alvo);
      if (ehGravacaoSupabase || ehInsertInboxItem) {
        for (const arg of no.arguments) {
          varrerObjetos(arg);
          // `insert(novos)`: a lista montada antes, numa variável do arquivo.
          const x = desembrulhar(arg);
          if (ts.isIdentifier(x)) (declaracoes.get(x.text) ?? []).forEach((d) => varrerObjetos(d));
        }
      }

      // `db.rpc("fn_agent_legacy_notice", { p_title, p_body })`: a função grava o que recebe.
      const [funcao, argumentos] = no.arguments;
      if (
        ts.isPropertyAccessExpression(no.expression) &&
        no.expression.name.text === "rpc" &&
        funcao &&
        ts.isStringLiteralLike(funcao) &&
        Object.hasOwn(PARAMETROS_DE_TEXTO, funcao.text) &&
        argumentos
      ) {
        const nomes = PARAMETROS_DE_TEXTO[funcao.text]!;
        varrerObjetos(argumentos, nomes);
        // `rpc("fn_…", args)`: o objeto montado antes, numa variável do arquivo.
        const x = desembrulhar(argumentos);
        if (ts.isIdentifier(x)) (declaracoes.get(x.text) ?? []).forEach((d) => varrerObjetos(d, nomes));
      }

      const [sql, params] = no.arguments;
      if (ts.isPropertyAccessExpression(no.expression) && no.expression.name.text === "query" && sql) {
        const textoDoSql = textos(sql).join(" ");
        if (/(insert\s+into|update)\s+agent_inbox_items/i.test(textoDoSql)) {
          // Literal português escrito dentro do próprio SQL: os literais um a
          // um e na ordem, sem os comentários `--`.
          const semComentario = textoDoSql.replace(/--[^\n]*/g, "");
          for (const m of semComentario.matchAll(/'((?:[^']|'')*)'/g)) registrar(sql, [m[1]!]);
          if (params && ts.isArrayLiteralExpression(desembrulhar(params))) {
            for (const el of (desembrulhar(params) as ts.ArrayLiteralExpression).elements) {
              registrar(el, textos(el as ts.Expression));
            }
          }
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(arq);
  return achados;
}

/** Gravadores que, com motivo, mantêm texto fixo. Só encolhe. */
const EXCECOES: Record<string, string> = {};

const gravadores = ["app", "lib", "workers"]
  .flatMap((d) => arquivos(join(RAIZ, d)))
  .map((absoluto) => ({ absoluto, fonte: readFileSync(absoluto, "utf8") }))
  .filter(({ fonte }) => GRAVA_NA_CENTRAL.test(fonte));

const achados = gravadores.flatMap(({ absoluto, fonte }) => analisar(absoluto, fonte));

describe("nenhum texto fixo em português vai para a Central", () => {
  it("controle: o detector acha prosa fixa num gravador de exemplo", () => {
    const exemplo = `
      const TITULO = "Um aviso que ficou em português";
      await admin.from("agent_inbox_items").insert({ title: TITULO, body: "Corpo com " + x + " e mais" });
      await insertInboxItem(db, { title: \`Lead \${a} ficou sem dono\`, body: traduzir("x", idioma) }, "k");
      await db.query("insert into agent_inbox_items (title) values ($1)", [TITULO]);
      await db.query(\`insert into agent_inbox_items (title) select 'Cliente faltou e não respondeu'\`, []);
      await db.rpc("fn_agent_legacy_notice", { p_org: o, p_title: "Agente precisa concluir a configuração", p_body: traduzir("x", idioma) });
      await db.rpc("fn_que_nao_grava_na_central", { p_title: "Um título que não vai para a Central" });
      const args = { p_org: o, p_titulo: "O aviso de cobrança em português fixo", p_corpo: corpo };
      await db.rpc("fn_cobranca_registrar_aviso", args);
      await db.rpc("constructor", { p_title: "Uma chave do protótipo não é função da Central" });
    `;
    const r = analisar(join(RAIZ, "exemplo.ts"), exemplo);
    expect(r.map((a) => a.linha)).toEqual([3, 3, 4, 5, 6, 7, 9]);
  });

  it("nenhuma gravação na Central leva prosa portuguesa fixa", () => {
    const fora = achados
      .filter((a) => !(a.arquivo in EXCECOES))
      .map((a) => `${a.arquivo}:${a.linha} → ${a.texto}`);
    expect(fora, `${fora.length} texto(s) fixo(s) em português indo para a Central`).toEqual([]);
  });

  it("o idioma da Central não é fixado em português", () => {
    const fixos = gravadores
      // Constante de módulo; o padrão de parâmetro (`idioma: Idioma = "pt-BR"`) é legítimo.
      .filter(({ fonte }) => /\bconst\s+\w+\s*:\s*Idioma\s*=\s*["']pt-BR["']|traduzir\([^)]*,\s*["']pt-BR["']\s*\)/.test(fonte))
      .map(({ absoluto }) => relative(RAIZ, absoluto).split("\\").join("/"));
    expect(fixos, "idioma da Central fixado em pt-BR").toEqual([]);
  });

  it("a exceção só lista quem ainda tem texto fixo", () => {
    const mortas = Object.keys(EXCECOES).filter((arq) => !achados.some((a) => a.arquivo === arq));
    expect(mortas).toEqual([]);
  });
});
