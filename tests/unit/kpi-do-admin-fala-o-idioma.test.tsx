/**
 * O PAINEL DO ADMIN FALA O IDIOMA DE QUEM O ABRE — inclusive o card do canal.
 *
 * Medido na v1.85.2 com o admin em turco: o card de sessões com problema dizia
 * "Alertas WAHA". O rótulo ficava fora de `t()` porque nomeava o provider, e a
 * doutrina de canal (`pnpm lint:channels`) não deixa esse nome entrar no
 * dicionário. Só que "Alertas" é português: a saída é o rótulo neutro de canal,
 * que o próprio comentário do card já previa.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KPICards } from "@/components/admin/dashboard/KPICards";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

const KPIS = {
  tenants_active: 3,
  conv_pending_10min: 0,
  waha_ban_alerts: 1,
  lgpd_at_risk: 0,
  ai_budget_warnings: 0,
  alerts: [],
};

describe("os cards de KPI do painel do admin", () => {
  it("em turco, o card das sessões com problema não fala português", () => {
    render(
      <IdiomaProvider locale="tr">
        <KPICards kpis={KPIS} />
      </IdiomaProvider>,
    );

    expect(screen.getByText("WhatsApp uyarıları")).toBeTruthy();
    expect(screen.queryByText(/Alertas/)).toBeNull();
  });

  it("o rótulo não nomeia o provider do canal", () => {
    render(
      <IdiomaProvider locale="pt-BR">
        <KPICards kpis={KPIS} />
      </IdiomaProvider>,
    );

    expect(screen.getByText("Alertas do WhatsApp")).toBeTruthy();
  });
});
