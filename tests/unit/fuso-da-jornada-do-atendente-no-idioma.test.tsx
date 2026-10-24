/**
 * O seletor de fuso do diálogo da jornada (Equipe › Atendentes) mostra o nome
 * do lugar no idioma da tela; o valor da opção segue sendo o código IANA.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ScheduleDialog } from "@/app/app/team/_components/AttendantsClient";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

afterEach(cleanup);

function abrir(locale: "tr" | "pt-BR") {
  render(
    <IdiomaProvider locale={locale}>
      <ScheduleDialog
        attendant={{
          userId: "11111111-1111-4111-8111-111111111111",
          name: "Ana",
          email: null,
          availability: {
            user_id: "11111111-1111-4111-8111-111111111111",
            role: "agent",
            name: "Ana",
            email: "ana@exemplo.com",
            is_available: true,
            capacity: 5,
            schedule: { timezone: "Europe/Brussels", windows: [] },
            updated_at: "2026-10-01T12:00:00.000Z",
            current_load: 0,
            last_heartbeat_at: null,
            present: false,
          },
        }}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        isPending={false}
        organizationTimezone="Europe/Brussels"
      />
    </IdiomaProvider>,
  );
}

describe("fuso da jornada do atendente", () => {
  it("em turco mostra o rótulo em turco e nenhum rótulo em português", () => {
    abrir("tr");
    const opcoes = Array.from(document.querySelectorAll<HTMLOptionElement>("#tz option"));
    const bruxelas = opcoes.find((o) => o.value === "Europe/Brussels");
    expect(bruxelas?.textContent).toBe("Brüksel (Belçika) — Europe/Brussels");
    expect(screen.queryByText(/Bruxelas|Bélgica/)).toBeNull();
  });

  it("em português fica como hoje", () => {
    abrir("pt-BR");
    const bruxelas = document.querySelector<HTMLOptionElement>('#tz option[value="Europe/Brussels"]');
    expect(bruxelas?.textContent).toBe("Bruxelas (Bélgica) — Europe/Brussels");
  });
});
