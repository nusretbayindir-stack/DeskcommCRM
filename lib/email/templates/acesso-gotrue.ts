import { NEUTROS_DE_SAIDA, type MarcaDeSaida } from "@/lib/branding/saida";
import { estruturaDeEmail } from "./estrutura";

/**
 * Os dois e-mails de ACESSO — confirmar conta e redefinir senha — no formato
 * que o GoTrue renderiza.
 *
 * ─── POR QUE ISTO É DIFERENTE DE `invite.ts` ────────────────────────────────
 *
 * O convite de time é montado e ENVIADO por nós. Estes dois não: quem os
 * renderiza e envia é o GoTrue, um processo de terceiro. Nós só entregamos o
 * MOLDE, e ele preenche `{{ .RedirectTo }}` e `{{ .TokenHash }}` na hora do
 * envio. Por isso a saída aqui é uma string de template Go, não um e-mail
 * pronto — e por isso as chaves duplas NÃO passam por escape: elas são sintaxe
 * do renderizador, não dado.
 *
 * ─── POR QUE `token_hash` E NÃO `{{ .ConfirmationURL }}` ────────────────────
 *
 * O modelo PADRÃO do GoTrue linka para `/auth/v1/verify`, que devolve um `code`
 * PKCE. O verificador desse code vive num cookie `SameSite=Strict`
 * (`lib/supabase/server.ts`), e clique vindo de webmail é navegação
 * cross-site: o cookie não viaja, `exchangeCodeForSession` falha, e a conta é
 * confirmada sem que a sessão feche. `token_hash` não depende de cookie nenhum.
 *
 * Medido numa instalação self-hosted em 2026-09-10: com o modelo padrão, o
 * `api_audit_log` registrava `auth.email_link_rejected` com
 * `"PKCE code verifier not found in storage"`; com estes moldes, o mesmo fluxo
 * fecha a sessão.
 *
 * ─── `&`, NUNCA `?` ────────────────────────────────────────────────────────
 *
 * `.RedirectTo` já chega com `?type=` embutido — `signUp.ts` e
 * `requestPasswordReset.ts` o anexam de propósito, porque é o único jeito de o
 * `type` sobreviver ao hop pelo GoTrue no outro formato. Um `?` aqui duplicaria
 * o separador e o parser de URL do browser pararia de reconhecer `token_hash`.
 */

export type ModeloDeAcesso = "confirmation" | "recovery";

export const MODELOS_DE_ACESSO: readonly ModeloDeAcesso[] = ["confirmation", "recovery"];

/*
 * ─── O IDIOMA (fork, S2a Task 12) ──────────────────────────────────────────
 *
 * O GoTrue não sabe a língua de ninguém, mas entrega ao molde o
 * `user_metadata` da pessoa em `.Data` — e é ali que o seletor de idioma do
 * topo grava a preferência (`locale`, `app/actions/settings/trocarIdioma.ts`).
 * Então o molde leva os ramos e o GoTrue escolhe na hora do envio:
 *
 *   - `nl`, `fr` ou `tr` → só aquela língua;
 *   - qualquer outra coisa (sem idioma, `pt-BR`, `es`, `en`) → holandês e
 *     francês no mesmo e-mail (spec S2a, D9: esta instalação vende na Bélgica).
 *
 * Provado ao vivo em 2026-11-09 (S2a Task 3), assunto incluído. Só entram as
 * construções provadas: `printf "%v"`/`print` (não quebra com o campo
 * ausente, ao contrário de `eq` direto), `if eq`, `else if eq`, `else`, `end`.
 * `tests/unit/acesso-gotrue-no-idioma.test.ts` renderiza cada ramo com um
 * renderizador que recusa qualquer outra construção.
 *
 * Cada ramo do corpo é um DOCUMENTO inteiro, com o `lang` da sua língua: a
 * moldura (`estruturaDeEmail`) é a mesma de antes, só o texto muda.
 */
type Lingua = "nl" | "fr" | "tr";

interface Copia {
  /** Curto de propósito: os quatro ramos dividem os 255 caracteres do painel. */
  assunto: string;
  titulo: string;
  corpo: (marca: string) => string;
  botao: string;
  copiar: string;
  rodape: string;
}

const COPIAR = {
  nl: "Of kopieer en plak deze link in de browser:",
  fr: "Ou copiez et collez ce lien dans votre navigateur :",
  tr: "Ya da şu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:",
} as const satisfies Record<Lingua, string>;

/** O texto de cada modelo, por língua. "u" e "vous"; sem "aanmelden". */
const COPIA: Record<ModeloDeAcesso, Record<Lingua, Copia>> = {
  confirmation: {
    nl: {
      assunto: "E-mailadres bevestigen",
      titulo: "Bevestig uw e-mailadres",
      corpo: (marca) =>
        `Uw account bij ${marca} is bijna klaar. Klik op de knop hieronder om uw e-mailadres te bevestigen en uw account te activeren.`,
      botao: "E-mailadres bevestigen",
      copiar: COPIAR.nl,
      rodape: "Hebt u deze account niet aangemaakt? Dan kunt u deze e-mail negeren.",
    },
    fr: {
      assunto: "Confirmer l'adresse e-mail",
      titulo: "Confirmez votre adresse e-mail",
      corpo: (marca) =>
        `Votre compte ${marca} est presque prêt. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.`,
      botao: "Confirmer l'adresse e-mail",
      copiar: COPIAR.fr,
      rodape: "Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail.",
    },
    tr: {
      assunto: "E-posta onayı",
      titulo: "E-posta adresinizi onaylayın",
      corpo: (marca) =>
        `${marca} hesabınız neredeyse hazır. E-posta adresinizi onaylayıp hesabınızı etkinleştirmek için aşağıdaki düğmeye tıklayın.`,
      botao: "Hesabımı onayla",
      copiar: COPIAR.tr,
      rodape: "Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.",
    },
  },
  recovery: {
    nl: {
      assunto: "Wachtwoord opnieuw instellen",
      titulo: "Stel uw wachtwoord opnieuw in",
      corpo: (marca) =>
        `We hebben een verzoek ontvangen om het wachtwoord van uw account bij ${marca} opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.`,
      botao: "Nieuw wachtwoord instellen",
      copiar: COPIAR.nl,
      rodape: "Hebt u dit niet aangevraagd? Dan kunt u deze e-mail negeren. Uw huidige wachtwoord blijft geldig.",
    },
    fr: {
      assunto: "Réinitialiser le mot de passe",
      titulo: "Réinitialisez votre mot de passe",
      corpo: (marca) =>
        `Nous avons reçu une demande de réinitialisation du mot de passe de votre compte ${marca}. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.`,
      botao: "Définir un nouveau mot de passe",
      copiar: COPIAR.fr,
      rodape:
        "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail. Votre mot de passe actuel reste valable.",
    },
    tr: {
      assunto: "Şifre sıfırlama",
      titulo: "Şifrenizi sıfırlayın",
      corpo: (marca) =>
        `${marca} hesabınızın şifresini sıfırlamak için bir istek aldık. Yeni şifrenizi belirlemek için aşağıdaki düğmeye tıklayın.`,
      botao: "Yeni şifre belirle",
      copiar: COPIAR.tr,
      rodape: "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz. Mevcut şifreniz geçerli kalır.",
    },
  },
};

/**
 * O painel do Supabase não grava assunto acima de 255 CARACTERES (medido na
 * Task 3: recusou 313, aceitou 253 — que eram 259 bytes).
 */
const LIMITE_DO_ASSUNTO = 255;

/**
 * O assunto, com os mesmos ramos do corpo. O GoTrue o lê de uma configuração
 * própria (`mailer_subjects_*` / `GOTRUE_MAILER_SUBJECTS_*`), não do molde.
 * A marca vai no fim; se ela não couber no limite do painel, o assunto sai
 * sem ela — melhor que um assunto que o painel recusa.
 */
export function assuntoDoModelo(modelo: ModeloDeAcesso, marca: MarcaDeSaida): string {
  const c = COPIA[modelo];
  const ramos =
    `{{$d:=print .Data.locale}}{{if eq $d "nl"}}${c.nl.assunto}{{else if eq $d "fr"}}${c.fr.assunto}` +
    `{{else if eq $d "tr"}}${c.tr.assunto}{{else}}${c.nl.assunto} / ${c.fr.assunto}{{end}}`;
  const comMarca = `${ramos} · ${marca.nome}`;
  return comMarca.length <= LIMITE_DO_ASSUNTO ? comMarca : ramos;
}

/**
 * O molde, com a marca da INSTALAÇÃO já aplicada.
 *
 * Estilo inline apenas e zero asset externo além do logo, pelas mesmas razões
 * de `invite.ts` — inclusive a dimensão no atributo, que o Outlook desktop
 * exige porque descarta `height` de style em imagem.
 */
export function montarTemplateDeAcesso(modelo: ModeloDeAcesso, marca: MarcaDeSaida): string {
  const c = COPIA[modelo];

  // `{{-` e `-}}` comem as quebras de linha em volta: o ramo escolhido começa
  // em `<!doctype html>`, sem espaço antes.
  return [
    `{{- $dil := printf "%v" .Data.locale -}}`,
    `{{- if eq $dil "nl" -}}`,
    estruturaDeEmail(marca, conteudoDoAcesso(c.nl, marca), "nl"),
    `{{- else if eq $dil "fr" -}}`,
    estruturaDeEmail(marca, conteudoDoAcesso(c.fr, marca), "fr"),
    `{{- else if eq $dil "tr" -}}`,
    estruturaDeEmail(marca, conteudoDoAcesso(c.tr, marca), "tr"),
    `{{- else -}}`,
    estruturaDeEmail(
      marca,
      `    <div lang="nl">
${conteudoDoAcesso(c.nl, marca)}
    </div>
    <hr style="border:none;border-top:1px solid ${NEUTROS_DE_SAIDA.linha};margin:32px 0">
    <div lang="fr">
${conteudoDoAcesso(c.fr, marca)}
    </div>`,
      "nl",
    ),
    `{{- end -}}`,
  ].join("\n");
}

function conteudoDoAcesso(t: Copia, marca: MarcaDeSaida): string {
  // As chaves duplas ficam CRUAS de propósito: o GoTrue as substitui.
  const destino = "{{ .RedirectTo }}&token_hash={{ .TokenHash }}";

  return `    <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px;color:${NEUTROS_DE_SAIDA.texto}">
      ${escapeHtml(t.titulo)}
    </h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      ${escapeHtml(t.corpo(marca.nome))}
    </p>
    <p style="margin:24px 0">
      <a href="${destino}" style="display:inline-block;padding:12px 24px;background:${marca.accent};color:${marca.accentFg};border-radius:6px;text-decoration:none;font-weight:600">
        ${escapeHtml(t.botao)}
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      ${escapeHtml(t.copiar)}<br>
      <span style="word-break:break-all;color:${marca.accent}">${destino}</span>
    </p>
    <p style="margin:24px 0 0;font-size:13px;color:${NEUTROS_DE_SAIDA.suave}">
      ${escapeHtml(t.rodape)}
    </p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
