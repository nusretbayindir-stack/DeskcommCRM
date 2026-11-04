import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const idioma = vi.hoisted(() => ({ valor: "pt-BR" }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => idioma.valor }));
vi.mock("@/lib/legal/operador", () => ({
  resolverOperador: async () => ({
    sistema: "Marca da Revenda",
    nome: null,
    razaoSocial: null,
    cnpj: null,
    dpoEmail: null,
    politicaPropria: null,
    resolvido: false,
    // Coluna vazia = Brasil (lib/legal/perfil-do-pais.ts). O vocabulário da
    // política em PT é coberto por `lgpd-rotulos-por-pais.test.tsx` (#2344).
    pais: null as string | null,
  }),
  nomeDoOperador: (op: { razaoSocial: string | null; nome: string | null }, sem: string) =>
    op.razaoSocial ?? op.nome ?? sem,
}));

import PrivacyPage from "./page";

beforeEach(() => {
  idioma.valor = "pt-BR";
});

describe("/legal/privacy — seção dos dados do Google", () => {
  // O Google recusou a verificação do app porque a política padrão explicava a
  // LGPD e não dizia nada sobre os dados da conta Google. Cada trecho abaixo é
  // uma exigência da política de dados de usuário dos serviços de API do Google.
  it("declara o que é lido, para quê, que não se vende nem treina modelo, e como desfazer", async () => {
    const { container } = render(await PrivacyPage());
    const texto = container.textContent ?? "";

    expect(container.querySelector("#dados-do-google")).not.toBeNull();
    expect(texto).toContain("9. Dados do Google (Agenda, Meet e Google Ads)");
    expect(texto).toContain("Google Agenda:");
    expect(texto).toContain("O sistema não lê e-mails");
    expect(texto).toContain("Google Meet:");
    expect(texto).toContain("espaços de reunião do Google Meet");
    expect(texto).toContain("Google Ads:");
    expect(texto).toContain("não são vendidos");
    expect(texto).toContain("não são usados para publicidade");
    expect(texto).toContain("não são usados para treinar modelos de inteligência artificial");
    expect(texto).toContain("Política de Dados de Usuário dos Serviços de API do Google");
    expect(texto).toContain("requisitos de Uso Limitado");
    expect(texto).toContain("Agenda → Desconectar");

    const revogar = container.querySelector('a[href="https://myaccount.google.com/permissions"]');
    expect(revogar).not.toBeNull();
  });

  it("a política continua sendo a mesma LGPD de antes: as oito seções originais seguem", async () => {
    const { container } = render(await PrivacyPage());
    const titulos = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(titulos.slice(0, 8)).toEqual([
      "1. Quem é o controlador",
      "2. Que dados são tratados",
      "3. Para que são usados",
      "4. Com quem são compartilhados",
      "5. Por quanto tempo",
      "6. Seus direitos",
      "7. Segurança",
      "8. Encarregado e contato",
    ]);
  });
});

describe("/legal/privacy — os dois papéis do modelo de serviço", () => {
  it("separa os dois papéis e não promete fluxo automático", async () => {
    const { container } = render(await PrivacyPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("o controlador é essa empresa:");
    expect(texto).toContain("o controlador é o prestador de serviço indicado no contrato");
    expect(texto).toContain("Anexo 2 do contrato de serviço");
    expect(texto).toContain("exportar os dados por 30 dias");
    expect(texto).toContain("Envie o seu pedido à empresa que trata os seus dados");
    expect(texto).not.toContain("fluxo próprio");
    expect(texto).not.toContain("servidor do operador");
  });

  it("o Brasil não declara autoridade: a linha de reclamação não aparece", async () => {
    const { container } = render(await PrivacyPage());
    expect(container.textContent).not.toContain("autoridade de proteção de dados");
  });

  it("visitante sem sessão, em turco, lê tudo em turco", async () => {
    idioma.valor = "tr";
    const { container } = render(await PrivacyPage());
    const texto = container.textContent ?? "";

    expect(texto).toContain("sizinle yazışan işletme");
    expect(texto).not.toContain("a empresa que fala com você");
    expect(texto).not.toMatch(/prestador|contrato de serviço|operador/i);
  });
});
