import { describe, expect, it } from "vitest";

import tr from "@/lib/i18n/traducoes/tr.json";
import { motivoDoVeto } from "@/lib/agent-engine/agent/sugestao-de-resposta";
import { textoDoAviso, textoDoImpedimento } from "@/lib/agent-engine/agent/texto-do-teste";

/**
 * O PAINEL DE TESTE MOSTRA OS VETOS NO IDIOMA DO OPERADOR.
 *
 * `verdict.reason` é o texto de ENSINO que volta para o modelo (fixado por
 * `semantic.test.ts`) e está em português. A aba Teste o mostrava cru a um
 * operador turco ("frase suspeita: … — isso é uma promessa…"). Quando o código
 * do veto é conhecido por `motivoDoVeto`, a tela usa o texto do operador, que
 * já tem tradução; o `message` do modelo não muda.
 *
 * **NÃO MEDIDO aqui:** a renderização do `TestPanel` (só os dois helpers que ele
 * chama) nem a tradução dos motivos de pacing, que são texto dinâmico.
 */
const tTurco = (texto: string): string => (tr as Record<string, string>)[texto] ?? texto;

const REASON_PT =
  'frase suspeita: "te aviso amanhã" — isso é uma promessa sem registro; reescreva sem prometer';

describe("textoDoImpedimento", () => {
  it("promise_semantic em tr: texto turco e o reason em português não aparece", () => {
    const texto = textoDoImpedimento({ code: "promise_semantic", message: REASON_PT }, tTurco);
    const esperado = tr[motivoDoVeto("promise_semantic")!.texto as keyof typeof tr];
    expect(esperado).toBeTruthy();
    expect(texto).toBe(esperado);
    expect(texto).not.toContain("frase suspeita");
    expect(texto).not.toContain("isso é uma promessa");
  });

  it("código desconhecido: segue mostrando o message original", () => {
    expect(textoDoImpedimento({ code: "codigo_novo", message: "mensagem crua" }, tTurco)).toBe(
      "mensagem crua",
    );
  });
});

describe("textoDoAviso", () => {
  it("código conhecido: o padrão 'Em produção…' sai em turco, sem o reason em português", () => {
    const texto = textoDoAviso(
      {
        code: "promise_semantic",
        message: `Em produção esta resposta não sairia agora (${REASON_PT}). O teste mostra a resposta mesmo assim; nenhuma mensagem foi enviada.`,
        reason: REASON_PT,
      },
      tTurco,
    );
    expect(texto).not.toMatch(/Em produção|O teste mostra|frase suspeita/);
    expect(texto).toContain(tr[motivoDoVeto("promise_semantic")!.texto as keyof typeof tr]);
  });

  it.each(["outside_window", "warmup_cap", "daily_cap", "factual_claim_contradicted"])(
    "%s em tr: nenhum português escapa (nem o motivo dinâmico do motor)",
    (code) => {
      const texto = textoDoAviso(
        { code, message: "x", reason: "fora da janela de resposta (9h-18h, America/Sao_Paulo)" },
        tTurco,
      );
      expect(texto).not.toMatch(/Em produção|O teste mostra|fora da janela|janela|limite|resposta/);
      expect(texto).not.toBe("");
    },
  );

  it("código realmente desconhecido: traduz o padrão e mantém o motivo do motor", () => {
    const texto = textoDoAviso(
      { code: "codigo_inventado", message: "x", reason: "motivo cru do motor" },
      tTurco,
    );
    expect(texto).not.toContain("Em produção");
    expect(texto).toContain("motivo cru do motor");
  });

  it("midia_sem_fotos em tr: texto turco com o código do produto", () => {
    const texto = textoDoAviso(
      { code: "midia_sem_fotos", message: "O produto ... não tem fotos", produto: "PROD-7" },
      tTurco,
    );
    expect(texto).toContain("PROD-7");
    expect(texto).not.toMatch(/não tem fotos|nenhuma imagem|produto/);
  });

  it("aviso sem reason nem produto: devolve o message", () => {
    expect(textoDoAviso({ code: "outro", message: "sem fotos" }, tTurco)).toBe(
      "sem fotos",
    );
  });
});

describe("pt-BR mantem o texto detalhado do motor (v1.88.3 F5)", () => {
  const MENSAGEM_DO_AVISO = `Em produção esta resposta não sairia agora (${REASON_PT}). O teste mostra a resposta mesmo assim; nenhuma mensagem foi enviada.`;
  const tIdentidade = (texto: string): string => texto;

  it("impedimento: pt-BR devolve a mensagem original (com a frase citada)", () => {
    expect(
      textoDoImpedimento({ code: "promise_semantic", message: REASON_PT }, tIdentidade, "pt-BR"),
    ).toBe(REASON_PT);
  });

  it("aviso: pt-BR devolve a mensagem original (janela e fuso inclusos)", () => {
    const message = "Em produção esta resposta não sairia agora (fora da janela de resposta (9h-18h, America/Sao_Paulo)).";
    expect(
      textoDoAviso(
        { code: "outside_window", message, reason: "fora da janela de resposta (9h-18h, America/Sao_Paulo)" },
        tIdentidade,
        "pt-BR",
      ),
    ).toBe(message);
    expect(
      textoDoAviso({ code: "promise_semantic", message: MENSAGEM_DO_AVISO, reason: REASON_PT }, tIdentidade, "pt-BR"),
    ).toBe(MENSAGEM_DO_AVISO);
  });

  it("tr continua como na Task 1", () => {
    const texto = textoDoImpedimento({ code: "promise_semantic", message: REASON_PT }, tTurco, "tr");
    expect(texto).not.toContain("frase suspeita");
    expect(texto).toBe(textoDoImpedimento({ code: "promise_semantic", message: REASON_PT }, tTurco));
  });
});
