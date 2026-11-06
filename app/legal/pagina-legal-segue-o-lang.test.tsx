/**
 * U38.a — o "Voltar" do topo e o título da aba das páginas legais seguem o
 * `?lang=` escolhido, não o idioma do navegador.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const busca = vi.hoisted(() => ({ lang: null as string | null }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(busca.lang ? `lang=${busca.lang}` : ""),
  redirect: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "nl-BE" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: async () => null }));
vi.mock("@/lib/instalacao/config", () => ({ valorDaInstalacao: async () => ({ valor: "BE" }) }));
vi.mock("@/lib/i18n/idiomaAnonimo", () => ({ idiomaDoVisitante: async () => "pt-BR" }));

import { VoltarDaPaginaLegal } from "@/components/legal/VoltarDaPaginaLegal";
import { generateMetadata } from "./privacy/page";

const rotulos = { nl: "Terug", fr: "Retour", tr: "Geri" };

describe("Voltar do topo", () => {
  it.each([["fr", "Retour"], ["tr", "Geri"], ["nl", "Terug"]])("?lang=%s → %s", (lang, esperado) => {
    busca.lang = lang;
    render(<VoltarDaPaginaLegal padrao="Terug" rotulos={rotulos} aceitaLang />);
    expect(screen.getByRole("link").textContent).toBe(esperado);
  });
  it("sem ?lang= vale o padrão (navegador)", () => {
    busca.lang = null;
    render(<VoltarDaPaginaLegal padrao="Terug" rotulos={rotulos} aceitaLang />);
    expect(screen.getByRole("link").textContent).toBe("Terug");
  });
  it("fora da Bélgica ou com sessão, ?lang= é ignorado (a página também o ignora)", () => {
    busca.lang = "fr";
    render(<VoltarDaPaginaLegal padrao="Voltar" rotulos={rotulos} aceitaLang={false} />);
    expect(screen.getByRole("link").textContent).toBe("Voltar");
  });
});

describe("título da aba da política", () => {
  it("?lang=tr com navegador em holandês: título em turco", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "tr" }) });
    expect(meta.title).toBe("Gizlilik Politikası");
  });
  it("?lang=fr: título em francês", async () => {
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "fr" }) });
    expect(String(meta.title)).not.toBe("Privacyverklaring");
  });
});
