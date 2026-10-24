/**
 * A regra que nasce ao clicar em "Adicionar regra" grava o rótulo no grafo — é
 * dado, não tela. Em português ele ficava "Nova regra" para o operador turco;
 * agora nasce no idioma de quem clicou.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MatchReplyForm } from "./MatchReplyForm";
import type { ConfigOf } from "./shared";

vi.mock("@/hooks/i18n/useT", () => ({
  useT: () => (texto: string) => (texto === "Nova regra" ? "Yeni kural" : texto),
}));
vi.mock("@/hooks/webhooks/useWebhookSources", () => ({
  usePipelines: () => ({ data: { data: [] } }),
}));

const CONFIG: ConfigOf<"match_reply"> = {
  branches: [{ id: "br_1", label: "Evet", op: "contains", pattern: "evet" }],
  grace_timeout_ms: 900_000,
};

describe("MatchReplyForm — regra nova", () => {
  it("nasce com o rótulo no idioma do operador", async () => {
    const gravados: ConfigOf<"match_reply">[] = [];
    render(<MatchReplyForm config={CONFIG} onChange={(c) => gravados.push(c)} />);
    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: /Adicionar regra/ }));
    expect(gravados.at(-1)!.branches.map((b) => b.label)).toEqual(["Evet", "Yeni kural"]);
  });
});
