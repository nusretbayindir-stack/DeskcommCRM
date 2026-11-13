/**
 * O IDIOMA DOS DOCUMENTOS QUE O TITULAR RECEBE — o relatório de acesso, o
 * e-mail que o entrega, os avisos do art. 12.º e o atestado de anonimização
 * (S2a Task 13, decisão D10).
 *
 * ─── Quem lê, e por isso qual idioma ────────────────────────────────────────
 *
 * Os quatro são do TITULAR: o relatório, o e-mail e os avisos vão direto a ele;
 * o atestado, a equipe repassa pelo canal do pedido (a rota que o entrega diz
 * "o atestado do pedido, para o titular"). Vale então a regra das mensagens
 * fixas ao cliente: o idioma do contato; sem ele, ou num idioma que o produto
 * não serve, o da empresa (`idiomaDoDestinatario`). Quem lê esses dois no banco
 * é `lib/lgpd/idioma-do-titular.ts`; este arquivo não faz I/O.
 *
 * ─── O texto-fonte é o de hoje, e Brasil e Portugal não mudam ───────────────
 *
 * As chaves dos catálogos são os textos que os documentos já imprimiam: o pt-PT
 * do ramo de fora do Brasil e o português do PDF, que Portugal também lê.
 * Brasil e Portugal saem no texto-fonte, byte a byte, seja qual for o idioma do
 * contato (provado contra `tests/fixtures/lgpd-documentos-antes-da-t13/` e os
 * fixtures do doc 88). `idioma: undefined` é o texto-fonte; o idioma padrão do
 * produto também cai nele, porque o português dos documentos É a chave.
 *
 * ─── A citação continua vindo do perfil ─────────────────────────────────────
 *
 * `citacaoDaLei(perfil)` monta a citação, e o catálogo traduz a frase inteira
 * ("GDPR art. 15 (Regulation (EU) 2016/679)" → "GDPR art. 15 (Verordening (EU)
 * 2016/679)"). Citação sem linha no catálogo sai como o perfil a escreve.
 */
import { tagDeIdioma } from "@/lib/i18n/datas";
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";
import { semContexto } from "@/lib/i18n/no-contexto";
import { preencher } from "@/lib/i18n/preencher";
import { AUTORIDADE_EM_FRANCES } from "@/lib/legal/autoridade-belga";
import { PERFIS_DO_PAIS, type AutoridadeDeSupervisao } from "@/lib/legal/perfil-do-pais";

/**
 * Os países cujo documento é o texto-fonte, em português. "BR" é o `PAIS_PADRAO`
 * de `perfil-do-pais`: o literal evita ler aquele módulo ao carregar este — os
 * testes dos workers o substituem só com `perfilDaOrganizacao`.
 */
const PAISES_DO_TEXTO_FONTE: ReadonlySet<string> = new Set(["BR", "PT"]);

/**
 * O documento deste país muda de idioma? Brasil e Portugal, não. País vazio é o
 * Brasil, como em todo o produto. Quem chama passa `perfil.codigo`, que é sempre
 * um país registrado (`perfilDaOrganizacao` já trocou o desconhecido pelo Brasil).
 */
export function paisTraduzODocumento(codigoDoPais: string | null | undefined): boolean {
  const codigo = (codigoDoPais ?? "").trim().toUpperCase() || "BR";
  return !PAISES_DO_TEXTO_FONTE.has(codigo);
}

/** O idioma em que o documento sai, ou `undefined` para o texto-fonte. */
export function idiomaDoDocumento(
  codigoDoPais: string | null | undefined,
  idioma: Idioma | null | undefined,
): Idioma | undefined {
  if (!idioma || idioma === IDIOMA_PADRAO) return undefined;
  return paisTraduzODocumento(codigoDoPais) ? idioma : undefined;
}

/**
 * Data e hora no documento traduzido, com os campos escritos: sem eles o
 * francês da Bélgica imprime "14 h 00 min 00 s". O texto-fonte não usa isto —
 * Portugal segue com o formato de sempre.
 */
export const DATA_E_HORA_DO_DOCUMENTO: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

/** O que um documento precisa para sair num idioma. */
export interface DocumentoNoIdioma {
  /** O idioma de saída; `undefined` = o texto-fonte (o documento de antes da Task 13). */
  readonly idioma: Idioma | undefined;
  /**
   * Traduz a frase-chave (o texto de hoje) e preenche as `{marcas}`. No
   * texto-fonte só preenche: a chave é o próprio texto.
   */
  t(texto: string, valores?: Record<string, string | number>): string;
  /**
   * Traduz um texto jurídico que chega PRONTO de outro módulo: a constante da lei
   * (`lib/legal/art15.ts`) ou a citação do perfil do país (`citacaoDaLei`).
   * Conjunto fechado, escrito no código — não é dado do operador —, e por isso
   * não passa por `t(literal)`; a cobertura nos quatro idiomas é medida em
   * `tests/unit/lgpd-relatorio-no-idioma-do-titular.test.ts`, que usa as constantes de verdade.
   */
  daLei(texto: string): string;
  /** A etiqueta BCP-47 de datas, números e `lang`; `undefined` no texto-fonte (cada documento sabe a sua). */
  readonly etiqueta: string | undefined;
  /** Os dois-pontos de um rótulo montado no código: o francês põe espaço inseparável antes. */
  readonly doisPontos: string;
}

/**
 * O tradutor de um documento.
 *
 * Com `codigoDoPais`, a regra de Brasil e Portugal vale aqui também (o e-mail e
 * os avisos sabem o país); sem ele (o PDF e o atestado não sabem), vale o idioma
 * que quem chama resolveu com `idiomaDoTitular`.
 */
export function documentoNoIdioma(idioma?: Idioma | null, codigoDoPais?: string | null): DocumentoNoIdioma {
  const alvo =
    codigoDoPais === undefined
      ? idioma && idioma !== IDIOMA_PADRAO
        ? idioma
        : undefined
      : idiomaDoDocumento(codigoDoPais, idioma);
  if (!alvo) {
    // A chave com contexto (`"até@@intervalo"`, `lib/i18n/no-contexto.ts`) sai sem o contexto, como `traduzir` faz no português.
    return {
      idioma: undefined,
      t: (texto, valores) => preencher(semContexto(texto), valores ?? {}),
      daLei: (texto) => semContexto(texto),
      etiqueta: undefined,
      doisPontos: ":",
    };
  }
  // `t` e `daLei` são a ENTRADA da tradução: o corpo é a chamada, e quem chama
  // passa a chave (o passa-adireto de `tests/unit/i18n-espanhol-cobre-a-tela`).
  return {
    idioma: alvo,
    t: (texto, valores) => preencher(traduzir(texto, alvo), valores ?? {}),
    daLei: (texto) => traduzir(texto, alvo),
    etiqueta: tagDeIdioma(alvo),
    doisPontos: alvo === "fr" ? "\u00a0:" : ":",
  };
}

/**
 * A autoridade da alínea f) no idioma do documento. O perfil belga traz o nome
 * neerlandês; o documento em francês usa a mesma constante da política de
 * privacidade em francês (APD). Os outros idiomas leem o nome oficial do perfil.
 */
export function autoridadeNoIdioma(
  autoridade: AutoridadeDeSupervisao,
  idioma: Idioma | undefined,
): AutoridadeDeSupervisao {
  if (idioma !== "fr") return autoridade;
  const belga = PERFIS_DO_PAIS.BE?.autoridadeDeSupervisao;
  return belga !== undefined && autoridade.site === belga.site
    ? AUTORIDADE_EM_FRANCES
    : autoridade;
}

/*
 * As frases da alínea h) como o coletor as escreve (`descreveDecisoesAutomatizadas`
 * e `emptyPayload` em `lib/lgpd/export-collector.ts`). O payload guarda o TEXTO
 * pronto — e o `data.json` de Portugal também —, então a tradução reconhece as
 * frases em vez de mudar o que o coletor grava. Frase que mudar lá e não aqui
 * sai em português, e `tests/unit/lgpd-relatorio-no-idioma-do-titular` acusa:
 * o teste usa o coletor de verdade.
 */
const H_FALHOU =
  "Não foi possível determinar neste relatório: a leitura dos agentes de IA do controlador falhou.";
const H_SEM_ASSISTENTE = "Não há assistente de IA a responder às suas mensagens nesta organização.";
const H_SEM_DADO =
  "Nenhum dado pessoal seu foi localizado nos sistemas internos, pelo que este relatório não tem tratamento automatizado de dados seus a descrever.";
const H_AUTOMATICOS =
  "Responde(m) automaticamente às suas mensagens {n} assistente(s) de IA: {nomes}.";
const H_ASSISTIDOS =
  "Sugere(m) respostas que uma pessoa revê e decide enviar {n} assistente(s) de IA: {nomes}.";
const H_LOGICA =
  "Lógica: modelo de linguagem sobre as suas mensagens, a base de conhecimento da organização e, conforme a configuração de cada assistente, dados do CRM.";
const H_ART_22 =
  "Se deste tratamento resulta alguma decisão tomada exclusivamente por meios automatizados que produza efeitos na sua esfera jurídica ou que o afete significativamente de forma similar (art. 22.º), quem o informa é o controlador.";

/** As duas frases com a lista de assistentes, antes da lógica e do art. 22.º. */
const CABECA_DAS_DECISOES =
  /^(?:Responde\(m\) automaticamente às suas mensagens (\d+) assistente\(s\) de IA: (.*?)\.)?\s*(?:Sugere\(m\) respostas que uma pessoa revê e decide enviar (\d+) assistente\(s\) de IA: (.*)\.)?$/su;

/**
 * O texto da alínea h) no idioma do documento. Forma que este módulo não
 * conhece sai como veio (o teste acusa: ele usa o coletor de verdade).
 */
export function decisoesNoIdioma(texto: string, d: DocumentoNoIdioma): string {
  if (!d.idioma) return texto;
  if (texto === H_FALHOU) return d.t(H_FALHOU);
  if (texto === H_SEM_ASSISTENTE) return d.t(H_SEM_ASSISTENTE);
  if (texto === H_SEM_DADO) return d.t(H_SEM_DADO);
  const cauda = `${H_LOGICA} ${H_ART_22}`;
  if (!texto.endsWith(cauda)) return texto;
  const casou = CABECA_DAS_DECISOES.exec(texto.slice(0, texto.length - cauda.length).trimEnd());
  if (!casou) return texto;
  const [, automaticos, nomesAutomaticos, assistidos, nomesAssistidos] = casou;
  const frases: string[] = [];
  if (automaticos) frases.push(d.t(H_AUTOMATICOS, { n: automaticos, nomes: nomesAutomaticos ?? "" }));
  if (assistidos) frases.push(d.t(H_ASSISTIDOS, { n: assistidos, nomes: nomesAssistidos ?? "" }));
  frases.push(d.t(H_LOGICA), d.t(H_ART_22));
  return frases.join(" ");
}
