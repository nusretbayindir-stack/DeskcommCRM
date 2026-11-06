/**
 * U40.f — o aviso das alíneas do art. 15.º, em turco, trazia a citação em
 * português («não informado pelo responsável pelo tratamento») dentro da frase
 * turca. A frase do documento agora passa pelo catálogo, por literal.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { traduzir } from "@/lib/i18n/dicionario";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (texto: string) => traduzir(texto, "tr") }));
vi.mock("@/lib/api/client", () => ({ apiClient: { patch: vi.fn() } }));

import { Art15Form } from "@/app/app/settings/tenant/_art15";

describe("aviso do art. 15.º em turco", () => {
  it.each(["PT", "BE", "TR"])("país %s: nenhuma palavra de português na frase", (pais) => {
    const { container } = render(
      <Art15Form pais={pais} initial={{ finalidades: "", destinatarios: "", prazo_conservacao: "" }} />,
    );
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/não informado/i);
    expect(texto).toContain("veri sorumlusu tarafından belirtilmedi");
  });
});
