"use client";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import { palavrasDePassagemPadrao } from "@/lib/ai/agents/palavras-de-passagem";
import { useIdioma } from "@/lib/i18n/IdiomaProvider";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function HandoffKeywordsInput({ value, onChange, disabled }: Props) {
  const t = useT();
  const idioma = useIdioma();
  // As sugestões "+ …" são palavras do cliente, no idioma da tela.
  const sugestoes = palavrasDePassagemPadrao(idioma);
  const [draft, setDraft] = React.useState("");

  function add(kw: string) {
    // A minúscula do idioma: em turco "İnsanla" → "insanla" e "CANLI" → "canlı".
    // O `toLowerCase` sem idioma deixava i + ponto combinante na palavra gravada.
    const trimmed = kw.trim().toLocaleLowerCase(idioma);
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (value.length >= 20) return;
    if (trimmed.length > 60) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(kw: string) {
    onChange(value.filter((x) => x !== kw));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="handoff_kw">{t("Palavras que chamam uma pessoa na hora")}</Label>
      <div className="flex flex-wrap gap-1 rounded-md border border-border/60 p-2">
        {value.map((kw) => (
          <button
            key={kw}
            type="button"
            onClick={() => !disabled && remove(kw)}
            className="group flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs hover:bg-destructive/15"
            disabled={disabled}
            aria-label={`${t("Remover")} ${kw}`}
          >
            {kw}
            <span className="text-muted-foreground group-hover:text-destructive">×</span>
          </button>
        ))}
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("Sem palavras-chave.")}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          id="handoff_kw"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={t("Digite uma expressão e aperte Enter")}
          disabled={disabled || value.length >= 20}
          maxLength={60}
        />
        <button
          type="button"
          className="rounded-md border border-border/60 px-3 text-xs hover:bg-muted"
          onClick={() => add(draft)}
          disabled={disabled || draft.trim() === ""}
        >
          {t("Adicionar")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {sugestoes.filter((d) => !value.includes(d)).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => add(d)}
            disabled={disabled}
            className="rounded-md border border-dashed border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          >
            + {d}
          </button>
        ))}
      </div>
    </div>
  );
}
