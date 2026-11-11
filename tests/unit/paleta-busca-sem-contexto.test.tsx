/**
 * A BUSCA DO ⌘K NÃO CASA COM O CONTEXTO DA CHAVE (Task 7b; revisão do #47, M2).
 *
 * O grupo do menu "Atendimento" tem a chave `"Atendimento@@menu"` desde a
 * Task 7, para o francês dizer "Conversations" só ali. A tela do grupo passa
 * por `t()`, que tira o contexto; o texto de busca da paleta juntava o rótulo
 * cru, e digitar "menu" achava todo destino de Atendimento.
 *
 * A busca continua sobre o texto em português (comportamento do upstream);
 * só o sufixo `@@menu` sai.
 *
 *     pnpm vitest run tests/unit/paleta-busca-sem-contexto.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// A paleta navega ao escolher; aqui o assunto é só a busca.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { PaletaDeDestinos } from "@/components/shell/PaletaDeDestinos";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { ChatCircle } from "@/lib/ui/icons";

afterEach(cleanup);

function paleta() {
  render(
    <IdiomaProvider locale="pt-BR">
      <PaletaDeDestinos
        open
        onOpenChange={() => {}}
        destinos={[{ href: "/app/inbox", label: "Caixa de entrada", description: "Conversas", group: "atendimento", icon: ChatCircle }]}
        grupos={[{ id: "atendimento", label: "Atendimento@@menu" }]}
        titulo="Ir para"
        rotuloLista="Destinos"
        placeholder="Buscar"
      />
    </IdiomaProvider>,
  );
  return screen.getByPlaceholderText("Buscar");
}

function destinosNaTela(): number {
  return screen.queryAllByText("Caixa de entrada").length;
}

describe("a busca da paleta e o contexto do grupo", () => {
  it("o nome do grupo, sem contexto, ainda acha o destino", () => {
    fireEvent.change(paleta(), { target: { value: "atendimento" } });
    expect(destinosNaTela()).toBeGreaterThan(0);
  });

  it("o sufixo do contexto não acha nada", () => {
    fireEvent.change(paleta(), { target: { value: "menu" } });
    expect(destinosNaTela()).toBe(0);
  });
});
