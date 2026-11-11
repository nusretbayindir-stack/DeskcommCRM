/**
 * A DATA DOS MARCOS DO PEDIDO DE DADOS SAI NO IDIOMA DE QUEM LÊ (doc S2a, Task 7).
 *
 * `SlaTimeline` escrevia `format(data, "dd 'de' MMM yyyy")` com o padrão fixo:
 * o mês vinha no idioma, o "de" no português — "19 de okt. 2026" para quem lê
 * em neerlandês (revisão do PR #47, M1; Review Focus 5 do plano). O padrão
 * passa por `t()`, como os outros padrões de data do produto.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SlaTimeline } from "@/app/app/lgpd/requests/[id]/SlaTimeline";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import type { Idioma } from "@/lib/i18n/idiomas";

const PEDIDO = {
  received_at: "2026-10-01T12:00:00.000Z",
  due_at: "2026-10-16T12:00:00.000Z",
  request_type: "access",
};

function datasDosMarcos(locale: Idioma): string[] {
  render(
    <IdiomaProvider locale={locale}>
      <SlaTimeline {...PEDIDO} />
    </IdiomaProvider>,
  );
  return screen.getAllByText(/\b2026\b/).map((no) => no.textContent ?? "");
}

afterEach(() => {
  cleanup();
});

describe("a data de cada marco do prazo", () => {
  it.each(["nl", "fr", "tr"] as const)("%s: sem o \"de\" do português", (locale) => {
    const datas = datasDosMarcos(locale);
    expect(datas.length).toBeGreaterThan(0);
    for (const data of datas) expect(data).not.toMatch(/\bde\b/);
  });

  it("português: o formato de sempre", () => {
    const datas = datasDosMarcos("pt-BR");
    expect(datas.length).toBeGreaterThan(0);
    for (const data of datas) expect(data).toMatch(/^\d{2} de \S+ 2026$/);
  });
});
