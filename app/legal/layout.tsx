import { VoltarDaPaginaLegal } from "@/components/legal/VoltarDaPaginaLegal";

import { marcaDaSaida } from "@/lib/branding/saida";
import { valorDaInstalacao } from "@/lib/instalacao/config";
import { VOLTAR_NA_POLITICA_BELGA, idiomaBelgaDoVisitante } from "@/lib/legal/politica-belga";
import { perfilDoPais } from "@/lib/legal/perfil-do-pais";
import { createClient } from "@/lib/supabase/server";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { idiomaDoVisitante } from "@/lib/i18n/idiomaAnonimo";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * Container de leitura longa.
 *
 * Não usa o grupo `app/(public)/`: aquele layout é um cartão centrado de 384px,
 * desenhado para o formulário de login, e espremeria um documento inteiro numa
 * coluna de cartão. Aqui a medida é de texto corrido.
 */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  // O nome da marca vem do resolvedor de SAÍDA (`marcaDaSaida`: banco acima do
  // `.env`, e nunca lança) — nunca de `branding()`, que só lê o `.env`. Quem
  // gravou a marca pela tela (Administração › Marca) tem de ver o nome dele na
  // política de privacidade e nos termos, não a semente da instalação (#2511).
  const marca = await marcaDaSaida(null);
  // Fora da árvore de `app/app/layout.tsx` — sem o `IdiomaProvider` de lá, então
  // resolve o idioma direto, como as páginas filhas (`privacy`/`terms`).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const idioma = await idiomaDoVisitante(
    (user?.user_metadata?.locale as string | undefined) ?? null,
  );
  // O layout não recebe o `?lang=` da página: este é o rótulo PADRÃO (segue o
  // navegador); o `?lang=` é lido no cliente por `VoltarDaPaginaLegal`.
  const paisDaInstalacao = (await valorDaInstalacao("PAIS_DA_INSTALACAO")).valor;
  const semSessaoNaBelgica = !user && perfilDoPais(paisDaInstalacao).codigo === "BE";
  const belga = user ? null : await idiomaBelgaDoVisitante(paisDaInstalacao, null);

  return (
    <IdiomaProvider locale={idioma}>
      <div className="min-h-screen bg-muted/40">
        <header className="border-b bg-background">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{marca.nome}</p>
            <VoltarDaPaginaLegal
              padrao={belga ? VOLTAR_NA_POLITICA_BELGA[belga] : traduzir("Voltar", idioma)}
              rotulos={{ ...VOLTAR_NA_POLITICA_BELGA, tr: traduzir("Voltar", "tr") }}
              aceitaLang={semSessaoNaBelgica}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl px-6 py-10">
          <article className="space-y-6 rounded-lg border bg-background p-8 text-sm leading-relaxed">
            {children}
          </article>
        </main>
      </div>
    </IdiomaProvider>
  );
}
