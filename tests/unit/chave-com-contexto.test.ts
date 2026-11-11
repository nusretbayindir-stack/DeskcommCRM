import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import { semContexto } from "@/lib/i18n/no-contexto";
import { NAV_GROUPS } from "@/lib/navigation/catalogo";

/**
 * A MESMA FRASE EM PORTUGUÊS, DOIS SENTIDOS NOUTRA LÍNGUA (doc S2a, Task 7).
 *
 * "Atendimento" é o grupo do menu, a aba de Equipe e o tipo da lista de espera;
 * em francês a leitora quer "Conversations" só no menu. "Salvar plano" é a
 * formule do faturamento e o plano de tarefas. "Autenticação" é a categoria
 * de modelo do Meta (em neerlandês "Verificatie") e a autenticação do servidor
 * MCP. A chave com contexto (`"<frase>@@<contexto>"`) separa os sentidos sem
 * mudar uma letra do português nem do espanhol: o português lê a frase, e a
 * língua que não tem entrada própria para o contexto cai na da frase.
 */
const RAIZ = join(__dirname, "..", "..");
const fonte = (caminho: string) => readFileSync(join(RAIZ, caminho), "utf8");

describe("a chave com contexto", () => {
  it("o português lê só a frase", () => {
    expect(traduzir("Atendimento@@menu", "pt-BR")).toBe("Atendimento");
    expect(semContexto("Salvar plano@@tarefas")).toBe("Salvar plano");
  });

  it("frase sem contexto e e-mail não mudam", () => {
    expect(semContexto("Atendimento")).toBe("Atendimento");
    expect(semContexto("suporte@empresa.com")).toBe("suporte@empresa.com");
    expect(traduzir("frase que não existe@@lugar", "pt-BR")).toBe("frase que não existe");
  });

  it("língua sem entrada própria para o contexto cai na tradução da frase", () => {
    expect(traduzir("Atendimento@@menu", "es")).toBe(traduzir("Atendimento", "es"));
    expect(traduzir("Atendimento@@menu", "tr")).toBe(traduzir("Atendimento", "tr"));
    expect(traduzir("Atendimento@@menu", "nl")).toBe("Klantcontact");
    expect(traduzir("frase que não existe@@lugar", "fr")).toBe("frase que não existe");
  });
});

describe("os três sentidos separados", () => {
  it("francês: o menu diz Conversations; a aba de Equipe segue Prise en charge", () => {
    const grupo = NAV_GROUPS.find((g) => g.id === "atendimento");
    expect(grupo && traduzir(grupo.label, "fr")).toBe("Conversations");
    expect(grupo && traduzir(grupo.label, "pt-BR")).toBe("Atendimento");
    expect(traduzir("Atendimento", "fr")).toBe("Prise en charge");
  });

  it("neerlandês: a categoria de modelo do Meta é Verificatie; o servidor MCP segue Authenticatie", () => {
    expect(fonte("app/app/campaigns/_components/ModeloDaCampanha.tsx")).toContain(
      'AUTHENTICATION: "Autenticação@@categoria-meta"',
    );
    expect(traduzir("Autenticação@@categoria-meta", "nl")).toBe("Verificatie");
    expect(traduzir("Autenticação", "nl")).toBe("Authenticatie");
    expect(traduzir("Autenticação@@categoria-meta", "pt-BR")).toBe("Autenticação");
  });

  it("francês: o plano de tarefas é plan; o do faturamento segue formule", () => {
    expect(fonte("app/app/tasks/planos/_client.tsx")).toContain('t("Salvar plano@@tarefas")');
    expect(fonte("app/admin/(protected)/cobranca/_planos.tsx")).toContain('t("Salvar plano")');
    expect(traduzir("Salvar plano@@tarefas", "fr")).toBe("Enregistrer le plan");
    expect(traduzir("Salvar plano", "fr")).toBe("Enregistrer la formule");
  });
});
