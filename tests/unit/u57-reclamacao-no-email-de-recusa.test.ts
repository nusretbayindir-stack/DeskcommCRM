/**
 * U57: O E-MAIL DE RECUSA DIZ QUE O TITULAR PODE RECLAMAR (art. 12.º, n.º 4 do RGPD).
 *
 * Quem não atende o pedido do titular diz POR QUÊ e diz que ele pode reclamar à
 * autoridade de controlo ou ir aos tribunais. O texto pronto do painel (U53) já
 * dizia; o e-mail de recusa, não.
 *
 * Decisão de produto de 2026-11-15, opção (b): a frase entra no e-mail de recusa
 * só na Bélgica e na Turquia, e só com autoridade no perfil do país. Portugal
 * fica como estava (o byte a byte mora em `lgpd-relatorio-no-idioma-do-titular`).
 * A Turquia ainda não tem perfil (M1): quando ele entrar com a autoridade, a
 * frase sai sem mudar código — é o que o perfil turco de mentira daqui mede.
 */
import { describe, expect, it } from "vitest";

import type { MarcaDeSaida } from "@/lib/branding/saida";
import type { Idioma } from "@/lib/i18n/idiomas";
import { montarAvisoArt12, prazoDeUmMes, type DesfechoDoPedido } from "@/lib/lgpd/avisos-do-artigo-12";
import {
  linhaDaReclamacao,
  linhaDaReclamacaoNoEmail,
  reclamacaoVaiNoEmail,
} from "@/lib/lgpd/direito-de-reclamar";
import { perfilDoPais, type PerfilDoPais } from "@/lib/legal/perfil-do-pais";

const MARCA: MarcaDeSaida = {
  nome: "Silva & Filhos",
  logoUrl: null,
  accent: "#2f6f4e",
  accentFg: "#ffffff",
  origens: { nome: "banco", cor: "banco" },
};

const RECEBIDO = new Date("2026-09-10T12:00:00Z");

const BELGICA = perfilDoPais("BE");
const PORTUGAL = perfilDoPais("PT");
const BRASIL = perfilDoPais("BR");

/** O perfil turco que ainda não existe (M1), com a autoridade que ele vai declarar. */
const TURQUIA: PerfilDoPais = {
  ...BELGICA,
  codigo: "TR",
  nome: "Turquia",
  autoridadeDeSupervisao: { nome: "Kişisel Verileri Koruma Kurulu (KVKK)", site: "https://www.kvkk.gov.tr" },
};

function aviso(perfil: PerfilDoPais, idioma: Idioma | undefined, desfecho: DesfechoDoPedido = "recusa") {
  return montarAvisoArt12({
    desfecho,
    motivo: desfecho === "apagamento" ? null : "não conseguimos confirmar quem pediu",
    requestId: "abcd1234-ef00-4000-8000-000000000000",
    marca: MARCA,
    perfil,
    prazoDeUmMes: prazoDeUmMes(RECEBIDO),
    recebidoEm: RECEBIDO,
    agora: new Date("2026-09-11T12:00:00Z"),
    idioma,
  });
}

/** Quantas vezes `parte` aparece em `texto`. */
const vezes = (texto: string, parte: string) => texto.split(parte).length - 1;

describe("a recusa na Bélgica diz que o titular pode reclamar", () => {
  it("nl: à GBA, com o site, uma vez no html e uma no texto", () => {
    const { html, text } = aviso(BELGICA, "nl");
    const frase = linhaDaReclamacao(BELGICA, "nl")!;

    expect(frase).toContain("klacht");
    expect(frase).toContain("Gegevensbeschermingsautoriteit (GBA)");
    expect(frase).toContain("https://www.gegevensbeschermingsautoriteit.be");
    expect(vezes(text, frase)).toBe(1);
    expect(vezes(html, "klacht")).toBe(1);
    expect(html).toContain("Gegevensbeschermingsautoriteit (GBA)");
  });

  it("fr: à APD, no nome francês, sem o nome neerlandês", () => {
    const { html, text } = aviso(BELGICA, "fr");

    expect(vezes(text, "réclamation")).toBe(1);
    expect(vezes(html, "réclamation")).toBe(1);
    expect(text).toContain("Autorité de protection des données (APD)");
    expect(html + text).not.toContain("Gegevensbeschermingsautoriteit");
  });

  it("tr: o titular turco de uma empresa belga lê a frase em turco", () => {
    const { text } = aviso(BELGICA, "tr");
    expect(text).toContain("şikâyette bulunabilir");
    expect(text).toContain("Gegevensbeschermingsautoriteit (GBA)");
  });

  it("a frase entra antes da citação da lei, e o resto do aviso não muda", () => {
    const com = aviso(BELGICA, "nl").text.split("\n");
    const sem = aviso({ ...BELGICA, autoridadeDeSupervisao: undefined }, "nl").text.split("\n");
    const onde = com.indexOf(linhaDaReclamacao(BELGICA, "nl")!);

    expect(onde).toBeGreaterThan(0);
    expect(com.filter((_, i) => i !== onde)).toEqual(sem);
    // No aviso sem a frase, a linha que ela empurrou é a da citação da lei.
    expect(sem[onde]).toContain("GDPR");
  });

  it("apagamento e prorrogação não mudam: a frase é só da recusa", () => {
    for (const desfecho of ["apagamento", "prorrogacao"] as const) {
      for (const idioma of ["nl", "fr", undefined] as const) {
        const { html, text } = aviso(BELGICA, idioma, desfecho);
        expect(html + text, `${desfecho} ${idioma}`).not.toMatch(/klacht|réclamation|reclamação/);
      }
    }
  });
});

describe("só Bélgica e Turquia, e só com autoridade no perfil", () => {
  it("Portugal tem autoridade (CNPD), mas o e-mail fica como estava", () => {
    expect(PORTUGAL.autoridadeDeSupervisao).toBeDefined();
    expect(reclamacaoVaiNoEmail(PORTUGAL)).toBe(false);
    for (const idioma of ["fr", undefined] as const) {
      const { html, text } = aviso(PORTUGAL, idioma);
      expect(html + text).not.toContain("reclamação");
      expect(html + text).not.toContain("Comissão Nacional de Proteção de Dados");
    }
  });

  it("o Brasil não entra", () => {
    expect(reclamacaoVaiNoEmail(BRASIL)).toBe(false);
    expect(linhaDaReclamacaoNoEmail(BRASIL, undefined)).toBeNull();
  });

  it("a Turquia: com a autoridade no perfil, a frase sai sozinha, em turco", () => {
    expect(reclamacaoVaiNoEmail(TURQUIA)).toBe(true);
    const { text } = aviso(TURQUIA, "tr");
    expect(vezes(text, "şikâyette bulunabilir")).toBe(1);
    expect(text).toContain("Kişisel Verileri Koruma Kurulu (KVKK) (https://www.kvkk.gov.tr)");
  });

  it("sem autoridade no perfil não há frase — nada é inventado", () => {
    const semAutoridade: PerfilDoPais = { ...TURQUIA, autoridadeDeSupervisao: undefined };
    expect(reclamacaoVaiNoEmail(semAutoridade)).toBe(false);
    const { html, text } = aviso(semAutoridade, "tr");
    expect(html + text).not.toContain("şikâyet");

    const belgaSemAutoridade: PerfilDoPais = { ...BELGICA, autoridadeDeSupervisao: undefined };
    expect(aviso(belgaSemAutoridade, "nl").text).not.toContain("klacht");
  });

  it("o e-mail e o texto pronto do painel usam a mesma frase", () => {
    for (const idioma of ["nl", "fr", "tr", "es", undefined] as const) {
      expect(linhaDaReclamacaoNoEmail(BELGICA, idioma)).toBe(linhaDaReclamacao(BELGICA, idioma));
    }
  });
});
