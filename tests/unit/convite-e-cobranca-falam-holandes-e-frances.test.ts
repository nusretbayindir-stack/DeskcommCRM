import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as Saida from "@/lib/branding/saida";
import { bancoFalso } from "@/tests/helpers/banco-falso-da-cobranca";

/**
 * S2a Task 12 (spec §5.8): o convite de time e os e-mails da cobrança seguem o
 * idioma da EMPRESA. O código deles não muda na S2a — o holandês e o francês
 * chegam pelos catálogos. Este teste prende isso numa empresa belga.
 */

const h = vi.hoisted(() => ({ enviar: vi.fn() }));
vi.mock("@/lib/email/roteador", () => ({ sendEmail: h.enviar }));
vi.mock("@/lib/branding/saida", async (importOriginal) => ({
  ...(await importOriginal<typeof Saida>()),
  marcaDaSaida: async () => ({
    nome: "Revenda",
    logoUrl: null,
    accent: "#336699",
    accentFg: "#ffffff",
    origens: { nome: "padrao", cor: "padrao" },
  }),
}));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://crm.exemplo.test/" } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import type { MarcaDeSaida } from "@/lib/branding/saida";
import { textoDoAviso } from "@/lib/cobranca/avisos";
import { enviarAvisoAosAdmins } from "@/lib/cobranca/emails";
import { buildInviteEmail } from "@/lib/email/templates/invite";

const MARCA: MarcaDeSaida = {
  nome: "Revenda",
  logoUrl: null,
  accent: "#336699",
  accentFg: "#ffffff",
  origens: { nome: "padrao", cor: "padrao" },
};
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const URL_DO_CONVITE = "https://crm.exemplo.test/team/accept-invite/token";
const URL_DE_PAGAMENTO = "https://pagamento.exemplo.test/i/x";

/** Palavras portuguesas dos dois e-mails; nenhuma pode sobrar. */
const PORTUGUES =
  /(?<!\p{L})(você|convidou|convidado|aceitar|copie|navegador|expira|pagamento|pagar|identificamos|recebe|aviso|administra|empresa|cobrança)(?!\p{L})/iu;

/** O que se lê, sem os links (que trazem caminhos técnicos). */
const legivel = (s: string) => s.split(URL_DO_CONVITE).join("").split(URL_DE_PAGAMENTO).join("");

const ESPERADO = {
  nl: {
    convite: "heeft u uitgenodigd voor",
    botaoDoConvite: "Uitnodiging aanvaarden",
    titulo: "We hebben de betaling van",
    botaoDaCobranca: "Nu betalen",
    rodape: "U ontvangt deze melding omdat u het bedrijf",
  },
  fr: {
    convite: "vous a invité à rejoindre",
    botaoDoConvite: "Accepter l&#39;invitation",
    titulo: "Nous ne trouvons pas le paiement du",
    botaoDaCobranca: "Payer maintenant",
    rodape: "Vous recevez cette notification car vous administrez",
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  h.enviar.mockResolvedValue({ ok: true, via: "smtp" });
});

describe.each(["nl", "fr"] as const)("empresa belga em %s", (idioma) => {
  it("o convite de time sai no idioma da empresa, sem português", () => {
    const email = buildInviteEmail({
      inviterName: "Ana",
      orgName: "Bakkerij Sintética",
      role: "agent",
      acceptUrl: URL_DO_CONVITE,
      expiresAt: new Date("2026-12-01T12:00:00Z"),
      marca: MARCA,
      idioma,
      fuso: "Europe/Brussels",
    });
    expect(email.subject).toContain(ESPERADO[idioma].convite);
    expect(email.html).toContain(`<html lang="${idioma}">`);
    expect(email.html).toContain(ESPERADO[idioma].botaoDoConvite);
    for (const parte of [email.subject, email.html, email.text]) {
      expect(legivel(parte)).not.toMatch(PORTUGUES);
    }
  });

  it("o aviso de pagamento não identificado sai no idioma da empresa, sem português", async () => {
    const banco = bancoFalso(() => ({ data: [{ user_id: "ana" }] }));
    const admin = {
      ...banco.cliente,
      auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@exemplo.test` } }, error: null }) } },
    };
    const texto = textoDoAviso("venceu", {
      data: new Date("2026-10-05T12:00:00Z"),
      origem: "atraso",
      idioma,
      fuso: "Europe/Brussels",
    });
    await enviarAvisoAosAdmins(admin as never, { id: ORG, idioma, nome: "Bakkerij Sintética" }, texto, URL_DE_PAGAMENTO);
    expect(h.enviar).toHaveBeenCalledTimes(1);
    const email = h.enviar.mock.calls[0]?.[0];
    expect(email.subject).toContain(ESPERADO[idioma].titulo);
    expect(email.html).toContain(`<html lang="${idioma}">`);
    expect(email.html).toContain(ESPERADO[idioma].botaoDaCobranca);
    expect(email.text).toContain(ESPERADO[idioma].rodape);
    for (const parte of [email.subject, email.html, email.text]) {
      expect(legivel(parte)).not.toMatch(PORTUGUES);
    }
  });
});
