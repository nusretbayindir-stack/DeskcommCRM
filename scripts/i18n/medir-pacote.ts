/**
 * Mede o pacote de produção do navegador e confere onde cada catálogo foi parar.
 *
 *   pnpm build && pnpm tsx scripts/i18n/medir-pacote.ts [--so-medir]
 *
 * Lê `.next/static/chunks`, escreve a tabela de tamanho (bruto, gzip, brotli)
 * do total, da parte do dicionário e da parte de cada catálogo, e a anexa ao
 * resumo do job quando `GITHUB_STEP_SUMMARY` existe. Sai 1 se o pacote viola a
 * régua de `./pacote.ts`; com `--so-medir`, sai 0 sempre (é a medição de base,
 * antes de o carregamento por idioma existir). Casca fina de I/O.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { DICIONARIO } from "../../lib/i18n/dicionario";
import {
  CHAVE_SENTINELA,
  ondeEstaCadaCatalogo,
  sentinelasDosCatalogos,
  violacoesDoPacote,
  type ParteDoPacote,
} from "./pacote";

const RAIZ = join(__dirname, "..", "..");
const PASTA_DO_PACOTE = join(RAIZ, ".next", "static", "chunks");
const PASTA_DOS_CATALOGOS = join(RAIZ, "lib", "i18n", "traducoes");
const soMedir = process.argv.includes("--so-medir");

function arquivosJs(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivosJs(caminho);
    return nome.endsWith(".js") ? [caminho] : [];
  });
}

if (!existsSync(PASTA_DO_PACOTE)) {
  console.error(`${PASTA_DO_PACOTE} não existe; rode \`pnpm build\` antes`);
  process.exit(2);
}

const partes: ParteDoPacote[] = arquivosJs(PASTA_DO_PACOTE).map((caminho) => ({
  nome: caminho.slice(PASTA_DO_PACOTE.length + 1).split("\\").join("/"),
  conteudo: readFileSync(caminho, "utf8"),
}));

const catalogos = Object.fromEntries(
  readdirSync(PASTA_DOS_CATALOGOS)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => [
      nome.replace(/\.json$/, ""),
      JSON.parse(readFileSync(join(PASTA_DOS_CATALOGOS, nome), "utf8")) as Record<string, string>,
    ]),
);
const sentinelas = sentinelasDosCatalogos(catalogos);
const sentinelaDoDicionario = DICIONARIO[CHAVE_SENTINELA]?.es;
if (!sentinelaDoDicionario) {
  console.error(`o dicionário não tem o espanhol de "${CHAVE_SENTINELA}"; a régua ficaria cega`);
  process.exit(2);
}

function tamanhos(conteudos: readonly string[]): string {
  const bruto = Buffer.from(conteudos.join(""));
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  return `${kb(bruto.length)} | ${kb(gzipSync(bruto).length)} | ${kb(brotliCompressSync(bruto).length)}`;
}

const conteudoDe = (nomes: readonly string[]) =>
  partes.filter((parte) => nomes.includes(parte.nome)).map((parte) => parte.conteudo);
const doDicionario = partes.filter((parte) => parte.conteudo.includes(sentinelaDoDicionario)).map((p) => p.nome);
const onde = ondeEstaCadaCatalogo(partes, sentinelas);
const violacoes = violacoesDoPacote(partes, sentinelas, sentinelaDoDicionario);

const linhas = [
  "## Catálogos no pacote do navegador",
  "",
  "| O quê | Partes | Bruto | gzip | brotli |",
  "|---|---|---|---|---|",
  `| Todo o pacote | ${partes.length} | ${tamanhos(partes.map((parte) => parte.conteudo))} |`,
  `| Dicionário | ${doDicionario.join(", ") || "—"} | ${tamanhos(conteudoDe(doDicionario))} |`,
  ...Object.entries(onde).map(
    ([idioma, nomes]) => `| Catálogo \`${idioma}\` | ${nomes.join(", ") || "—"} | ${tamanhos(conteudoDe(nomes))} |`,
  ),
  "",
  violacoes.length === 0 ? "Nenhuma violação." : `**${violacoes.length} violação(ões):**`,
  ...violacoes.map((violacao) => `- ${violacao}`),
  "",
];
const relatorio = linhas.join("\n");
console.info(relatorio);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${relatorio}\n`);

if (violacoes.length > 0 && !soMedir) process.exit(1);
