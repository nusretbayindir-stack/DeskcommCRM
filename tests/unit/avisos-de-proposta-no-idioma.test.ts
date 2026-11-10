import { describe, expect, it } from "vitest";

import { tituloDoAviso, corpoDoAvisoDeRevisao } from "@/lib/propostas/aviso-de-revisao";
import {
  avisoDeAceiteEmQueda,
  avisoDePropostaPrometida,
  avisoDePropostaTravada,
  avisoDePropostaVencida,
} from "@/lib/propostas/avisos-da-central";

/**
 * OS AVISOS DE PROPOSTA DA CENTRAL NO IDIOMA DA EMPRESA (S2a Task 5, U14).
 *
 * Os crons de proposta leem o idioma da empresa na hora de gravar
 * (`idiomaDaOrgPeloSupabase`) e montam o texto aqui. Em português, o texto é o
 * de antes, byte a byte.
 */
describe("avisos de proposta: o português de antes", () => {
  it("taxa de aceite em queda", () => {
    expect(avisoDeAceiteEmQueda(40, 50)).toEqual({
      title: "A taxa de aceite de propostas caiu",
      body: "40% das propostas decididas nos últimos 30 dias foram aceitas — abaixo do piso de 50%.",
    });
  });

  it("proposta vencida e proposta prometida", () => {
    expect(avisoDePropostaVencida()).toEqual({
      title: "Uma proposta venceu sem decisão do cliente",
      body: "O prazo de validade passou e ninguém marcou aceite ou recusa. Reveja a proposta e decida os próximos passos com o cliente.",
    });
    expect(avisoDePropostaPrometida()).toEqual({
      title: "Uma proposta prometida não foi criada",
      body: "Um compromisso de enviar proposta venceu e nenhuma proposta foi criada para este negócio.",
    });
  });

  it("proposta travada, uma e várias", () => {
    const corpo =
      "Ficaram mais de 5 minutos em envio e voltaram a rascunho, com o número mantido. " +
      "Verifique a conexão do WhatsApp e reenvie manualmente — nada foi reenviado sozinho.";
    expect(avisoDePropostaTravada(1, 5)).toEqual({ title: "Uma proposta não confirmou o envio", body: corpo });
    expect(avisoDePropostaTravada(3, 5)).toEqual({ title: "3 propostas não confirmaram o envio", body: corpo });
  });

  it("proposta pronta para revisão", () => {
    expect(tituloDoAviso("Reforma", "Ana")).toBe("Proposta «Reforma» de Ana está pronta para revisão");
    expect(tituloDoAviso(null, null)).toBe("Proposta «sem título» está pronta para revisão");
    expect(corpoDoAvisoDeRevisao()).toBe(
      "A IA rascunhou esta proposta. Confirme o modelo, preencha o que falta no documento e confira os preços antes de enviar.",
    );
  });
});

describe("avisos de proposta: em turco, com os valores no lugar", () => {
  const semPlaceholder = (texto: string) => expect(texto).not.toMatch(/\{[a-z]+\}/);

  it("cada aviso muda de idioma e mantém os números e nomes", () => {
    const queda = avisoDeAceiteEmQueda(40, 50, "tr");
    expect(queda.title).not.toBe(avisoDeAceiteEmQueda(40, 50).title);
    expect(queda.body).toContain("40");
    expect(queda.body).toContain("50");
    semPlaceholder(queda.body);

    expect(avisoDePropostaVencida("tr").title).not.toBe(avisoDePropostaVencida().title);
    expect(avisoDePropostaPrometida("tr").body).not.toBe(avisoDePropostaPrometida().body);

    const travadas = avisoDePropostaTravada(3, 5, "tr");
    expect(travadas.title).toContain("3");
    expect(travadas.title).not.toBe(avisoDePropostaTravada(3, 5).title);
    expect(travadas.body).toContain("5");
    semPlaceholder(travadas.title + travadas.body);

    const revisao = tituloDoAviso("Reforma", "Ana", "tr");
    expect(revisao).toContain("Reforma");
    expect(revisao).toContain("Ana");
    expect(revisao).not.toBe(tituloDoAviso("Reforma", "Ana"));
    semPlaceholder(revisao);
    expect(tituloDoAviso(null, null, "tr")).not.toContain("sem título");
    expect(corpoDoAvisoDeRevisao("tr")).not.toBe(corpoDoAvisoDeRevisao());
  });
});
