"use client";

import { Fragment } from "react";

import { useT } from "@/hooks/i18n/useT";
import { marcadoresDaTela } from "@/lib/ai/rag/ingest/marcadores-de-faq";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";

/**
 * A linha de ajuda sob o campo de conteúdo de FAQ: os marcadores aparecem em
 * `<code>`, na língua de quem está olhando. A frase é traduzida inteira, com
 * `{pergunta}`/`{resposta}` no lugar que cada língua escolhe.
 */
export function DicaDeMarcadores() {
  const t = useT();
  const marcadores = marcadoresDaTela(useIdioma());
  const frase = t("Uma linha {pergunta} e uma {resposta} por item, separados por uma linha em branco.");
  return (
    <>
      {frase.split(/(\{pergunta\}|\{resposta\})/).map((parte, i) =>
        parte === "{pergunta}" || parte === "{resposta}" ? (
          <code key={i}>{marcadores[parte === "{pergunta}" ? "pergunta" : "resposta"]}</code>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        ),
      )}
    </>
  );
}
