/**
 * `@/lib/instalacao/config` com a instalação SEM país declarado (o Brasil, o
 * padrão) — e todas as outras chaves pela leitura de verdade.
 *
 * Por que existe: desde a S2a T14, o idioma do visitante sem preferência e sem
 * `Accept-Language` servido consulta o país da instalação
 * (`lib/i18n/idiomaAnonimo.ts`), e essa consulta lê `platform_config`. Nos
 * testes o banco é o placeholder `https://test-placeholder.invalid`
 * (`tests/setup/vitest.setup.ts`): a leitura falha e cai no `.env`, como
 * deve — mas a falha não é instantânea em todo lugar. No runner do CI a
 * resolução do `.invalid` leva ~7 s, e um caso que monta a mesma tela três
 * vezes passava dos 15 s do `testTimeout` (`branding-app-manifest`, PR #55).
 *
 * Quem testa a tela do visitante sem cabeçalho diz aqui, explicitamente, qual é
 * o país — "nenhum" — em vez de depender de quanto tempo um DNS demora a dizer
 * que não existe. O resultado de idioma é o de antes da T14: pt-BR.
 *
 * Uso (o `import` dinâmico é obrigatório: o `vi.mock` sobe acima dos imports):
 *
 *   vi.mock("@/lib/instalacao/config", async () =>
 *     (await import("@/tests/helpers/instalacao-sem-pais-declarado")).instalacaoSemPaisDeclarado(),
 *   );
 */
import { vi } from "vitest";

type ModuloDeConfig = Record<string, unknown> & {
  valorDaInstalacao: (chave: string) => Promise<unknown>;
};

export async function instalacaoSemPaisDeclarado(): Promise<ModuloDeConfig> {
  const real = await vi.importActual<ModuloDeConfig>("@/lib/instalacao/config");
  return {
    ...real,
    valorDaInstalacao: async (chave: string) =>
      chave === "PAIS_DA_INSTALACAO"
        ? { valor: null, fonte: "ausente" }
        : real.valorDaInstalacao(chave),
  };
}
