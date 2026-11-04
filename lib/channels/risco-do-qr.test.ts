import { describe, expect, it } from "vitest";

import { corpoDoRiscoQr, lerRiscoDoQr, VERSAO_DO_AVISO_QR } from "./risco-do-qr";

describe("lerRiscoDoQr", () => {
  it("o aceite completo volta com a origem de quem chamou", () => {
    expect(lerRiscoDoQr({ risco_qr: { aceito: true, versao: "v" } }, "conexoes")).toEqual({
      aceito: true,
      versao: "v",
      origem: "conexoes",
    });
  });

  it.each([
    ["sem corpo", null],
    ["corpo vazio", {}],
    ["aceito falso", { risco_qr: { aceito: false, versao: "v" } }],
    ["aceito em texto", { risco_qr: { aceito: "true", versao: "v" } }],
    ["sem versão", { risco_qr: { aceito: true } }],
    ["versão vazia", { risco_qr: { aceito: true, versao: "  " } }],
    ["versão comprida demais para ir ao audit", { risco_qr: { aceito: true, versao: "x".repeat(41) } }],
  ])("%s não é aceite", (_nome, corpo) => {
    expect(lerRiscoDoQr(corpo, "onboarding")).toBeNull();
  });
});

describe("corpoDoRiscoQr", () => {
  it("leva a versão atual do aviso", () => {
    expect(corpoDoRiscoQr().risco_qr.versao).toBe(VERSAO_DO_AVISO_QR);
  });

  it("o que o cliente envia é o que o servidor aceita", () => {
    expect(lerRiscoDoQr(corpoDoRiscoQr(), "conexoes")?.versao).toBe(VERSAO_DO_AVISO_QR);
  });
});
