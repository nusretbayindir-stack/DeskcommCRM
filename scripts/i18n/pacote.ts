/**
 * O CATÁLOGO DE CADA IDIOMA NO PACOTE DO NAVEGADOR — as regras, puras.
 *
 * Quem lê o pacote de produção é `./medir-pacote.ts`; aqui só a decisão. Cada
 * catálogo é reconhecido pela SENTINELA: a tradução de "Plano atual", uma frase
 * que todo catálogo completo tem e que não aparece em código de tela. O
 * dicionário (português-espanhol) é reconhecido pelo espanhol da mesma frase,
 * e a parte onde ele mora é a que todo usuário baixa.
 */

/** A frase que identifica um catálogo dentro do pacote. */
export const CHAVE_SENTINELA = "Plano atual";

export interface ParteDoPacote {
  nome: string;
  conteudo: string;
}

/** A sentinela de cada catálogo; o idioma cujo catálogo ainda não tem a frase fica de fora. */
export function sentinelasDosCatalogos(
  catalogos: Record<string, Record<string, string>>,
): Record<string, string> {
  const sentinelas: Record<string, string> = {};
  for (const [idioma, catalogo] of Object.entries(catalogos)) {
    const valor = catalogo[CHAVE_SENTINELA];
    if (typeof valor === "string" && valor.trim() !== "") sentinelas[idioma] = valor;
  }
  return sentinelas;
}

/** Em que partes do pacote cada catálogo aparece (lista vazia = em nenhuma). */
export function ondeEstaCadaCatalogo(
  partes: readonly ParteDoPacote[],
  sentinelas: Record<string, string>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(sentinelas).map(([idioma, sentinela]) => [
      idioma,
      partes.filter((parte) => parte.conteudo.includes(sentinela)).map((parte) => parte.nome),
    ]),
  );
}

/**
 * O que reprova o pacote. Catálogo ausente NÃO reprova: o de um idioma em
 * construção não deve ir ao navegador, e a sonda de carregamento é quem prova
 * que o de um idioma visível chega.
 */
export function violacoesDoPacote(
  partes: readonly ParteDoPacote[],
  sentinelas: Record<string, string>,
  sentinelaDoDicionario: string,
): string[] {
  const violacoes: string[] = [];
  const onde = ondeEstaCadaCatalogo(partes, sentinelas);

  for (const [idioma, nomes] of Object.entries(onde)) {
    if (nomes.length > 1) {
      violacoes.push(`${idioma}: catálogo em ${nomes.length} partes (${nomes.join(", ")})`);
    }
  }

  for (const parte of partes) {
    const idiomas = Object.keys(onde).filter((idioma) => onde[idioma]?.includes(parte.nome));
    if (idiomas.length === 0) continue;
    if (parte.conteudo.includes(sentinelaDoDicionario)) {
      violacoes.push(`${parte.nome}: catálogo (${idiomas.join(", ")}) na mesma parte do dicionário`);
    } else if (idiomas.length > 1) {
      violacoes.push(`${parte.nome}: ${idiomas.length} catálogos na mesma parte (${idiomas.join(", ")})`);
    }
  }

  return violacoes;
}
