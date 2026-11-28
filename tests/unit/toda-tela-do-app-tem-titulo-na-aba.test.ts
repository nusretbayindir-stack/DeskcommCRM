/**
 * TODA TELA DO APP DIZ O PRÓPRIO NOME NA ABA (U43).
 *
 * Medido em 2026-11-26 na `main` do fork: de 107 `page.tsx` em `app/app`, 63
 * não tinham título próprio. A aba mostrava o título padrão do layout raiz —
 * "<marca> — atendimento e vendas por WhatsApp com agentes de IA" — em toda
 * essa tela, em todo idioma, no Brasil também.
 *
 * Uma página tem título quando ela mesma declara `generateMetadata` (ou
 * `metadata`), ou quando um `layout.tsx` entre ela e `app/app` o declara: o
 * Next herda o título do segmento mais fundo que tiver um. O `layout.tsx` de
 * `app/app` não conta — ele não tem título, e o raiz (`app/layout.tsx`) só
 * tem o padrão, que é justamente o defeito.
 *
 * Os títulos deste fork que vivem num layout são layouts SÓ DE TÍTULO: arquivo
 * novo, que não existe no projeto de origem e por isso não conflita no
 * senkron, e que devolve `children` sem embrulho. A segunda parte deste
 * arquivo cobra essa forma — um embrulho, um provider ou um `"use client"`
 * mudaria o que a tela renderiza.
 *
 * Custo declarado: quando o projeto de origem trouxer uma página nova sem
 * título, este teste fica vermelho no senkron até alguém dar um título a ela
 * (uma linha `tituloDaAba` na página, ou um layout só de título). É o mesmo
 * tipo de conserto que o `titulo-da-aba-fala-o-idioma-de-quem-abre` já pede.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { arquivosDeCodigo, caminhoRelativo, RAIZ_DO_REPO } from "./helpers/varrer-codigo";

const RAIZ_DO_APP = "app/app";

/**
 * Páginas que só redirecionam: não renderizam nada, então não têm aba a nomear.
 * Lista FECHADA — a página que passar a renderizar sai daqui e ganha título.
 */
const SO_REDIRECIONAM = [
  "app/app/page.tsx", // manda para a tela inicial da interface
  "app/app/inbox/[id]/page.tsx", // link antigo → /app/inbox?id=
  "app/app/leads/[id]/page.tsx", // → o funil do lead (ou 404)
  "app/app/settings/canal-oficial/page.tsx", // → Conexões, aba oficial
  "app/app/settings/templates/page.tsx", // → Conexões, modelos
  "app/app/settings/tenant/whatsapp/page.tsx", // → Conexões
];

/**
 * Telas de detalhe que herdam o nome da SEÇÃO de um layout acima da pasta
 * delas (U43, regra: detalhe leva título fixo de seção, sem ler o banco).
 * Lista FECHADA: fora dela, o título tem de vir da própria página ou de um
 * layout na MESMA pasta. Sem isso, uma tela nova que o projeto de origem
 * trouxesse para dentro de um hub (ex.: `settings/tenant/<nova>`) herdaria o
 * nome do hub ("Organização") e este teste ficaria verde com o nome errado.
 */
const HERDAM_DA_SECAO: Record<string, string> = {
  "app/app/ai/agents/new/page.tsx": "app/app/ai/agents/layout.tsx",
  "app/app/ai/agents/[id]/page.tsx": "app/app/ai/agents/layout.tsx",
  "app/app/ai/followups/[id]/page.tsx": "app/app/ai/followups/layout.tsx",
  "app/app/ai/followups/enrollments/[id]/page.tsx": "app/app/ai/followups/layout.tsx",
  "app/app/ai/knowledge/sources/[id]/page.tsx": "app/app/ai/knowledge/sources/layout.tsx",
  "app/app/ai/routers/[id]/page.tsx": "app/app/ai/routers/layout.tsx",
  "app/app/lgpd/requests/[id]/page.tsx": "app/app/lgpd/requests/layout.tsx",
  "app/app/webhooks/automacoes/[id]/page.tsx": "app/app/webhooks/automacoes/layout.tsx",
};

const DECLARA_TITULO =
  /^export (const generateMetadata\b|async function generateMetadata\b|function generateMetadata\b|const metadata\b)/m;

function ler(rel: string): string {
  return readFileSync(path.join(RAIZ_DO_REPO, rel), "utf8");
}

const arquivos = arquivosDeCodigo([RAIZ_DO_APP]).map((a) => caminhoRelativo(a));
const paginas = arquivos.filter((rel) => /\/page\.tsx$/.test(rel)).sort();
const layouts = arquivos.filter((rel) => /\/layout\.tsx$/.test(rel)).sort();

/** De onde vem o título da página: ela mesma, um layout entre ela e `app/app`, ou nada. */
function origemDoTitulo(pagina: string): string | null {
  if (DECLARA_TITULO.test(ler(pagina))) return pagina;
  let dir = path.posix.dirname(pagina);
  while (dir !== RAIZ_DO_APP && dir.startsWith(`${RAIZ_DO_APP}/`)) {
    const layout = `${dir}/layout.tsx`;
    if (existsSync(path.join(RAIZ_DO_REPO, layout)) && DECLARA_TITULO.test(ler(layout)))
      return layout;
    dir = path.posix.dirname(dir);
  }
  return null;
}

describe("toda tela do app tem título na aba", () => {
  it("a varredura enxerga as páginas — o verde abaixo não é vacuidade", () => {
    expect(paginas.length).toBeGreaterThan(100);
    expect(paginas).toEqual(
      expect.arrayContaining(["app/app/crm/page.tsx", "app/app/ai/agents/page.tsx"]),
    );
  });

  it("a lista das que só redirecionam existe e não declara título", () => {
    for (const pagina of SO_REDIRECIONAM) {
      expect(paginas, `${pagina} sumiu: tire-a de SO_REDIRECIONAM`).toContain(pagina);
      const fonte = ler(pagina);
      expect(fonte, `${pagina} não chama redirect(): não é só redirecionamento`).toMatch(
        /\bredirect\(/,
      );
      // Só redireciona = não devolve JSX nenhum.
      expect(
        fonte,
        `${pagina} renderiza JSX: tire-a de SO_REDIRECIONAM e dê um título a ela`,
      ).not.toMatch(/return\s*\(?\s*</);
    }
  });

  it("o título vem da própria página, do layout da mesma pasta, ou da seção declarada em HERDAM_DA_SECAO", () => {
    const fora = paginas
      .filter((p) => !SO_REDIRECIONAM.includes(p))
      .map((p) => ({ p, origem: origemDoTitulo(p) }))
      .filter(({ p, origem }) => origem !== null && origem !== p)
      .filter(
        ({ p, origem }) =>
          origem !== `${path.posix.dirname(p)}/layout.tsx` && HERDAM_DA_SECAO[p] !== origem,
      )
      .map(({ p, origem }) => `${p} ← ${origem}`);
    expect(fora, "tela que herda o nome de outra seção: dê a ela o próprio título").toEqual([]);
  });

  it("toda página que renderiza tem título, dela mesma ou de um layout acima", () => {
    const semTitulo = paginas
      .filter((p) => !SO_REDIRECIONAM.includes(p))
      .filter((p) => origemDoTitulo(p) === null);
    expect(
      semTitulo,
      `${semTitulo.length} tela(s) sem título — a aba mostra o título padrão. Use ` +
        '`export const generateMetadata = tituloDaAba((t) => t("<nome do menu>"))` na página ou num layout só de título',
    ).toEqual([]);
  });
});

describe("layout só de título", () => {
  const deTitulo = layouts.filter((rel) => /\btitulo(DaAba|DoSegmento)\(/.test(ler(rel)));

  it("a varredura enxerga os layouts de título", () => {
    expect(deTitulo).toEqual(expect.arrayContaining(["app/app/ai/agents/layout.tsx"]));
  });

  it("não muda o que a tela renderiza: sem 'use client', sem embrulho, devolve children", () => {
    const fora = deTitulo.filter((rel) => {
      const fonte = ler(rel);
      return (
        /^\s*["']use client["']/m.test(fonte) ||
        /<[A-Za-z>]/.test(fonte.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")) ||
        !/\breturn children;/.test(fonte)
      );
    });
    expect(fora).toEqual([]);
  });

  it("não declara configuração de segmento (dynamic, revalidate, runtime…), que mudaria a renderização", () => {
    const CONFIG =
      /^export const (dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration|experimental_ppr)\b/m;
    expect(deTitulo.filter((rel) => CONFIG.test(ler(rel)))).toEqual([]);
  });

  it("usa tituloDoSegmento, que repassa o modelo '%s · <marca>' às telas de baixo", () => {
    // Um `title` em texto puro num layout zera o modelo do layout raiz para os
    // segmentos de baixo (Next: resolve-metadata, `titleTemplates` vira null):
    // "Aviso de agendamento · <marca>" virava "Aviso de agendamento".
    expect(deTitulo.filter((rel) => !/\btituloDoSegmento\(/.test(ler(rel)))).toEqual([]);
  });
});
