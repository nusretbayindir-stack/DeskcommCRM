/**
 * O convite de time sai no idioma da EMPRESA que convida.
 *
 * É o primeiro e-mail que uma pessoa recebe do produto, e chegava sempre em
 * português: uma empresa que usa o painel em turco abria o convite e lia
 * « convidou você para a ... ». O idioma agora é obrigatório na assinatura de
 * `buildInviteEmail`, para que nenhum chamador continue em português por
 * esquecimento.
 *
 * O bloco pt-BR fixa a saída de ANTES da mudança, byte a byte: ele estava verde
 * antes de a função aceitar idioma e tem de continuar verde.
 */
import { describe, expect, it } from "vitest";

import { NEUTROS_DE_SAIDA, type MarcaDeSaida } from "@/lib/branding/saida";
import { buildInviteEmail } from "@/lib/email/templates/invite";

const MARCA: MarcaDeSaida = {
  nome: "Vendas Turbo",
  logoUrl: null,
  accent: "#2f6f4e",
  accentFg: "#ffffff",
  origens: { nome: "banco", cor: "banco" },
};

const BASE = {
  inviterName: "Ana",
  orgName: "Clínica Bem Viver",
  acceptUrl: "https://crm.exemplo.com.br/team/accept-invite/tok",
  role: "agent",
  expiresAt: new Date("2026-08-20T12:00:00.000Z"),
  marca: MARCA,
};

describe("convite em pt-BR: a saída de antes, sem mudar uma letra", () => {
  const { subject, html, text } = buildInviteEmail({ ...BASE, idioma: "pt-BR" });

  it("assunto e texto", () => {
    expect(subject).toBe("Ana convidou você para a Clínica Bem Viver no Vendas Turbo");
    expect(text).toBe(
      [
        "Você foi convidado para a Clínica Bem Viver como Atendente no Vendas Turbo.",
        "",
        "Aceitar: https://crm.exemplo.com.br/team/accept-invite/tok",
        "",
        "Expira em 20/08/2026, 09:00:00.",
      ].join("\n"),
    );
  });

  it("html", () => {
    expect(html).toBe(`<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:${NEUTROS_DE_SAIDA.fundo};font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:${NEUTROS_DE_SAIDA.texto}">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:${NEUTROS_DE_SAIDA.texto}">
      Você foi convidado para a Clínica Bem Viver
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      Ana convidou você como
      <strong>Atendente</strong> no Vendas Turbo.
    </p>
    <p style="margin:24px 0">
      <a href="https://crm.exemplo.com.br/team/accept-invite/tok" style="display:inline-block;padding:12px 24px;background:#2f6f4e;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">
        Aceitar convite
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      Ou copie e cole este link no navegador:<br>
      <span style="word-break:break-all;color:#2f6f4e">https://crm.exemplo.com.br/team/accept-invite/tok</span>
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      Este link expira em <strong>20/08/2026, 09:00:00</strong>. Se você não esperava este convite, pode ignorá-lo.
    </p>
  </div>
</body>
</html>`);
  });
});

describe("convite em turco", () => {
  const { subject, html, text } = buildInviteEmail({ ...BASE, idioma: "tr" });
  const tudo = `${subject}\n${html}\n${text}`;

  it("assunto, botão e papel em turco", () => {
    expect(subject).toBe("Ana sizi Vendas Turbo üzerinde Clínica Bem Viver şirketine davet etti");
    expect(html).toContain("Daveti kabul et");
    expect(html).toContain("<strong>Temsilci</strong>");
    expect(html).toContain('<html lang="tr">');
  });

  it("a data sai no formato turco, no fuso padrão quando a empresa não tem um", () => {
    expect(text).toContain("20.08.2026 09:00:00");
    expect(html).toContain("<strong>20.08.2026 09:00:00</strong>");
  });

  it("o fuso da empresa vale para a data", () => {
    const { text: t2 } = buildInviteEmail({ ...BASE, idioma: "tr", fuso: "Europe/Brussels" });
    expect(t2).toContain("20.08.2026 14:00:00");
  });

  it("fuso inutilizável cai no padrão em vez de lançar", () => {
    const { text: t2 } = buildInviteEmail({ ...BASE, idioma: "tr", fuso: "Marte/Olimpo" });
    expect(t2).toContain("20.08.2026 09:00:00");
  });

  it("não sobra português em lugar nenhum", () => {
    for (const trecho of [
      "convidou",
      "convidado",
      "Aceitar",
      "Este link",
      "expira",
      "Expira",
      "copie e cole",
      "navegador",
      "ignorá-lo",
      "Atendente",
    ]) {
      expect(tudo).not.toContain(trecho);
    }
    expect(tudo).not.toContain("—");
  });

  it("valores de quem convida entram escapados e sem reinterpretar marcadores", () => {
    const { html: h2 } = buildInviteEmail({
      ...BASE,
      idioma: "tr",
      inviterName: "<b>{papel}</b>",
    });
    expect(h2).toContain("&lt;b&gt;{papel}&lt;/b&gt;");
    expect(h2).not.toContain("<b>");
  });
});
