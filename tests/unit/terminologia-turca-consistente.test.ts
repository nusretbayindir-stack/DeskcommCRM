import { describe, expect, it } from "vitest";

import tr from "@/lib/i18n/traducoes/tr.json";

const catalogo = tr as Record<string, string>;

/**
 * Consistencia do turco (onda final F4): uma palavra por conceito.
 * "uretim ortami" e jargao de desenvolvedor; "gonderim araligi" e o termo usado
 * em todo o produto; o convite usa uma forma so em assunto, corpo e texto.
 */
describe("terminologia turca consistente", () => {
  it("o aviso do teste fala em 'Canli kullanimda', nao em 'Uretim ortaminda'", () => {
    for (const chave of [
      "Em produção esta resposta não sairia agora",
      "Em produção ela seria barrada e o assistente teria que reescrever. Encontrado:",
    ]) {
      expect(catalogo[chave]).toMatch(/^Canlı kullanımda /);
    }
  });

  it("a janela de envio e sempre 'gonderim araligi'", () => {
    const chave =
      "Fora da janela de envio permitida: a resposta ficaria agendada para a próxima abertura da janela.";
    expect(catalogo[chave]).toContain("gönderim aralığının dışında");
    expect(catalogo[chave]).not.toContain("pencere");
  });

  it("o e-mail de convite usa a mesma forma nos tres textos", () => {
    const textos = [
      "{convidador} convidou você para a {empresa} no {marca}",
      "{convidador} convidou você como {papel} no {marca}.",
      "Você foi convidado para a {empresa} como {papel} no {marca}.",
    ].map((k) => catalogo[k]);
    for (const t of textos) expect(t).toContain("{marca} üzerinde ");
    for (const t of textos) expect(t).not.toContain("üzerinden");
  });
});
