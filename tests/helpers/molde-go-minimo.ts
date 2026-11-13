/**
 * Renderizador MÍNIMO de template Go (`text/template`), só para teste.
 *
 * Entende apenas o subconjunto que os moldes de acesso usam e que o teste ao
 * vivo de 2026-11-09 (S2a, Task 3) provou no GoTrue do Supabase:
 *
 *   {{- $d := printf "%v" .Data.locale -}}   (ou `print .Data.locale`)
 *   {{ if eq $d "nl" }} … {{ else if eq $d "fr" }} … {{ else }} … {{ end }}
 *   {{ .RedirectTo }}   {{ .TokenHash }}
 *   e os marcadores de corte `{{- ` e ` -}}`.
 *
 * Qualquer outra construção LANÇA. É de propósito: um molde que passe a usar
 * algo que o GoTrue nunca rodou para nós quebra aqui, não na caixa de entrada.
 */

export interface DadosDoMolde {
  /** `user_metadata` da pessoa, como o GoTrue entrega em `.Data`. */
  Data: Record<string, unknown>;
  RedirectTo: string;
  TokenHash: string;
}

type No =
  | { tipo: "texto"; valor: string }
  | { tipo: "saida"; campo: "RedirectTo" | "TokenHash" }
  | { tipo: "atribuir"; variavel: string; chave: string }
  | { tipo: "se"; ramos: Ramo[] };

interface Ramo {
  /** `null` = o `{{ else }}` final. */
  condicao: { variavel: string; literal: string } | null;
  corpo: No[];
}

interface Token {
  tipo: "texto" | "acao";
  valor: string;
  cortaAntes: boolean;
  cortaDepois: boolean;
}

const ESPACO_NO_FIM = /[ \t\r\n]+$/;
const ESPACO_NO_INICIO = /^[ \t\r\n]+/;

function tokenizar(molde: string): Token[] {
  const tokens: Token[] = [];
  const acao = /\{\{(- )?([\s\S]*?)( -)?\}\}/g;
  let ultimo = 0;
  for (let m = acao.exec(molde); m !== null; m = acao.exec(molde)) {
    tokens.push({ tipo: "texto", valor: molde.slice(ultimo, m.index), cortaAntes: false, cortaDepois: false });
    tokens.push({ tipo: "acao", valor: (m[2] ?? "").trim(), cortaAntes: Boolean(m[1]), cortaDepois: Boolean(m[3]) });
    ultimo = m.index + m[0].length;
  }
  tokens.push({ tipo: "texto", valor: molde.slice(ultimo), cortaAntes: false, cortaDepois: false });
  // Os marcadores de corte comem o espaço em branco do texto vizinho.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.tipo !== "acao") continue;
    const antes = tokens[i - 1];
    const depois = tokens[i + 1];
    if (t.cortaAntes && antes) antes.valor = antes.valor.replace(ESPACO_NO_FIM, "");
    if (t.cortaDepois && depois) depois.valor = depois.valor.replace(ESPACO_NO_INICIO, "");
  }
  return tokens;
}

const ATRIBUIR = /^\$(\w+)\s*:=\s*(?:printf\s+"%v"|print)\s+\.Data\.(\w+)$/;
const SE = /^if\s+eq\s+\$(\w+)\s+"([^"]*)"$/;
const SENAO_SE = /^else\s+if\s+eq\s+\$(\w+)\s+"([^"]*)"$/;
const SAIDA = /^\.(RedirectTo|TokenHash)$/;

function analisar(tokens: Token[]): No[] {
  const raiz: No[] = [];
  // Pilha de destinos: onde o próximo nó entra, e o `se` aberto (se houver).
  const pilha: Array<{ corpo: No[]; se: { tipo: "se"; ramos: Ramo[] } | null }> = [{ corpo: raiz, se: null }];
  const topo = () => pilha[pilha.length - 1]!;

  for (const t of tokens) {
    if (t.tipo === "texto") {
      if (t.valor) topo().corpo.push({ tipo: "texto", valor: t.valor });
      continue;
    }
    const a = t.valor;
    let m: RegExpMatchArray | null;
    if ((m = a.match(ATRIBUIR))) {
      topo().corpo.push({ tipo: "atribuir", variavel: m[1]!, chave: m[2]! });
    } else if ((m = a.match(SE))) {
      const ramo: Ramo = { condicao: { variavel: m[1]!, literal: m[2]! }, corpo: [] };
      const se = { tipo: "se" as const, ramos: [ramo] };
      topo().corpo.push(se);
      pilha.push({ corpo: ramo.corpo, se });
    } else if ((m = a.match(SENAO_SE)) || a === "else") {
      const aberto = topo().se;
      if (!aberto) throw new Error(`molde-go: «${a}» fora de um if`);
      if (aberto.ramos[aberto.ramos.length - 1]!.condicao === null) {
        throw new Error("molde-go: ramo depois do else final");
      }
      const ramo: Ramo = { condicao: m ? { variavel: m[1]!, literal: m[2]! } : null, corpo: [] };
      aberto.ramos.push(ramo);
      topo().corpo = ramo.corpo;
    } else if (a === "end") {
      if (!topo().se) throw new Error("molde-go: end sem if");
      pilha.pop();
    } else if ((m = a.match(SAIDA))) {
      topo().corpo.push({ tipo: "saida", campo: m[1] as "RedirectTo" | "TokenHash" });
    } else {
      throw new Error(`molde-go: construção fora do subconjunto provado no GoTrue: {{ ${a} }}`);
    }
  }
  if (pilha.length !== 1) throw new Error("molde-go: if sem end");
  return raiz;
}

function executar(nos: No[], dados: DadosDoMolde, variaveis: Map<string, string>): string {
  let saida = "";
  for (const no of nos) {
    switch (no.tipo) {
      case "texto":
        saida += no.valor;
        break;
      case "saida":
        saida += dados[no.campo];
        break;
      case "atribuir": {
        // Chave ausente no `user_metadata`: o Go imprime um marcador, nunca um
        // código de idioma — o que importa é que nenhum `eq` case.
        const valor = dados.Data[no.chave];
        variaveis.set(no.variavel, valor === undefined || valor === null ? "<no value>" : String(valor));
        break;
      }
      case "se": {
        const ramo = no.ramos.find((r) => {
          if (r.condicao === null) return true;
          const atual = variaveis.get(r.condicao.variavel);
          if (atual === undefined) throw new Error(`molde-go: variável $${r.condicao.variavel} não declarada`);
          return atual === r.condicao.literal;
        });
        if (ramo) saida += executar(ramo.corpo, dados, variaveis);
        break;
      }
    }
  }
  return saida;
}

export function renderizarMoldeGo(molde: string, dados: DadosDoMolde): string {
  return executar(analisar(tokenizar(molde)), dados, new Map());
}
