/**
 * A FRASE COM NÚMERO É UMA CHAVE SÓ (S2a Task 7b, U41/U42).
 *
 * Quatro telas montavam a frase em pedaços — número, `t("pedaço")`, número —
 * e a ordem do português vazava para as outras línguas: o turco lia "Şunlara
 * sahipsiniz 1 materyal arşivde var ve…", "şu süredir duruyor: 10d", "Asistan
 * takip eder 5 saat içinde"; o uso de IA dizia "— 12% … (5 de 40)." com o "de"
 * do português e o número no formato brasileiro; o contador de tokens tinha
 * "tokens", "próximo do limite" e o formato `pt-BR` fixos.
 *
 * Agora cada frase é uma chave com lacuna (`{n}`, `{horas}`, `{dias}`…) e cada
 * língua põe o número onde a gramática dela pede, no formato dela. O português
 * sai letra por letra igual a antes.
 *
 *     pnpm vitest run tests/unit/frase-com-numero-numa-chave-so.test.tsx
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BasesDoAgente } from "@/app/app/ai/agents/[id]/_components/BasesDoAgente";
import type { MaterialDoAcervo } from "@/app/app/ai/agents/[id]/_components/BasesDoAgente";
import { RiskRadarList } from "@/app/app/radar/_components/RiskRadarList";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";
import { fraseDoContextoCaro } from "@/lib/ai/usage/frase-do-contexto-caro";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import type { Idioma } from "@/lib/i18n/idiomas";
import { TokenCounter } from "@/lib/ui/TokenCounter";

vi.mock("@/hooks/leads/useAtRiskLeads", () => ({ useAtRiskLeads: vi.fn() }));
vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

const RAIZ = join(__dirname, "..", "..");
const fonte = (caminho: string) => readFileSync(join(RAIZ, caminho), "utf8");

function naLingua(idioma: Idioma, filho: ReactNode) {
  const cliente = new QueryClient();
  return render(
    <QueryClientProvider client={cliente}>
      <IdiomaProvider locale={idioma}>{filho}</IdiomaProvider>
    </QueryClientProvider>,
  );
}

describe("radar de risco: há quanto tempo parado e quando o assistente volta", () => {
  function radar(idioma: Idioma, horasParado: number) {
    const daqui5h = new Date(Date.now() + 5 * 3_600_000 + 60_000).toISOString();
    vi.mocked(useAtRiskLeads).mockReturnValue({
      data: {
        items: [
          {
            id: "lead-1",
            title: "Negócio parado",
            contact_id: "c1",
            contact_name: "Ana",
            owner_user_id: null,
            owner_kind: null,
            owner_agent_id: null,
            owner_agent_name: null,
            assignee_kind: null,
            last_activity_at: null,
            hours_since_activity: horasParado,
            risk: "em_voo",
            in_flight: true,
            next_followup_at: daqui5h,
            conversation_id: null,
            pipeline_id: "p-1",
          },
        ],
        counts: { critico: 0, em_risco: 0, em_voo: 1 },
        total: 1,
        sem_proximo_passo: [],
        total_sem_proximo_passo: 0,
        propostas_vencidas_sem_retomada: [],
      },
      isLoading: false,
    } as never);
    naLingua(idioma, <RiskRadarList />);
  }

  it("português igual a antes", () => {
    radar("pt-BR", 240);
    expect(screen.getByText("parado há 10d")).toBeInTheDocument();
    expect(screen.getByText("Assistente retorna em 5h")).toBeInTheDocument();
  });

  it("turco: o número antes do verbo", () => {
    radar("tr", 240);
    expect(screen.getByText("10 gündür duruyor")).toBeInTheDocument();
    expect(screen.getByText("Asistan 5 saat içinde takip eder")).toBeInTheDocument();
  });

  it("turco: em horas", () => {
    radar("tr", 7);
    expect(screen.getByText("7 saattir duruyor")).toBeInTheDocument();
  });

  it("neerlandês e francês sem a abreviação do português", () => {
    radar("nl", 240);
    expect(screen.getByText("staat 10 dagen stil")).toBeInTheDocument();
    expect(screen.getByText("Assistent neemt over 5 uur opnieuw contact op")).toBeInTheDocument();
    cleanup();
    radar("fr", 240);
    // O getByText normaliza o espaço inseparável do DOM para espaço comum (e não o
    // texto procurado): procura com espaço comum, confere o inseparável no nó.
    expect(screen.getByText("à l'arrêt depuis 10 jours").textContent).toContain("10\u00a0jours");
    expect(screen.getByText("L'assistant relance dans 5 h").textContent).toContain("5\u00a0h");
  });
});

describe("material do acervo que o assistente não lê", () => {
  const material = (id: string): MaterialDoAcervo => ({
    id,
    name: id,
    source_type: "text",
    chunks_count: 3,
    last_index_status: "ready",
  });
  const aviso = (idioma: Idioma, n: number) => {
    const materiais = Array.from({ length: n }, (_, i) => material(`m${i}`));
    naLingua(idioma, <BasesDoAgente materiais={materiais} value={[]} onChange={() => {}} />);
    return screen.getByTestId("agente-acervo-de-fora").textContent;
  };

  it("português igual a antes", () => {
    expect(aviso("pt-BR", 1)).toBe(
      "Você tem 1 material no acervo e este assistente não lê nenhum. Ele vai responder de improviso sobre assuntos que já estão escritos.",
    );
    cleanup();
    expect(aviso("pt-BR", 2)).toBe(
      "Você tem 2 materiais no acervo e este assistente não lê nenhum. Ele vai responder de improviso sobre assuntos que já estão escritos.",
    );
  });

  it("turco numa frase só", () => {
    expect(aviso("tr", 1)).toBe(
      "Arşivde 1 materyaliniz var ve bu asistan onu okumuyor. Zaten yazılı olan konularda doğaçlama yanıt verir.",
    );
    cleanup();
    expect(aviso("tr", 3)).toBe(
      "Arşivde 3 materyaliniz var ve bu asistan hiçbirini okumuyor. Zaten yazılı olan konularda doğaçlama yanıt verir.",
    );
  });

  it("neerlandês e francês concordam com o número", () => {
    expect(aviso("nl", 1)).toMatch(/^U hebt 1 materiaal in het archief/);
    cleanup();
    expect(aviso("fr", 2)).toMatch(/^Vous avez 2 documents dans les archives et cet assistant n'en lit aucun\./);
  });
});

describe("uso de IA: o agente de contexto caro", () => {
  const medida = { medido: true, avisa: true, fatia: 0.12, percentual: 12, acima_do_limite: 1234, chamadas: 5000 };

  it("português igual a antes", () => {
    expect(fraseDoContextoCaro(medida, "pt-BR")).toBe(
      "12% das chamadas de turno passaram de 100 mil tokens de entrada nos últimos 30 dias (1.234 de 5.000).",
    );
  });

  it("turco: % antes do número, contador com barra", () => {
    expect(fraseDoContextoCaro(medida, "tr")).toBe(
      "Son 30 günde tur çağrılarının %12 kadarı 100 bin giriş token'ını aştı (1.234/5.000).",
    );
  });

  it("francês: espaço antes do %, número no formato belga", () => {
    const frase = fraseDoContextoCaro(medida, "fr");
    expect(frase).toMatch(/^12 % des appels/);
    expect(frase).toContain(" sur ");
    expect(frase).not.toContain("1.234");
  });

  it("a página usa a frase e não fixa o formato brasileiro", () => {
    const pagina = fonte("app/app/ai/usage/page.tsx");
    expect(pagina).toContain("fraseDoContextoCaro(aviso, idioma)");
    expect(pagina).not.toContain('toLocaleString("pt-BR")');
  });
});

describe("contador de tokens do prompt", () => {
  const contador = async (idioma: Idioma, janela: number) => {
    naLingua(idioma, <TokenCounter text={"palavra ".repeat(40)} contextWindow={janela} />);
    return (await screen.findByText(/^~/, {}, { timeout: 3000 })).textContent ?? "";
  };

  it("português igual a antes", async () => {
    expect(await contador("pt-BR", 200_000)).toMatch(/^~\d+ tokens \/ 200\.000$/);
    cleanup();
    expect(await contador("pt-BR", 10)).toMatch(/^~\d+ tokens \/ 10 · acima do limite$/);
  });

  it("turco: singular depois do número, aviso no idioma", async () => {
    expect(await contador("tr", 200_000)).toMatch(/^~\d+ token \/ 200\.000$/);
    cleanup();
    expect(await contador("tr", 10)).toMatch(/^~\d+ token \/ 10 · sınırın üzerinde$/);
  });

  it("francês: milhar no formato do idioma", async () => {
    const texto = await contador("fr", 200_000);
    expect(texto).not.toContain("200.000");
    expect(texto).toMatch(/^~\d+ tokens \/ 200\s000$/u);
  });
});
