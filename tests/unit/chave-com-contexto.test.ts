import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { traduzir } from "@/lib/i18n/dicionario";
import { semContexto } from "@/lib/i18n/no-contexto";
import { NAV_GROUPS } from "@/lib/navigation/catalogo";

import { arquivosDeCodigo, caminhoRelativo } from "./helpers/varrer-codigo";

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

/**
 * "LIGAR" É TELEFONAR E É LIGAR/DESLIGAR (Task 7b, U41).
 *
 * O botão da fila do Cold Call usava `t("Ligar")`, e a tradução dessa chave é a
 * do interruptor: o turco lia "Aç" (abrir), o espanhol "Activar". O botão de
 * telefonar ganha o contexto `chamada`; os interruptores seguem na frase.
 */
describe("o botão de telefonar do Cold Call", () => {
  it("usa a chave de telefonar, e cada língua diz telefonar", () => {
    const tela = fonte("app/app/cold-call/_client.tsx");
    expect(tela).toContain('t("Ligar@@chamada")');
    expect(tela).not.toContain('t("Ligar")');
    expect(traduzir("Ligar@@chamada", "pt-BR")).toBe("Ligar");
    expect(traduzir("Ligar@@chamada", "es")).toBe("Llamar");
    expect(traduzir("Ligar@@chamada", "tr")).toBe("Ara");
    expect(traduzir("Ligar@@chamada", "nl")).toBe("Bellen");
    expect(traduzir("Ligar@@chamada", "fr")).toBe("Appeler");
  });

  it("os interruptores seguem na frase sem contexto", () => {
    expect(fonte("components/agenda/ClientePelaAgenda.tsx")).toContain('t("Ligar")');
    expect(fonte("app/app/webhooks/_components/RulesTab.tsx")).toContain('t("Ligar")');
    expect(traduzir("Ligar", "tr")).toBe("Aç");
    expect(traduzir("Ligar", "es")).toBe("Activar");
  });
});

/**
 * O CONTEXTO MAL ESCRITO NÃO É TIRADO, E O BRASIL VÊ A CHAVE CRUA (revisão do
 * #47, M3).
 *
 * `semContexto` só tira `@@` seguido de minúsculas, dígitos e hífen, no fim.
 * `t("Salvar plano@@Tarefas")` ou `@@tarefas_v2` apareceriam inteiros em
 * português. Toda chave com `@@` — literal no código ou chave de catálogo —
 * tem de ter exatamente essa forma.
 */
// A frase não termina em espaço: "Salvar plano @@tarefas" daria ao Brasil
// "Salvar plano " (revisão do #48, M4).
const FORMA_DO_CONTEXTO = /^[^@]*[^@\s]@@[a-z0-9-]+$/;
const LITERAL_COM_ARROBAS = /(["'`])([^"'`\n]*@@[^"'`\n]*)\1/g;

/**
 * Todo literal da linha que contém `@@` — inclusive os mal formados, que são o
 * que a guarda existe para pegar. Ficam de fora só o operador de busca textual
 * do SQL (` @@ `, entre espaços) e o `"@@"` sozinho de `no-contexto.ts`.
 */
function literaisComArrobasEm(linha: string): string[] {
  return [...linha.matchAll(LITERAL_COM_ARROBAS)]
    .map((m) => m[2] ?? "")
    .filter((literal) => literal !== "@@" && !/\s@@\s/.test(literal));
}

function literaisComContexto(): { chave: string; local: string }[] {
  const achados: { chave: string; local: string }[] = [];
  for (const arquivo of arquivosDeCodigo(["app", "components", "lib", "hooks", "workers", "curso"])) {
    const linhas = readFileSync(arquivo, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      // Comentário explica a forma (`"<frase>@@<contexto>"`); não é chave.
      if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;
      for (const chave of literaisComArrobasEm(linha)) {
        achados.push({ chave, local: `${caminhoRelativo(arquivo)}:${i + 1}` });
      }
    });
  }
  return achados;
}

function chavesDeCatalogoComContexto(): { chave: string; local: string }[] {
  return ["tr", "nl", "fr", "en"].flatMap((idioma) => {
    const catalogo = JSON.parse(fonte(`lib/i18n/traducoes/${idioma}.json`)) as Record<string, string>;
    return Object.keys(catalogo)
      .filter((chave) => chave.includes("@@"))
      .map((chave) => ({ chave, local: `${idioma}.json` }));
  });
}

describe("todo contexto tem a forma que semContexto tira", () => {
  const noCodigo = literaisComContexto();
  const nosCatalogos = chavesDeCatalogoComContexto();

  it("a varredura enxerga — o verde abaixo não é vacuidade", () => {
    expect(noCodigo.map((a) => a.chave)).toEqual(
      expect.arrayContaining(["Atendimento@@menu", "Autenticação@@categoria-meta", "Salvar plano@@tarefas"]),
    );
    expect(nosCatalogos.map((a) => a.chave)).toEqual(expect.arrayContaining(["Atendimento@@menu"]));
  });

  it("a regra reprova o que o semContexto não tira, e a frase vazia", () => {
    for (const ruim of ["Salvar plano@@Tarefas", "Salvar plano@@tarefas_v2", "Salvar plano@@"]) {
      expect(semContexto(ruim), ruim).toBe(ruim);
      expect(FORMA_DO_CONTEXTO.test(ruim), ruim).toBe(false);
    }
    // Este o semContexto tira, mas o português ficaria sem texto nenhum.
    expect(semContexto("@@menu")).toBe("");
    expect(FORMA_DO_CONTEXTO.test("@@menu")).toBe(false);
    expect(FORMA_DO_CONTEXTO.test("Salvar plano@@tarefas")).toBe(true);
    // Estes o semContexto tira, mas deixam lixo no português (revisão do #48, M4).
    expect(semContexto("Salvar plano @@tarefas")).toBe("Salvar plano ");
    expect(FORMA_DO_CONTEXTO.test("Salvar plano @@tarefas")).toBe(false);
    expect(FORMA_DO_CONTEXTO.test("Salvar plano@@tarefas v2")).toBe(false);
  });

  it("a varredura recolhe os mal formados, e não o operador do SQL", () => {
    expect(literaisComArrobasEm('t("Salvar plano @@tarefas")')).toEqual(["Salvar plano @@tarefas"]);
    expect(literaisComArrobasEm('t("Salvar plano@@tarefas v2")')).toEqual(["Salvar plano@@tarefas v2"]);
    expect(literaisComArrobasEm('t("@@menu")')).toEqual(["@@menu"]);
    expect(literaisComArrobasEm('.or(", c.content) @@ websearch_to_tsquery(")')).toEqual([]);
    expect(literaisComArrobasEm('const SEP = "@@";')).toEqual([]);
  });

  it("nenhuma chave com @@ fora da forma", () => {
    const fora = [...noCodigo, ...nosCatalogos]
      .filter(({ chave }) => !FORMA_DO_CONTEXTO.test(chave))
      .map(({ chave, local }) => `${local} → ${JSON.stringify(chave)}`);
    expect(fora).toEqual([]);
  });
});

/**
 * QUEM LÊ O RÓTULO DO GRUPO SEM PASSAR POR `t()` (revisão do #47, M2).
 *
 * A tela traduz `"Atendimento@@menu"` por `t()`, que tira o contexto. Dois
 * leitores pegavam o rótulo cru: a busca do ⌘K (digitar "menu" achava todo
 * destino de Atendimento — teste próprio em `paleta-busca-sem-contexto`) e o
 * montador do site do curso, que imprimia "Atendimento@@menu" como nome de grupo.
 */
describe("o curso não imprime o contexto", () => {
  it("o montador tira o contexto do nome do grupo", () => {
    expect(fonte("curso/montar.ts")).toMatch(/grupo: semContexto\(/);
  });
});
