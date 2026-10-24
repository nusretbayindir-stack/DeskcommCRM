/**
 * AS PALAVRAS QUE CHAMAM UMA PESSOA, no idioma de quem configura.
 *
 * Dois defeitos medidos montando os agentes da demo em turco:
 *
 *   1. Agente novo nascia com "falar com humano", "atendente" e "pessoa real",
 *      fosse qual fosse o idioma da tela — um cliente turco nunca escreve
 *      nenhuma das três. As sugestões "+ …" embaixo do campo, idem.
 *   2. O casamento era `toLowerCase` + substring. "İnsanla görüşmek istiyorum"
 *      vira `i̇nsanla` (i + ponto combinante) e não contém `insanla`; "CANLI
 *      DESTEK" vira `canli destek` e não contém `canlı destek`; quem digita
 *      sem teclado turco ("gercek kisi") não casa "gerçek kişi". Os pacotes da
 *      demo contornavam com a mesma palavra duas vezes ("insanla", "İnsanla").
 *
 * O casamento passa a dobrar caixa e acento dos dois lados, como a detecção
 * determinística do engine (`normalize` em human-handoff.ts) já faz.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/ai/agents/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { buildState } from "@/app/app/ai/agents/[id]/_components/AgentForm";
import { HandoffKeywordsInput } from "@/app/app/ai/agents/[id]/_components/HandoffKeywordsInput";
import { matchesHandoffKeyword, palavrasDePassagem } from "@/lib/agent-engine/agent/agent-config";
import { palavrasDePassagemPadrao } from "@/lib/ai/agents/palavras-de-passagem";
import { IDIOMAS } from "@/lib/i18n/idiomas";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

const t = (texto: string) => texto;

describe("as palavras padrão seguem o idioma", () => {
  it.each(IDIOMAS)("%s tem palavras padrão", (idioma) => {
    expect(palavrasDePassagemPadrao(idioma).length).toBeGreaterThan(0);
  });

  it("o português não muda", () => {
    expect(palavrasDePassagemPadrao("pt-BR")).toEqual(["falar com humano", "atendente", "pessoa real"]);
  });

  it("o pedido turco casa com as palavras turcas, e nenhuma é portuguesa", () => {
    const turcas = palavrasDePassagem(palavrasDePassagemPadrao("tr"));
    expect(matchesHandoffKeyword("Canlı destek istiyorum", turcas)).toBe(true);
    expect(matchesHandoffKeyword("Beni bir yetkiliye bağlayın", turcas)).toBe(true);
    expect(turcas).not.toContain("atendente");
  });

  it("agente novo em turco nasce com as palavras turcas", () => {
    expect(buildState({ version: null, t, idioma: "tr" }).handoff_keywords).toEqual([
      ...palavrasDePassagemPadrao("tr"),
    ]);
  });

  it("agente novo sem idioma segue o português", () => {
    expect(buildState({ version: null, t }).handoff_keywords).toEqual(["falar com humano", "atendente", "pessoa real"]);
  });

  it("as sugestões embaixo do campo seguem o idioma da tela", () => {
    render(
      <IdiomaProvider locale="tr">
        <HandoffKeywordsInput value={[]} onChange={() => {}} />
      </IdiomaProvider>,
    );
    expect(screen.getByRole("button", { name: "+ canlı destek" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ falar com humano" })).toBeNull();
  });

  it.each([
    ["İnsanla", "insanla"],
    ["CANLI DESTEK", "canlı destek"],
  ])("a palavra digitada em turco vira minúscula turca: %s → %s", (digitado, gravado) => {
    // `toLowerCase` fazia "İnsanla" virar i + ponto combinante: a sugestão
    // "insanla" não reconhecia a repetida, e o chip mostrava um ponto solto.
    const onChange = vi.fn();
    render(
      <IdiomaProvider locale="tr">
        <HandoffKeywordsInput value={[]} onChange={onChange} />
      </IdiomaProvider>,
    );
    const campo = screen.getByLabelText("Bir kişiyi hemen çağıran kelimeler");
    fireEvent.change(campo, { target: { value: digitado } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([gravado]);
  });
});

describe("o casamento dobra caixa e acento dos dois lados", () => {
  it.each([
    ["İnsanla görüşmek istiyorum", "insanla"],
    ["CANLI DESTEK lütfen", "canlı destek"],
    ["YETKİLİ BİRİ var mı?", "yetkili biri"],
    ["gercek kisi lazim", "gerçek kişi"],
    ["insanla konuşmak istiyorum", "İnsanla"],
    ["Quero FALAR COM HUMANO", "falar com humano"],
  ])("%s casa com %s", (mensagem, palavra) => {
    expect(matchesHandoffKeyword(mensagem, palavrasDePassagem([palavra]))).toBe(true);
  });

  it("sem a palavra, não casa", () => {
    expect(matchesHandoffKeyword("quero comprar", palavrasDePassagem(["atendente"]))).toBe(false);
    expect(matchesHandoffKeyword("Kombi arızalı", palavrasDePassagem(["yetkiliyle"]))).toBe(false);
  });
});
