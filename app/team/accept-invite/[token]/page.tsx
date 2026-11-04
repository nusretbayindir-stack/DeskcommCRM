/**
 * /team/accept-invite/[token] — public route (added to PUBLIC_PATHS).
 *
 * Behavior matrix:
 *  - Invalid/expired token         → render error
 *  - Unauthenticated user          → render CTA → /login?next=...
 *  - Authenticated, email mismatch → render mismatch + sign-out CTA
 *  - Authenticated, email match    → form posts to Server Action which inserts
 *                                    membership and redirects to /app/inbox
 */
import Link from "next/link";

import { verifyInviteToken } from "@/lib/auth/invite-token";
import { authRateLimited, AUTH_LIMITS } from "@/lib/auth/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import type { Idioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;

  // Rota pública, fora da árvore de `app/app/layout.tsx` — sem o `IdiomaProvider` de lá,
  // então resolve o idioma direto, como `admin/forbidden/page.tsx`. Buscado
  // ANTES do teto de tentativas e da validação do token porque toda ramificação
  // abaixo (inclusive as de erro) precisa do mesmo idioma — quem ainda não tem
  // conta cai no ramo sem `user` e usa o `Accept-Language` do navegador antes
  // do padrão (`idiomaDoVisitante`).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = await idiomaDoVisitante(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  const t = (texto: string) => traduzir(texto, idioma);

  // O gargalo de enumeração é AQUI, não no aceite: a rota é pública e cada
  // GET testa um token. Sem teto, varrer o espaço de tokens sai de graça
  // (issue #64). Barrar antes de verificar mantém a resposta indistinguível
  // entre token válido e inválido para quem está varrendo.
  if (await authRateLimited("invite_accept", null, AUTH_LIMITS.invite_accept)) {
    return (
      <Shell idioma={idioma}>
        <h1 className="text-xl font-semibold">{t("Muitas tentativas")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Aguarde alguns minutos e abra o link do convite de novo.")}
        </p>
      </Shell>
    );
  }

  const payload = verifyInviteToken(token);

  if (!payload) {
    return (
      <Shell idioma={idioma}>
        <h1 className="text-xl font-semibold">{t("Convite inválido ou expirado")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Este link não é válido ou já passou da janela de 24h. Peça um novo convite ao admin do tenant.",
          )}
        </p>
      </Shell>
    );
  }

  // Empresa suspensa não aceita convite (`fn_accept_team_invite`). Dizer isso antes
  // poupa a pessoa de criar conta para ouvir que o convite "pode ter vencido".
  if (await empresaSuspensa(payload.organization_id)) {
    return (
      <Shell idioma={idioma}>
        <h1 className="text-xl font-semibold">{t("Esta empresa ainda não está ativa")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Este convite é válido, mas a empresa ainda não está ativa, por isso não dá para entrar agora. Se o pagamento estiver pendente, conclua-o e abra este link de novo. O link vale por 24 horas; depois disso, peça um novo a quem convidou você.",
          )}
        </p>
      </Shell>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`/team/accept-invite/${token}`);
    return (
      <Shell idioma={idioma}>
        <h1 className="text-xl font-semibold">{t("Você foi convidado")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Use o e-mail")} <strong>{payload.email}</strong>{" "}
          {t(
            "para entrar na equipe que convidou você. Se ainda não tem conta, crie a sua. Se já tem, entre com ela.",
          )}
        </p>
        <div className="mt-4 flex flex-col items-stretch gap-3">
          {/*
            Criar conta é o caminho de quem ainda não tem conta.
            As duas saídas levam o token: sem ele,
            a conta nova caía no provisionamento comum e ganhava uma empresa
            própria em vez de entrar nesta equipe.
          */}
          <Link
            href={`/signup?invite=${encodeURIComponent(token)}`}
            className="inline-block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            {t("Criar minha conta")}
          </Link>
          <Link
            href={`/login?next=${next}`}
            className="text-center text-sm underline underline-offset-4"
          >
            {t("Já tenho conta? Entrar")}
          </Link>
        </div>
      </Shell>
    );
  }

  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (userEmail !== payload.email.trim().toLowerCase()) {
    return (
      <Shell idioma={idioma}>
        <h1 className="text-xl font-semibold">{t("Email não corresponde")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Você está logado como")} <strong>{user.email}</strong>,{" "}
          {t("mas o convite foi enviado para")} <strong>{payload.email}</strong>.{" "}
          {t("Saia e faça login com o email correto.")}
        </p>
        <form action="/api/auth/signout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("Sair")}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell idioma={idioma}>
      <h1 className="text-xl font-semibold">{t("Aceitar convite")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("Você foi convidado para entrar como")} <strong>{payload.role}</strong>.{" "}
        {t("Confirme abaixo para ativar seu acesso.")}
      </p>
      <AcceptInviteForm token={token} label={t("Aceitar convite")} pendingLabel={t("Confirmando…")} failureLabel={t("Não foi possível aceitar este convite. Ele pode ter vencido ou seu acesso foi revogado. Peça um novo link ao administrador.")} planLimitLabel={t("A empresa que te convidou atingiu o limite de pessoas do plano. Avise quem te convidou.")} />
    </Shell>
  );
}

/**
 * O id vem do token assinado, nunca do pedido, e o status é o único campo lido. Leitura
 * que falha segue o caminho de sempre: o aceite continua recusando, no banco.
 */
async function empresaSuspensa(organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from("organizations")
      .select("status")
      .eq("id", organizationId)
      .maybeSingle();
    return !error && (data as { status?: string } | null)?.status === "suspended";
  } catch {
    return false;
  }
}

// Toda ramificação passa por aqui, então é aqui que o idioma chega ao
// `IdiomaProvider` — o único que acerta o `lang` do documento (ver
// `admin/forbidden/page.tsx`). Sem ele, o convite em espanhol saía com
// `lang="pt-BR"`, na primeira tela que o convidado vê.
function Shell({ idioma, children }: { idioma: Idioma; children: React.ReactNode }) {
  return (
    <IdiomaProvider locale={idioma}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">{children}</div>
      </div>
    </IdiomaProvider>
  );
}
