/**
 * O convite do responsável precisa existir em `team_invites`.
 *
 * A criação da empresa manda o convite direto por `issueInvite`, e a linha só era
 * gravada por `emitirConvite`, o caminho da tela de Equipe. Sem a linha, o "Gerar
 * link de pagamento" do dono (`emailDoConviteDeAdminPendente`) não acha o e-mail do
 * cliente e a empresa de plano de 0 dias fica presa em 409 `empresa_sem_email`.
 *
 * Visto na prova ao vivo da v1.99.2, com tudo verde: cada lado era testado com o
 * outro falso. Por isso aqui a rota de criação ESCREVE e o leitor REAL LÊ a mesma
 * tabela (em memória). Sem o `vi.mock` de `lib/cobranca/emails`, de propósito.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { argumentos, bancoFalso, operacao, valorDoFiltro, type BancoFalso, type Cadeia } from "@/tests/helpers/banco-falso-da-cobranca";
import { INTERFACE_COMPLETA } from "@/lib/navigation/interface";

const h = vi.hoisted(() => ({
  ator: "a2180000-0000-4000-8000-000000000001",
  escrita: vi.fn(),
  audit: vi.fn(),
  invite: vi.fn(),
  aviso: vi.fn(),
  banco: undefined as unknown as BancoFalso,
}));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/auth/server", () => ({ mfaEmDivida: async () => false, loadAuthUser: async () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/requirePlatformAdmin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/requirePlatformAdmin")>()),
  requirePlatformAdminEscrita: h.escrita,
}));
vi.mock("@/lib/instalacao/modulos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/instalacao/modulos")>()),
  moduloLigado: async () => true,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => h.banco.cliente }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/auth/issue-invite", () => ({ issueInvite: h.invite }));
vi.mock("@/lib/logger", () => ({ logger: { warn: h.aviso, error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { POST } from "@/app/api/v1/admin/tenants/route";
import { emailDoConviteDeAdminPendente } from "@/lib/cobranca/emails";

const ORG = "a2180000-0000-4000-8000-000000000002";
const CONVITE = "a2180000-0000-4000-8000-000000000004";
const EMAIL = "cliente@empresa.be";
const PRAZO = "2026-11-05T15:00:00.000Z";

const pedido = (extra: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/v1/admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "a2180000-0000-4000-8000-000000000003" },
    body: JSON.stringify({ display_name: "Minha organização", slug: "minha-org", owner_email: EMAIL, ...extra }),
  });

/** `team_invites` em memória: guarda o que a rota grava e responde o que o leitor filtra. */
function tabelaDeConvites(erroAoGravar: { code: string; message: string } | null = null) {
  const linhas: Array<Record<string, unknown>> = [];
  const responder = (c: Cadeia) => {
    if (c.tabela === "platform_admins") return { data: [] };
    if (c.tabela !== "team_invites") return {};
    if (operacao(c) === "upsert") {
      if (erroAoGravar) return { error: erroAoGravar };
      const linha = argumentos(c, "upsert")?.[0] as Record<string, unknown>;
      const ignora = (argumentos(c, "upsert")?.[1] as { ignoreDuplicates?: boolean } | undefined)?.ignoreDuplicates;
      const existente = linhas.findIndex((l) => l.id === linha.id);
      if (existente === -1) linhas.push(linha);
      else if (!ignora) linhas[existente] = linha;
      return {};
    }
    const abertas = linhas.filter(
      (l) =>
        l.organization_id === valorDoFiltro(c, "eq", "organization_id") &&
        l.role === valorDoFiltro(c, "eq", "role") &&
        !l.accepted_at &&
        !l.revoked_at,
    );
    return { data: abertas.map((l) => ({ email: l.email })) };
  };
  return { linhas, responder };
}

const reciboDaFuncao = (created = true) => () => ({
  data: { id: ORG, display_name: "Minha organização", slug: "minha-org", created, invite_id: CONVITE, issued_at: 1 },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.escrita.mockResolvedValue({
    user: { id: h.ator, email: "dono@agenterix.test", user_metadata: { full_name: "Dono" } },
    platformAdmin: { scope: "full" },
  });
  h.invite.mockResolvedValue({
    email: EMAIL,
    invite_id: CONVITE,
    expires_at: PRAZO,
    email_dispatched: true,
    accept_url: "https://app.test/team/accept-invite/token",
  });
});

describe("POST /api/v1/admin/tenants — a linha do convite do responsável", () => {
  it("⭐ empresa criada para outra pessoa: o link do dono acha o e-mail do convite", async () => {
    const tabela = tabelaDeConvites();
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao());

    expect((await POST(pedido())).status).toBe(201);

    await expect(emailDoConviteDeAdminPendente(h.banco.cliente as never, ORG)).resolves.toBe(EMAIL);
  });

  it("a linha é a do convite que saiu: o id do token, a organização, o papel, quem convidou e o prazo", async () => {
    const tabela = tabelaDeConvites();
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao());

    await POST(pedido());

    expect(tabela.linhas).toEqual([
      {
        id: CONVITE,
        organization_id: ORG,
        email: EMAIL,
        role: "admin",
        interface_settings: INTERFACE_COMPLETA,
        invited_by: h.ator,
        inviter_name: "Dono",
        email_dispatched: true,
        last_sent_at: expect.any(String),
        expires_at: PRAZO,
      },
    ]);
  });

  it("retentativa com a mesma chave não sobrescreve a linha: o e-mail já saiu na primeira", async () => {
    const tabela = tabelaDeConvites();
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao());
    await POST(pedido());

    // Na retentativa `issueInvite` não dispara (`dispatch: org.created`) e devolve `false`.
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao(false));
    h.invite.mockResolvedValue({ email: EMAIL, invite_id: CONVITE, expires_at: PRAZO, email_dispatched: false, accept_url: "x" });
    expect((await POST(pedido())).status).toBe(201);

    expect(tabela.linhas).toHaveLength(1);
    expect(tabela.linhas[0]?.email_dispatched).toBe(true);
  });

  it("o dono criando a empresa para si mesmo: sem convite, sem linha", async () => {
    const tabela = tabelaDeConvites();
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao());

    expect((await POST(pedido({ owner_email: "dono@agenterix.test" }))).status).toBe(201);

    expect(h.invite).not.toHaveBeenCalled();
    expect(tabela.linhas).toEqual([]);
  });

  it("falha ao gravar a linha não derruba a criação: a empresa já existe e o convite já saiu", async () => {
    const tabela = tabelaDeConvites({ code: "23505", message: "duplicate key" });
    h.banco = bancoFalso(tabela.responder, reciboDaFuncao());

    expect((await POST(pedido())).status).toBe(201);

    expect(h.aviso).toHaveBeenCalledTimes(1);
    // O motivo leva só o código, nunca o endereço (mesma regra de `lib/cobranca/emails.ts`).
    expect(JSON.stringify(h.aviso.mock.calls)).toContain("23505");
    expect(JSON.stringify(h.aviso.mock.calls)).not.toContain(EMAIL);
  });
});
