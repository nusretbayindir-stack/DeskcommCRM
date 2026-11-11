/**
 * A sonda do carregamento por idioma, num navegador de verdade.
 *
 *   pnpm tsx scripts/i18n/sondar-carregamento.ts --url http://127.0.0.1:3100/login [--so-medir]
 *
 * O e2e não roda no fork, então nenhum teste de CI abre a tela. Esta sonda abre
 * a página com o app de produção já no ar (`next start`) e responde as três
 * perguntas que só o navegador responde:
 *
 *   1. quem lê em turco, neerlandês ou francês nunca vê o português piscar
 *      antes da hidratação;
 *   2. o console não acusa erro de hidratação;
 *   3. o catálogo de cada um chega numa resposta só, e nenhum outro catálogo
 *      vem junto — e quem lê em português não baixa catálogo nenhum.
 *
 * Os catálogos são reconhecidos pela mesma sentinela de `./pacote.ts`. Com
 * `--so-medir` (a medição de base, antes do carregamento por idioma), relata e
 * sai 0. Casca de I/O; a régua do pacote mora em `./pacote.ts`.
 */
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser } from "@playwright/test";

import { sentinelasDosCatalogos } from "./pacote";

const posicao = process.argv.indexOf("--url");
const url = (posicao >= 0 ? process.argv[posicao + 1] : undefined) ?? "http://127.0.0.1:3100/login";
const soMedir = process.argv.includes("--so-medir");

const PASTA_DOS_CATALOGOS = join(__dirname, "..", "..", "lib", "i18n", "traducoes");
const catalogos = Object.fromEntries(
  readdirSync(PASTA_DOS_CATALOGOS)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => [
      nome.replace(/\.json$/, ""),
      JSON.parse(readFileSync(join(PASTA_DOS_CATALOGOS, nome), "utf8")) as Record<string, string>,
    ]),
);
const sentinelas = sentinelasDosCatalogos(catalogos);

/** O texto do botão de entrar em português: é ele que não pode aparecer na tela de quem lê outra língua. */
const PALAVRA_PORTUGUESA = /\bEntrar\b/;

/** Quem lê pelo catálogo: o navegador da pessoa e o catálogo que ela deve baixar, e só ele. */
const LEITORES_DE_CATALOGO = [
  { locale: "tr-TR", codigo: "tr", nome: "turco" },
  { locale: "nl-BE", codigo: "nl", nome: "neerlandês" },
  { locale: "fr-BE", codigo: "fr", nome: "francês" },
] as const;

interface Leitura {
  status: number;
  viuPortugues: boolean;
  errosDeHidratacao: string[];
  outrosErros: number;
  catalogosBaixados: Record<string, number>;
}

async function ler(navegador: Browser, locale: string): Promise<Leitura> {
  const contexto = await navegador.newContext({
    locale,
    extraHTTPHeaders: { "Accept-Language": `${locale},${locale.split("-")[0]};q=0.9` },
  });
  // Antes de qualquer script da página: cada mudança do DOM, desde a primeira
  // pintura, deixa uma fotografia do texto visível.
  await contexto.addInitScript(() => {
    const vistos: string[] = [];
    (window as unknown as { __textosVistos: string[] }).__textosVistos = vistos;
    const anotar = () => vistos.push(document.body?.innerText ?? "");
    new MutationObserver(anotar).observe(document, { subtree: true, childList: true, characterData: true });
    document.addEventListener("DOMContentLoaded", anotar);
  });
  const pagina = await contexto.newPage();

  const erros: string[] = [];
  pagina.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(mensagem.text());
  });
  pagina.on("pageerror", (erro) => erros.push(String(erro)));

  const catalogosBaixados: Record<string, number> = Object.fromEntries(Object.keys(sentinelas).map((i) => [i, 0]));
  const corpos: Promise<void>[] = [];
  pagina.on("response", (resposta) => {
    if (!resposta.url().includes("/_next/static/chunks/")) return;
    corpos.push(
      resposta
        .text()
        .then((corpo) => {
          for (const [idioma, sentinela] of Object.entries(sentinelas)) {
            if (corpo.includes(sentinela)) catalogosBaixados[idioma] = (catalogosBaixados[idioma] ?? 0) + 1;
          }
        })
        .catch(() => undefined),
    );
  });

  const resposta = await pagina.goto(url, { waitUntil: "networkidle" });
  await Promise.all(corpos);
  const vistos = await pagina.evaluate(
    () => (window as unknown as { __textosVistos?: string[] }).__textosVistos ?? [],
  );
  await contexto.close();

  const errosDeHidratacao = erros.filter((erro) => /hydrat/i.test(erro));
  return {
    status: resposta?.status() ?? 0,
    viuPortugues: vistos.some((texto) => PALAVRA_PORTUGUESA.test(texto)),
    errosDeHidratacao,
    outrosErros: erros.length - errosDeHidratacao.length,
    catalogosBaixados,
  };
}

async function main() {
  const navegador = await chromium.launch();
  const leituras: Array<{ locale: string; leitura: Leitura }> = [];
  const falhas: string[] = [];
  for (const leitor of LEITORES_DE_CATALOGO) {
    const leitura = await ler(navegador, leitor.locale);
    leituras.push({ locale: leitor.locale, leitura });
    if (leitura.status >= 400) falhas.push(`a página não abriu em ${leitor.nome} (${leitura.status})`);
    if (leitura.viuPortugues) falhas.push(`a tela em ${leitor.nome} mostrou o português em algum momento`);
    if (leitura.catalogosBaixados[leitor.codigo] !== 1) {
      falhas.push(
        `o catálogo ${leitor.nome} chegou em ${leitura.catalogosBaixados[leitor.codigo] ?? 0} respostas (esperado 1)`,
      );
    }
    for (const [idioma, vezes] of Object.entries(leitura.catalogosBaixados)) {
      if (idioma !== leitor.codigo && vezes > 0) falhas.push(`quem lê em ${leitor.nome} baixou também o catálogo ${idioma}`);
    }
  }
  const portugues = await ler(navegador, "pt-BR");
  leituras.push({ locale: "pt-BR", leitura: portugues });
  await navegador.close();

  if (portugues.status >= 400) falhas.push(`a página não abriu em português (${portugues.status})`);
  for (const { leitura } of leituras) {
    for (const erro of leitura.errosDeHidratacao) falhas.push(`erro de hidratação: ${erro.slice(0, 200)}`);
  }
  for (const [idioma, vezes] of Object.entries(portugues.catalogosBaixados)) {
    if (vezes > 0) falhas.push(`quem lê em português baixou o catálogo ${idioma}`);
  }

  const relatorio = [
    "## Sonda do carregamento por idioma",
    "",
    `Página: \`${url}\``,
    "",
    "| Leitor | Status | Viu português | Erros de hidratação | Outros erros no console | Catálogos baixados |",
    "|---|---|---|---|---|---|",
    ...leituras.map(({ locale: nome, leitura }) => {
      const baixados = Object.entries(leitura.catalogosBaixados)
        .map(([idioma, vezes]) => `${idioma}: ${vezes}`)
        .join(", ");
      return `| ${nome} | ${leitura.status} | ${leitura.viuPortugues ? "sim" : "não"} | ${leitura.errosDeHidratacao.length} | ${leitura.outrosErros} | ${baixados} |`;
    }),
    "",
    falhas.length === 0 ? "Sonda aprovada." : `**${falhas.length} falha(s):**`,
    ...falhas.map((falha) => `- ${falha}`),
    "",
  ].join("\n");
  console.info(relatorio);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${relatorio}\n`);

  if (falhas.length > 0 && !soMedir) process.exit(1);
}

// Uma falha do próprio navegador (o `networkidle` que não chega, por exemplo)
// vira saída 1 com a causa no log, e não uma rejeição solta sem relatório.
main().catch((erro: unknown) => {
  console.error("[sonda] a sonda não terminou:", erro);
  process.exit(1);
});
