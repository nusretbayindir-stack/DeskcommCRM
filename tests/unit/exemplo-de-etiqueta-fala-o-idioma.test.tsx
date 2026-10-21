/**
 * O EXEMPLO DE ETIQUETA FALA O IDIOMA DA TELA.
 *
 * Medido na v1.85.2 com a interface em turco: o campo de etiquetas do novo
 * negócio e do novo contato mostrava "vip, recompra". O placeholder era
 * literal, fora de `t()`, e "recompra" é palavra portuguesa — sem acento, a
 * guarda de prosa portuguesa não o via.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { NewContactDialog } from "@/components/contacts/NewContactDialog";
import { NewLeadDialog } from "@/components/kanban/NewLeadDialog";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import type { Stage } from "@/lib/kanban/types";

vi.mock("@/hooks/kanban/useCreateLead", () => ({
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/contacts/useContactList", () => ({
  useContactList: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useActiveOrg: () => ({ currency: "EUR", country: "BE" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ETAPAS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Yeni", is_won: false, is_lost: false, is_archived: false },
] as unknown as Stage[];

function emTurco(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <IdiomaProvider locale="tr">{ui}</IdiomaProvider>
    </QueryClientProvider>,
  );
}

const placeholderDasEtiquetas = () => document.getElementById("tagsRaw")?.getAttribute("placeholder");

describe("o exemplo do campo de etiquetas", () => {
  it("no novo negócio, em turco", () => {
    emTurco(<NewLeadDialog open onOpenChange={() => {}} pipelineId="p-1" stages={ETAPAS} />);
    expect(screen.getByText("Etiketler (virgülle ayırın)")).toBeTruthy();
    expect(placeholderDasEtiquetas()).toBe("vip, sadık müşteri");
  });

  it("no novo contato, em turco", () => {
    emTurco(<NewContactDialog open onOpenChange={() => {}} onCriado={() => {}} />);
    expect(placeholderDasEtiquetas()).toBe("vip, sadık müşteri");
  });
});
