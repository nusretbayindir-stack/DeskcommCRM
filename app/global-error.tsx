"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, idiomaDelNavegador, parseAcceptLanguage, type Idioma } from "@/lib/i18n/idiomas";
import { useTrocaComCatalogo } from "@/lib/i18n/useTrocaComCatalogo";

/** Marca o `<html>` desta página (`data-erro-global`): o `lang` dele é o nosso, não o do servidor. */
const MARCA_DA_PAGINA = "data-erro-global";

/**
 * O idioma que o SERVIDOR escreveu no `<html lang>` da página que caiu (U49) —
 * `idiomaDaRequisicao()` em `app/layout.tsx`: a preferência salva da pessoa, a
 * organização, o navegador, o país da instalação. É a melhor pista que esta
 * página tem, e a única que traz a preferência salva (ela não é legível no
 * navegador: mora no `user_metadata`).
 *
 * Lido ANTES do primeiro commit (no inicializador do `useState`): esta página
 * desenha o próprio `<html lang={idioma}>`, e depois do commit o atributo já é
 * o estado inicial dela. Quando o `<html>` já é o desta página (marcado com
 * `data-erro-global`), o `lang` não diz nada: `null`, e vale o navegador.
 * Hoje, quando o layout raiz falha no servidor, o Next manda a casca
 * `<html id="__next_error__">` sem `lang` — também `null`. A marca fica como
 * defesa para um `<html>` desta página que sobre de uma montagem anterior.
 */
function idiomaDoServidor(): Idioma | null {
  if (typeof document === "undefined") return null;
  const html = document.documentElement;
  if (html.hasAttribute(MARCA_DA_PAGINA)) return null;
  return parseAcceptLanguage(html.lang);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  // Parte do padrão (igual ao do servidor) e ajusta depois de montar, para não
  // quebrar a hidratação do único componente que não pode falhar.
  const [idioma, pintarIdioma] = useState<Idioma>(IDIOMA_PADRAO);
  // Capturado uma vez, antes de esta página reescrever o `<html lang>`.
  const [doServidor] = useState(idiomaDoServidor);

  // Sem provider aqui: o catálogo do idioma é baixado à parte no navegador, e
  // a página só troca de idioma com ele na mão (a regra do `IdiomaProvider`).
  const setIdioma = useTrocaComCatalogo(idioma, pintarIdioma);

  useEffect(() => {
    setIdioma(doServidor ?? idiomaDelNavegador(navigator.languages ?? [navigator.language]));
  }, [setIdioma, doServidor]);

  useEffect(() => {
    const id = Sentry.captureException(error);
    setEventId(id);
  }, [error]);

  const displayId = eventId ?? error.digest ?? "—";

  return (
    <html lang={idioma} data-erro-global="">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#fafaf9",
          color: "#1c1917",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "white",
            border: "1px solid #e7e5e4",
            borderRadius: 12,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.25rem",
              marginBottom: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => setIdioma("es")}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: 4,
                border: "1px solid",
                borderColor: idioma === "es" ? "#1c1917" : "#e7e5e4",
                background: idioma === "es" ? "#1c1917" : "white",
                color: idioma === "es" ? "white" : "#57534e",
                cursor: "pointer",
                fontWeight: idioma === "es" ? 600 : 400,
              }}
            >
              ES
            </button>
            <button
              type="button"
              onClick={() => setIdioma("pt-BR")}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: 4,
                border: "1px solid",
                borderColor: idioma === "pt-BR" ? "#1c1917" : "#e7e5e4",
                background: idioma === "pt-BR" ? "#1c1917" : "white",
                color: idioma === "pt-BR" ? "white" : "#57534e",
                cursor: "pointer",
                fontWeight: idioma === "pt-BR" ? 600 : 400,
              }}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setIdioma("tr")}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: 4,
                border: "1px solid",
                borderColor: idioma === "tr" ? "#1c1917" : "#e7e5e4",
                background: idioma === "tr" ? "#1c1917" : "white",
                color: idioma === "tr" ? "white" : "#57534e",
                cursor: "pointer",
                fontWeight: idioma === "tr" ? 600 : 400,
              }}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setIdioma("nl")}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: 4,
                border: "1px solid",
                borderColor: idioma === "nl" ? "#1c1917" : "#e7e5e4",
                background: idioma === "nl" ? "#1c1917" : "white",
                color: idioma === "nl" ? "white" : "#57534e",
                cursor: "pointer",
                fontWeight: idioma === "nl" ? 600 : 400,
              }}
            >
              NL
            </button>
            <button
              type="button"
              onClick={() => setIdioma("fr")}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: 4,
                border: "1px solid",
                borderColor: idioma === "fr" ? "#1c1917" : "#e7e5e4",
                background: idioma === "fr" ? "#1c1917" : "white",
                color: idioma === "fr" ? "white" : "#57534e",
                cursor: "pointer",
                fontWeight: idioma === "fr" ? 600 : 400,
              }}
            >
              FR
            </button>
          </div>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem", fontWeight: 600 }}>
            {traduzir("Algo deu errado", idioma)}
          </h1>
          <p style={{ color: "#57534e", margin: "0 0 1.5rem" }}>
            {traduzir(
              "Tente novamente em instantes. Se persistir, contate o suporte com o ID abaixo.",
              idioma,
            )}
          </p>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              background: "#f5f5f4",
              padding: "0.5rem",
              borderRadius: 6,
              marginBottom: "1rem",
              wordBreak: "break-all",
            }}
          >
            ID: {displayId}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                void copyToClipboard(displayId).then((ok) => {
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                });
              }}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #d6d3d1",
                background: "white",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {copied ? traduzir("Copiado!", idioma) : traduzir("Copiar ID", idioma)}
            </button>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid #1c1917",
                background: "#1c1917",
                color: "white",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {traduzir("Tentar de novo", idioma)}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
