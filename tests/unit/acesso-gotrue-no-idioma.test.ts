import { describe, expect, it } from "vitest";

import type { MarcaDeSaida } from "@/lib/branding/saida";
import {
  MODELOS_DE_ACESSO,
  assuntoDoModelo,
  montarTemplateDeAcesso,
  type ModeloDeAcesso,
} from "@/lib/email/templates/acesso-gotrue";
import fixture from "@/tests/fixtures/convites-2649-html-main.json";
import { renderizarMoldeGo } from "@/tests/helpers/molde-go-minimo";

/**
 * S2a Task 12: os e-mails de ACESSO (confirmar conta, redefinir senha) falam a
 * língua da pessoa. Quem decide o ramo é o GoTrue, na hora do envio, pelo
 * `user_metadata.locale` (`.Data.locale`) — o mesmo campo que o seletor de
 * idioma do topo grava (`app/actions/settings/trocarIdioma.ts`).
 *
 * Regra (spec §5.8, D9): `nl`, `fr` ou `tr` → só aquela língua; qualquer outra
 * coisa (sem idioma, `pt-BR`, `es`, `en`) → holandês e francês no mesmo e-mail.
 * O método foi provado ao vivo em 2026-11-09 (Task 3), assunto incluído.
 *
 * Os casos RENDERIZAM o molde com `tests/helpers/molde-go-minimo.ts`, que só
 * aceita as construções provadas no GoTrue: o teste mede o e-mail que a pessoa
 * recebe, não a presença de pedaços de texto no molde cru.
 */

const MARCA: MarcaDeSaida = {
  nome: "Marca Sintética",
  logoUrl: null,
  accent: "#506d48",
  accentFg: "#ffffff",
  origens: { nome: "instalacao", cor: "instalacao" },
};

const REDIRECT = "https://crm.exemplo.test/auth/confirm?type=recovery";
const HASH = "pkce_0123abcd";
const LINK = `${REDIRECT}&token_hash=${HASH}`;

const renderizar = (molde: string, locale?: unknown) =>
  renderizarMoldeGo(molde, {
    Data: locale === undefined ? {} : { locale },
    RedirectTo: REDIRECT,
    TokenHash: HASH,
  });

type Lingua = "nl" | "fr" | "tr";
const LINGUAS: readonly Lingua[] = ["nl", "fr", "tr"];

const TITULO: Record<ModeloDeAcesso, Record<Lingua, string>> = {
  confirmation: {
    nl: "Bevestig uw e-mailadres",
    fr: "Confirmez votre adresse e-mail",
    tr: "E-posta adresinizi onaylayın",
  },
  recovery: {
    nl: "Stel uw wachtwoord opnieuw in",
    fr: "Réinitialisez votre mot de passe",
    tr: "Şifrenizi sıfırlayın",
  },
};

const ASSUNTO: Record<ModeloDeAcesso, Record<Lingua | "ambos", string>> = {
  confirmation: {
    nl: "E-mailadres bevestigen",
    fr: "Confirmer l'adresse e-mail",
    tr: "E-posta onayı",
    ambos: "E-mailadres bevestigen / Confirmer l'adresse e-mail",
  },
  recovery: {
    nl: "Wachtwoord opnieuw instellen",
    fr: "Réinitialiser le mot de passe",
    tr: "Şifre sıfırlama",
    ambos: "Wachtwoord opnieuw instellen / Réinitialiser le mot de passe",
  },
};

/** Palavras do molde português de antes; nenhuma pode sobrar em ramo nenhum. */
const PORTUGUES =
  /(?<!\p{L})(você|seu|sua|senha|conta|clique|botão|abaixo|copie|cole|navegador|ignore|confirme|redefinir|recebemos|pedido|quase|pronta)(?!\p{L})/iu;

/** Idiomas registrados ou plausíveis que NÃO têm ramo próprio. */
const SEM_RAMO: ReadonlyArray<unknown> = [undefined, null, "", "pt-BR", "es", "en", "nl-BE"];

describe("e-mails de acesso no idioma da pessoa (S2a Task 12)", () => {
  for (const modelo of MODELOS_DE_ACESSO) {
    describe(modelo, () => {
      const molde = montarTemplateDeAcesso(modelo, MARCA);

      for (const lingua of LINGUAS) {
        it(`locale ${lingua} → só ${lingua}, com o link de token_hash`, () => {
          const html = renderizar(molde, lingua);
          expect(html.startsWith("<!doctype html>")).toBe(true);
          expect(html).toContain(`<html lang="${lingua}">`);
          expect(html).toContain(TITULO[modelo][lingua]);
          for (const outra of LINGUAS.filter((l) => l !== lingua)) {
            expect(html).not.toContain(TITULO[modelo][outra]);
          }
          expect(html).not.toMatch(PORTUGUES);
          // Botão e linha "copie e cole": as duas ocorrências levam ao mesmo link.
          expect(html.split(LINK).length - 1).toBe(2);
          expect(html).not.toContain("{{");
        });
      }

      it.each(SEM_RAMO.map((v) => [String(v), v]))("locale %s → holandês e depois francês", (_rotulo, locale) => {
        const html = renderizar(molde, locale);
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain('<html lang="nl">');
        expect(html).toContain('<div lang="fr">');
        const nl = html.indexOf(TITULO[modelo].nl);
        const fr = html.indexOf(TITULO[modelo].fr);
        expect(nl).toBeGreaterThan(-1);
        expect(fr).toBeGreaterThan(nl);
        expect(html).not.toContain(TITULO[modelo].tr);
        expect(html).not.toMatch(PORTUGUES);
        expect(html.split(LINK).length - 1).toBe(4);
      });

      it("o molde cru não tem português em ramo nenhum", () => {
        expect(molde).not.toMatch(PORTUGUES);
      });

      it("a marca entra escapada em todos os ramos — ela vem de texto livre no banco", () => {
        const marca = { ...MARCA, nome: 'Acme "Test" & Cia' };
        const m = montarTemplateDeAcesso(modelo, marca);
        for (const locale of [...LINGUAS, undefined]) {
          const html = renderizar(m, locale);
          expect(html).toContain("Acme &quot;Test&quot; &amp; Cia");
          expect(html).not.toContain('Acme "Test" & Cia');
        }
      });

      describe("assunto", () => {
        const assunto = assuntoDoModelo(modelo, MARCA);

        for (const lingua of LINGUAS) {
          it(`locale ${lingua} → assunto em ${lingua}, com a marca`, () => {
            expect(renderizar(assunto, lingua)).toBe(`${ASSUNTO[modelo][lingua]} · Marca Sintética`);
          });
        }

        it.each(SEM_RAMO.map((v) => [String(v), v]))("locale %s → assunto em holandês e francês", (_rotulo, locale) => {
          expect(renderizar(assunto, locale)).toBe(`${ASSUNTO[modelo].ambos} · Marca Sintética`);
        });

        it("cabe nos 255 caracteres do painel do Supabase", () => {
          // Medido na Task 3: o painel recusou 313 caracteres e aceitou 253
          // (259 bytes — o limite conta caracteres).
          for (const nome of ["Revenda X", 'Acme "Test" & Cia', "Marca Sintética"]) {
            const a = assuntoDoModelo(modelo, { ...MARCA, nome });
            expect(a.length).toBeLessThanOrEqual(255);
            // Uma marca de tamanho comum cabe: o assunto não a perde.
            expect(a.endsWith(` · ${nome}`)).toBe(true);
          }
        });

        it("marca longa demais: o assunto sai sem ela, mas cabe e continua no idioma", () => {
          const longa = { ...MARCA, nome: "Revenda Com Um Nome Comercial Muito Comprido Mesmo Para Um Assunto" };
          const a = assuntoDoModelo(modelo, longa);
          expect(a.length).toBeLessThanOrEqual(255);
          expect(renderizar(a, "fr")).toBe(ASSUNTO[modelo].fr);
          expect(renderizar(a, undefined)).toBe(ASSUNTO[modelo].ambos);
        });

        it("sem português", () => {
          expect(assunto).not.toMatch(PORTUGUES);
        });
      });
    });
  }

  it("a moldura continua a da main: fundo, fonte e logo idênticos ao fixture", () => {
    // `convite-email-html-preservado` prendia o molde português byte a byte.
    // O texto agora muda de propósito; a identidade visual não pode mudar.
    const caso = fixture.casos.find((c) => c.tipo === "confirmation" && c.marca.logoUrl);
    const esperado = caso?.esperado;
    if (!caso || typeof esperado !== "string") throw new Error("Falta o caso de acesso com logo no fixture da main.");
    const corpo = esperado.match(/<body[^>]*>/)?.[0];
    const logo = esperado.match(/<p style="margin:0 0 24px"><img[^>]*><\/p>/)?.[0];
    if (!corpo || !logo) throw new Error("O fixture da main mudou de forma.");
    for (const modelo of MODELOS_DE_ACESSO) {
      const molde = montarTemplateDeAcesso(modelo, caso.marca as MarcaDeSaida);
      for (const locale of [...LINGUAS, undefined]) {
        const html = renderizar(molde, locale);
        expect(html).toContain(corpo);
        expect(html).toContain(logo);
        // Um logo por e-mail, mesmo no ramo bilíngue.
        expect(html.split("<img").length - 1).toBe(1);
      }
    }
  });
});
