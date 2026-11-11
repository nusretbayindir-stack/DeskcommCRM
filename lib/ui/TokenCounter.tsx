"use client";
import * as React from "react";
import { encode } from "gpt-tokenizer";

import { useT } from "@/hooks/i18n/useT";
import { tagDeIdioma } from "@/lib/i18n/datas";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";

interface Props {
  text: string;
  contextWindow?: number | null;
  className?: string;
}

// No idioma de quem lê (S2a Task 7b, U42): "tokens", os avisos e o formato do
// número eram fixos em português ("~830 tokens", `toLocaleString("pt-BR")`).
// O português sai igual.
export function TokenCounter({ text, contextWindow, className }: Props) {
  const t = useT();
  const tag = tagDeIdioma(useIdioma());
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    const espera = setTimeout(() => {
      try {
        setCount(encode(text ?? "").length);
      } catch {
        setCount(null);
      }
    }, 200);
    return () => clearTimeout(espera);
  }, [text]);

  if (count === null) {
    return (
      <span className={className} aria-live="polite">
        — {t("tokens")}
      </span>
    );
  }

  const ratio = contextWindow && contextWindow > 0 ? count / contextWindow : null;
  const warn = ratio !== null && ratio > 0.8;
  const danger = ratio !== null && ratio > 1;

  const tone = danger
    ? "text-destructive"
    : warn
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  return (
    <span className={`${tone} ${className ?? ""}`} aria-live="polite">
      ~{count.toLocaleString(tag)} {t("tokens")}
      {contextWindow ? ` / ${contextWindow.toLocaleString(tag)}` : ""}
      {warn && !danger ? ` · ${t("próximo do limite")}` : ""}
      {danger ? ` · ${t("acima do limite")}` : ""}
    </span>
  );
}
