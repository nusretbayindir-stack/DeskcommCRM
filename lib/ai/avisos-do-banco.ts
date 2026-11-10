/**
 * OS AVISOS QUE O BANCO GRAVA NA CENTRAL SAEM NO IDIOMA DA EMPRESA (S2a, U14).
 *
 * Funções SQL do upstream gravam na Central (`agent_inbox_items`) título e
 * corpo em português escritos no próprio corpo — num insert, num update (a
 * anonimização) ou chamando `fn_agent_legacy_notice` com texto fixo. Reescrevê-las
 * seria copiar o corpo inteiro de cada uma para o fork, e a cada sincronização
 * ou a nossa cópia apagaria uma correção do upstream, ou a dele apagaria a
 * tradução sem ninguém ver. Em vez disso, o gatilho
 * `trg_central_no_idioma_da_empresa` (migration 7002, `before insert or update
 * of title, body`) troca o texto conhecido pelo do idioma da organização. As
 * funções não mudam.
 *
 * Esta tabela é a fonte. Cada texto está aqui exatamente como a função o
 * escreve, com `{nome}` no pedaço que vem do banco (o título do compromisso, o
 * erro, uma contagem). A tradução vem do catálogo (`traduzir`), e o jsonb do
 * gatilho deriva daqui (`padroesDoGatilho`). `avisos-do-banco-no-idioma.test.ts`
 * reprova quando o jsonb diverge, quando o upstream muda um texto (ele deixaria
 * de casar e voltaria ao português) e quando uma função nova grava na Central.
 *
 * Idioma: o código exato de `organizations.locale` entre os visíveis, senão o
 * texto fica em português — o mesmo de `normalizarIdioma`.
 */
import { traduzir } from "@/lib/i18n/dicionario";
import { IDIOMA_PADRAO, IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";

/** O texto em português, exatamente como a função SQL o escreve. `{n}` é sempre um número. */
const TEXTOS = {
  acompanhamentoTitulo: "O acompanhamento não conseguiu enviar a mensagem",
  /** O corpo quando o job não tem erro: `coalesce(j.last_error, 'envio indisponível')`. */
  acompanhamentoCorpoPadrao: "Abra o acompanhamento e confira o canal. Motivo: envio indisponível",
  acompanhamentoCorpo: "Abra o acompanhamento e confira o canal. Motivo: {motivo}",
  semResponsavelTitulo: "Uma conversa aguarda um responsável",
  semResponsavelCanal: "Confira o canal de origem desta conversa nas Conexões.",
  semResponsavelEquipe:
    "Confira os responsáveis do canal em Configurações → Atendimento e a disponibilidade da equipe. A distribuição continuará tentando.",
  reuniaoTitulo: "Link da reunião precisa de atenção",
  reuniaoCorpo: "Abra o compromisso na Agenda para verificar o link ou autorizar uma nova entrega.",
  presencaVencidaTitulo: "Presença sem confirmação há mais tempo",
  presencaTitulo: "Confirme a presença no compromisso",
  presencaCorpo:
    "Compromisso: {titulo}. Abra e registre se a pessoa compareceu, faltou ou cancelou. O horário sozinho não confirma falta.",
  reativadaConversasTitulo: "A conta foi reativada — há conversas para revisar",
  reativadaAgendamentosTitulo: "A conta foi reativada — há agendamentos e follow-ups para revisar",
  reativadaUmaConversa: "1 conversa recebeu mensagem enquanto a conta estava suspensa.",
  reativadaConversas: "{n} conversas receberam mensagem enquanto a conta estava suspensa.",
  reativadaUmAgendamento: "1 agendamento de disparo único venceu durante a suspensão e não foi disparado.",
  reativadaAgendamentos:
    "{n} agendamentos de disparo único venceram durante a suspensão e não foram disparados.",
  reativadaUmPasso: "1 passo de follow-up foi descartado durante a suspensão; confira o follow-up do contato.",
  reativadaPassos:
    "{n} passos de follow-up foram descartados durante a suspensão; confira o follow-up dos contatos.",
  recuperacaoTitulo: "A recuperação não foi iniciada",
  recuperacaoOutroFluxo:
    "Este contato já tem outro acompanhamento. Revise o próximo passo; nenhuma recuperação ficou aguardando vaga.",
  recuperacaoAmbigua:
    "Mais de um fluxo atende a esta falta. Deixe apenas um configurado ou escolha manualmente o próximo passo.",
  recuperacaoSemFluxo:
    "Configure um fluxo de recuperação e habilite-o em um assistente publicado. Esta falta não será iniciada retroativamente.",
  recuperacaoContexto: "O contexto mudou ou não há contato vinculado. Abra o compromisso e escolha o próximo passo.",
  legadoRecuperadoTitulo: "Agente recuperado",
  legadoRecuperadoCorpo: "A configuração foi recuperada. As respostas usam a versão publicada.",
  contatoAnonimizado: "Contato anonimizado.",
} as const satisfies Record<string, string>;

export type ChaveDoAvisoDoBanco = keyof typeof TEXTOS;

/**
 * `campo`: o texto é o título ou o corpo inteiro. `frase`: o texto é uma frase
 * dentro do corpo — o da reativação junta até três (`concat_ws`), cada uma com
 * a sua contagem.
 */
export type FormaDoAviso = "campo" | "frase";

export interface OrigemDoAviso {
  chave: ChaveDoAvisoDoBanco;
  /** As funções SQL que escrevem o texto (insert, update de title/body, ou chamada a uma das `FUNCOES_COM_TEXTO_DE_QUEM_CHAMA`). */
  funcoes: readonly string[];
  forma: FormaDoAviso;
  /**
   * Os literais em que a função monta o texto, quando não é um só com
   * `{marcas}` no lugar do variável: `'…Motivo: '||coalesce(j.last_error,'envio indisponível')`.
   */
  pedacosNoSql?: readonly string[];
}

/**
 * De que função vem cada texto, na ordem em que o gatilho aplica: o específico
 * antes do genérico que também o casaria (o corpo com o motivo padrão antes de
 * `{motivo}`). O motivo de verdade passa cru: é o erro técnico do job.
 */
export const ORIGEM_DOS_AVISOS: readonly OrigemDoAviso[] = [
  { chave: "acompanhamentoTitulo", funcoes: ["fn_followup_inline_settle"], forma: "campo" },
  {
    chave: "acompanhamentoCorpoPadrao",
    funcoes: ["fn_followup_inline_settle"],
    forma: "campo",
    pedacosNoSql: ["Abra o acompanhamento e confira o canal. Motivo: ", "envio indisponível"],
  },
  { chave: "acompanhamentoCorpo", funcoes: ["fn_followup_inline_settle"], forma: "campo" },
  { chave: "semResponsavelTitulo", funcoes: ["fn_routing_unassigned_notice"], forma: "campo" },
  { chave: "semResponsavelCanal", funcoes: ["fn_routing_unassigned_notice"], forma: "campo" },
  { chave: "semResponsavelEquipe", funcoes: ["fn_routing_unassigned_notice"], forma: "campo" },
  { chave: "reuniaoTitulo", funcoes: ["fn_meet_notice"], forma: "campo" },
  { chave: "reuniaoCorpo", funcoes: ["fn_meet_notice"], forma: "campo" },
  { chave: "presencaVencidaTitulo", funcoes: ["fn_appointment_confirmation_sweep"], forma: "campo" },
  { chave: "presencaTitulo", funcoes: ["fn_appointment_confirmation_sweep"], forma: "campo" },
  { chave: "presencaCorpo", funcoes: ["fn_appointment_confirmation_sweep"], forma: "campo" },
  { chave: "reativadaConversasTitulo", funcoes: ["fn_reativar_organizacao"], forma: "campo" },
  { chave: "reativadaAgendamentosTitulo", funcoes: ["fn_reativar_organizacao"], forma: "campo" },
  { chave: "reativadaUmaConversa", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "reativadaConversas", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "reativadaUmAgendamento", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "reativadaAgendamentos", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "reativadaUmPasso", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "reativadaPassos", funcoes: ["fn_reativar_organizacao"], forma: "frase" },
  { chave: "recuperacaoTitulo", funcoes: ["fn_appointment_recover"], forma: "campo" },
  { chave: "recuperacaoOutroFluxo", funcoes: ["fn_appointment_recover"], forma: "campo" },
  { chave: "recuperacaoAmbigua", funcoes: ["fn_appointment_recover"], forma: "campo" },
  { chave: "recuperacaoSemFluxo", funcoes: ["fn_appointment_recover"], forma: "campo" },
  { chave: "recuperacaoContexto", funcoes: ["fn_appointment_recover"], forma: "campo" },
  // O gatilho do upstream que avisa o agente legado publicado chama fn_agent_legacy_notice com texto fixo.
  { chave: "legadoRecuperadoTitulo", funcoes: ["fn_agent_legacy_published"], forma: "campo" },
  { chave: "legadoRecuperadoCorpo", funcoes: ["fn_agent_legacy_published"], forma: "campo" },
  // A anonimização (LGPD) troca o corpo do aviso por este texto, num update.
  {
    chave: "contatoAnonimizado",
    funcoes: ["fn_anonimizar_aviso_de_remetente", "fn_lgpd_cascade_redact_contact", "fn_meet_redact_contact"],
    forma: "campo",
  },
];

/** Os literais que a função escreve para este texto: `pedacosNoSql`, ou o texto sem as `{marcas}`. */
export function pedacosDoAviso(origem: OrigemDoAviso): string[] {
  return origem.pedacosNoSql
    ? [...origem.pedacosNoSql]
    : TEXTOS[origem.chave].split(/\{[a-z]+\}/).filter((p) => p.length > 0);
}

/**
 * Funções que gravam na Central o texto que RECEBEM: quem traduz é quem chama.
 * Em TypeScript, as guardas da Central olham essas chamadas
 * (`central-fala-o-idioma-da-org`, `central-sem-portugues-fixo`); em SQL, quem
 * as chama com texto fixo entra em `ORIGEM_DOS_AVISOS`.
 */
export const FUNCOES_COM_TEXTO_DE_QUEM_CHAMA = {
  fn_agent_legacy_notice: ["p_title", "p_body"],
  fn_cobranca_registrar_aviso: ["p_titulo", "p_corpo"],
  fn_cobranca_avisar_teto_de_ia: ["p_titulo", "p_corpo"],
} as const satisfies Record<string, readonly string[]>;

export function textoDoAvisoDoBanco(chave: ChaveDoAvisoDoBanco, idioma: Idioma): string {
  return traduzir(TEXTOS[chave], idioma);
}

/** O texto em português, como a função o escreve. */
export function textoOriginalDoAvisoDoBanco(chave: ChaveDoAvisoDoBanco): string {
  return TEXTOS[chave];
}

const MARCA = /\{([a-z]+)\}/g;

/** Os `{nomes}` do texto, na ordem em que aparecem. */
export function marcasDoTexto(texto: string): string[] {
  return [...texto.matchAll(MARCA)].map((m) => m[1]!);
}

const ESPECIAL_DE_REGEX = /[\\^$.|?*+()[\]{}]/g;

/** O padrão POSIX (ARE) do Postgres que casa o texto em português; `{n}` casa só dígitos. */
function padraoDoTexto(pt: string, forma: FormaDoAviso): string {
  const partes = pt.split(/\{([a-z]+)\}/);
  const corpo = partes
    .map((parte, i) => (i % 2 === 0 ? parte.replace(ESPECIAL_DE_REGEX, "\\$&") : parte === "n" ? "([0-9]+)" : "(.*)"))
    .join("");
  return forma === "campo" ? `^${corpo}$` : corpo;
}

/** A substituição do `regexp_replace`: cada `{nome}` vira `\k`, pela posição do nome no português. */
function substituicaoDoTexto(traduzido: string, nomesDoPortugues: string[]): string {
  return traduzido.replace(/\\/g, "\\\\").replace(MARCA, (_, nome: string) => {
    const posicao = nomesDoPortugues.indexOf(nome);
    if (posicao < 0) throw new Error(`a tradução usa {${nome}}, que o português não tem: ${traduzido}`);
    return `\\${posicao + 1}`;
  });
}

/** Um passo do gatilho: `[padrão, substituição, flags do regexp_replace]`. */
export type PassoDoGatilho = [padrao: string, substituicao: string, flags: "" | "g"];

/**
 * O jsonb que o gatilho guarda: por idioma visível que não é o padrão, os
 * passos na ordem de `ORIGEM_DOS_AVISOS`. Idioma fora daqui fica em português.
 */
export function padroesDoGatilho(): Record<string, PassoDoGatilho[]> {
  const resultado: Record<string, PassoDoGatilho[]> = {};
  for (const idioma of IDIOMAS) {
    if (idioma === IDIOMA_PADRAO) continue;
    resultado[idioma] = ORIGEM_DOS_AVISOS.map(({ chave, forma }) => {
      const pt = TEXTOS[chave];
      return [
        padraoDoTexto(pt, forma),
        substituicaoDoTexto(textoDoAvisoDoBanco(chave, idioma), marcasDoTexto(pt)),
        forma === "campo" ? "" : "g",
      ];
    });
  }
  return resultado;
}
