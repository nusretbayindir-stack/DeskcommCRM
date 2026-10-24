/**
 * O botão "Entrar com Google" deve aparecer nas telas de entrada e de cadastro?
 *
 * Só um `desligado` LIDO esconde o botão. `desconhecido` (rede fora, GoTrue
 * dormindo) mostra: não ler não prova que o provedor está desligado, e esconder
 * por dúvida tira a entrada de quem a tem (mesma regra de `provedor-google.ts`).
 *
 * A leitura vai à rede (prazo de 4 s) e as telas são renderizadas a cada visita.
 * Por isso um resultado DEFINITIVO fica em memória por um minuto; `desconhecido`
 * nunca fica — a próxima visita tenta ler de novo.
 */
import { estadoDoProvedorGoogle } from "@/lib/auth/provedor-google";

const VALIDADE_MS = 60_000;

let guardado: { desligado: boolean; ate: number } | null = null;

export async function botaoGoogleVisivel(): Promise<boolean> {
  const agora = Date.now();
  if (guardado && guardado.ate > agora) return !guardado.desligado;

  const estado = await estadoDoProvedorGoogle();
  if (estado === "desconhecido") return true;

  guardado = { desligado: estado === "desligado", ate: Date.now() + VALIDADE_MS };
  return estado !== "desligado";
}
