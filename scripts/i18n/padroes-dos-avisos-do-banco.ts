/**
 * Imprime o jsonb do gatilho `fn_central_no_idioma_da_empresa`: os avisos que
 * funções do banco gravam na Central, no idioma da empresa (S2a, U14).
 *
 *   npx tsx scripts/i18n/padroes-dos-avisos-do-banco.ts
 *
 * A fonte é `lib/ai/avisos-do-banco.ts` mais o catálogo. Mudou um texto ou uma
 * tradução: cole a saída entre os `$padroes$` de uma migration NOVA (as já
 * aplicadas não se editam) e no apêndice do baseline.
 * `tests/unit/avisos-do-banco-no-idioma.test.ts` confere os dois.
 */
import { padroesDoGatilho } from "../../lib/ai/avisos-do-banco";

/** Um passo por linha: o diff de uma tradução mostra a linha dela. */
export function jsonbDoGatilho(): string {
  const idiomas = Object.entries(padroesDoGatilho()).map(
    ([idioma, passos]) =>
      `  ${JSON.stringify(idioma)}: [\n${passos.map((p) => `    ${JSON.stringify(p)}`).join(",\n")}\n  ]`,
  );
  return `{\n${idiomas.join(",\n")}\n}`;
}

if (process.argv[1]?.endsWith("padroes-dos-avisos-do-banco.ts")) {
  process.stdout.write(jsonbDoGatilho() + "\n");
}
