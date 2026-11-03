/**
 * Convite de time, no idioma da empresa que convida, sem React Email. Devolve subject/html/text.
 * Estilo inline apenas (compatibilidade com cliente de e-mail); zero asset
 * externo.
 *
 * É o PRIMEIRO artefato que um usuário novo recebe do sistema — e chegava com
 * o nome do NOSSO produto em vez do da instalação que convidou. A marca entra
 * resolvida (`marcaDaSaida(organizationId)`, classe A: há organização), e as
 * cores deixam de ser hexes inventados aqui: o botão usa o accent derivado e o
 * resto vem dos neutros da régua do produto.
 *
 * O LOGO entrou depois, e por um motivo medido: `MarcaDeSaida.logoUrl` era
 * campo morto — resolvido, entregue a este template e a nenhum outro, e
 * renderizado por ninguém. Um e-mail que diz o nome do revendedor mas mostra a
 * arte de ninguém é meia marca; e este é o e-mail que a pessoa abre antes de
 * ter visto qualquer tela do produto.
 */
import { rotuloDoPapel } from "@/lib/auth/types";
import { NEUTROS_DE_SAIDA, type MarcaDeSaida } from "@/lib/branding/saida";
import { traduzir } from "@/lib/i18n/dicionario";
import type { Idioma } from "@/lib/i18n/idiomas";
import { idiomaVisivelPorCodigo } from "@/lib/i18n/registro";
import { FUSO_PADRAO, fusoValido } from "@/lib/tempo/fusos";
import { estruturaDeEmail } from "./estrutura";

export interface InviteEmailOptions {
  inviterName: string;
  orgName: string;
  acceptUrl: string;
  role: string;
  expiresAt: Date;
  /** A marca de quem convidou. Obrigatória — sem ela o e-mail não tem dono. */
  marca: MarcaDeSaida;
  /**
   * O idioma da EMPRESA que convida (`organizations.locale`). Obrigatório, como
   * no aviso de troca de e-mail: um chamador que o esquecesse mandaria o
   * convite em português para uma empresa que usa o painel em outra língua.
   */
  idioma: Idioma;
  /** Fuso IANA da empresa (`organizations.timezone`). Ausente ou inválido: `FUSO_PADRAO`. */
  fuso?: string | null;
}

export function buildInviteEmail(opts: InviteEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const t = (texto: string) => traduzir(texto, opts.idioma);
  const fuso = opts.fuso && fusoValido(opts.fuso) ? opts.fuso : FUSO_PADRAO;
  const expiresStr = opts.expiresAt.toLocaleString(idiomaVisivelPorCodigo(opts.idioma).tagBcp47, {
    timeZone: fuso,
  });
  const marca = opts.marca.nome;
  // Os valores entram numa passada só: um nome de empresa que contenha « {papel} »
  // não pode ser reinterpretado como marcador por uma substituição seguinte.
  const montar = (frase: string, valores: Record<string, string>) =>
    frase.replace(/\{(\w+)\}/g, (marcador, chave: string) => valores[chave] ?? marcador);
  const subject = montar(t("{convidador} convidou você para a {empresa} no {marca}"), {
    convidador: opts.inviterName,
    empresa: opts.orgName,
    marca,
  });

  // O papel pelo NOME (« Atendente »), não pelo código (« agent »): o convite dizia
  // « convidou você como agent » em toda instalação.
  // O rótulo é o mesmo que a tela de time mostra (`t(rotuloDoPapel(r))`).
  const papel = t(rotuloDoPapel(opts.role));

  const titulo = montar(t("Você foi convidado para a {empresa}"), { empresa: escapeHtml(opts.orgName) });
  // « convidou você como <strong>papel</strong> no marca »: o papel muda de lugar
  // conforme a língua, então a frase inteira é traduzida com o marcador. A quebra
  // de linha antes do <strong> é só espaço em branco de HTML; mantê-la deixa o
  // pt-BR idêntico, byte a byte, ao que saía antes.
  const corpo = montar(t("{convidador} convidou você como {papel} no {marca}."), {
    convidador: escapeHtml(opts.inviterName),
    papel: `<strong>${escapeHtml(papel)}</strong>`,
    marca: escapeHtml(marca),
  }).replace(" <strong>", "\n      <strong>");
  const validade = montar(t("Este link expira em {data}. Se você não esperava este convite, pode ignorá-lo."), {
    data: `<strong>${expiresStr}</strong>`,
  });

  const html = estruturaDeEmail(
    opts.marca,
    `    <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:${NEUTROS_DE_SAIDA.texto}">
      ${titulo}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      ${corpo}
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(opts.acceptUrl)}" style="display:inline-block;padding:12px 24px;background:${opts.marca.accent};color:${opts.marca.accentFg};border-radius:6px;text-decoration:none;font-weight:600">
        ${escapeHtml(t("Aceitar convite"))}
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      ${escapeHtml(t("Ou copie e cole este link no navegador:"))}<br>
      <span style="word-break:break-all;color:${opts.marca.accent}">${escapeHtml(opts.acceptUrl)}</span>
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      ${validade}
    </p>`,
    opts.idioma,
  );

  const text = [
    montar(t("Você foi convidado para a {empresa} como {papel} no {marca}."), {
      empresa: opts.orgName,
      papel,
      marca,
    }),
    "",
    montar(t("Aceitar: {url}"), { url: opts.acceptUrl }),
    "",
    montar(t("Expira em {data}."), { data: expiresStr }),
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
