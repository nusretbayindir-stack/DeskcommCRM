import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * U40.e — `/admin/forbidden` lia só `user_metadata.locale`. Quem nunca escolheu
 * idioma, mas usa uma empresa em turco, via "Acesso negado" em português. O
 * idioma agora vem da cadeia de `loadAuthUser` (pessoa → organização → padrão).
 */
vi.mock("@/lib/auth/server", () => ({
  // O metadado da pessoa está vazio; o idioma chegou pela organização.
  loadAuthUser: async () => ({ locale: null, idioma: "tr" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));
vi.mock("@/lib/branding", () => ({ branding: () => ({ name: "Produto" }) }));

describe("/admin/forbidden", () => {
  it("fala o idioma da empresa quando a pessoa não tem preferência própria", async () => {
    const { default: Pagina } = await import("@/app/admin/forbidden/page");
    const { container } = render(await Pagina());
    expect(container.textContent).toContain("Erişim reddedildi");
    expect(container.textContent).not.toContain("Acesso negado");
  });
});
