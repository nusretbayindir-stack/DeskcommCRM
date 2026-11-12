/**
 * A FONTE DOS DOCUMENTOS TRADUZIDOS DO TITULAR (S2a Task 13).
 *
 * As fontes padrão do PDF (Helvetica, Courier) só têm as letras da WinAnsi:
 * ç, é, ë, à e ñ passam; ş, ğ, ı e İ, não. Medido com o leitor de PDF do
 * produto: "şğıİĞŞ" sai como "_ 10 ^". O relatório em turco sairia ilegível, e
 * na Bélgica o nome de todo cliente com letra turca também.
 *
 * O documento traduzido usa a Liberation Sans: tem essas letras e as MESMAS
 * medidas da Helvetica, então a página não muda de desenho. O arquivo já vem
 * no `pdfjs-dist`, dependência do produto (o leitor de PDF do RAG), sob a
 * licença da Liberation (GPL com a exceção de fonte embutida em documento: o
 * documento não vira GPL).
 *
 * Brasil e Portugal (o texto-fonte) continuam na Helvetica: o PDF deles não muda.
 * Sem o arquivo, o documento sai na Helvetica e o log diz por quê — entregar o
 * relatório com letras trocadas é melhor que não entregar.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Font } from "@react-pdf/renderer";

import { logger } from "@/lib/logger";

const FAMILIA = "LiberationSans";

let estado: "nao_tentado" | "registrada" | "ausente" = "nao_tentado";

/** A família registrada para o documento traduzido, ou `undefined` (Helvetica). */
export function fonteDoDocumentoTraduzido(): string | undefined {
  if (estado === "nao_tentado") {
    // O worker roda na raiz do projeto (`WORKDIR /app`), onde está o `node_modules`.
    const pasta = join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts");
    const regular = join(pasta, "LiberationSans-Regular.ttf");
    const negrito = join(pasta, "LiberationSans-Bold.ttf");
    if (existsSync(regular) && existsSync(negrito)) {
      Font.register({ family: FAMILIA, fonts: [{ src: regular }, { src: negrito, fontWeight: "bold" }] });
      estado = "registrada";
    } else {
      estado = "ausente";
      logger.warn("[lgpd] fonte do documento traduzido ausente; o PDF sai na Helvetica", { pasta });
    }
  }
  return estado === "registrada" ? FAMILIA : undefined;
}
