/**
 * O PDF do atestado de anonimização.
 *
 * ─── ESTE DOCUMENTO NÃO LEVA MARCA — é decisão, não esquecimento ────────────
 *
 * Mesma régua do relatório do art. 18, II (`lib/lgpd/pdf-renderer.tsx`): o
 * papel imprime o CONTROLADOR e o encarregado; não imprime a marca de quem
 * licenciou o software, não leva logo e não leva cor. Quem responde pelos dados
 * é quem executou o apagamento, e nomear o revendedor (operador) num documento
 * jurídico inverteria os papéis.
 *
 * ─── O QUE ESTE PAPEL NÃO IMPRIME (CR do PR #3321, itens 1 e 2) ────────────
 *
 * (1) Não imprime a identidade do titular — nem o nome, nem o documento, nem os
 * contatos, nem mascarados. O que o documento atesta é o apagamento; reimprimir
 * aqui o dado apagado criaria uma cópia nova, sem prazo e fora do alcance da
 * cascata de exclusão. O requerente é identificado pelo PROTOCOLO do pedido.
 * (2) Não cita lei: a citação do perfil do país (`citacaoDaLei`) é a do direito
 * de ACESSO (`LGPD Art. 18, II` no Brasil, `RGPD art. 15.º` em Portugal), e num
 * atestado de eliminação ela afirmaria um direito que o titular não exerceu
 * neste pedido. Cabeçalho sem lei é melhor que cabeçalho com o artigo errado.
 *
 * Consequência prática: `Stylesheet` de módulo, sem `oklch()`/`var(--x)` — que o
 * @react-pdf descarta em silêncio, gerando PDF válido com a cor perdida.
 *
 * O CONTEÚDO vem pronto de `atestado-de-anonimizacao.ts` (declaração, campos e
 * código): este arquivo só desenha. É o que permite testar o texto sem abrir
 * PDF, e o PDF sem redigitar texto.
 *
 * ─── No idioma do titular (S2a Task 13) ─────────────────────────────────────
 *
 * Quem guarda o atestado é o titular (a equipe o repassa pelo canal do pedido),
 * então ele sai no idioma do titular. Cada texto fixo passa por `t()`; sem
 * `idioma` (Portugal, ou quem não passa nenhum) `t` devolve o texto de sempre.
 * O código de autenticidade não muda com o idioma: ele assina a linha canônica,
 * não o texto impresso.
 */
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import type { Idioma } from "@/lib/i18n/idiomas";
import {
  VERSAO_DO_ATESTADO,
  dataHoraNoFuso,
  textoDaDeclaracao,
  type AlgoritmoDoCodigo,
  type DadosDoAtestado,
} from "@/lib/lgpd/atestado-de-anonimizacao";
import { fonteDoDocumentoTraduzido } from "@/lib/lgpd/fonte-do-documento";
import { documentoNoIdioma } from "@/lib/lgpd/idioma-do-documento";

export interface PropsDoAtestado {
  dados: DadosDoAtestado;
  /** O código já calculado (16 hex citáveis) e o que de fato o produziu. */
  codigo: string;
  algoritmo: AlgoritmoDoCodigo;
  /** O idioma do titular (`idiomaDoTitular`). Ausente = o texto de sempre. */
  idioma?: Idioma;
}

const styles = StyleSheet.create({
  page: { paddingVertical: 44, paddingHorizontal: 44, fontSize: 9.5, fontFamily: "Helvetica", color: "#111111" },
  header: { borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 10, marginBottom: 14 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 8.5, color: "#444444" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 2.5 },
  label: { width: 132, color: "#444444" },
  value: { flex: 1 },
  declaracao: { lineHeight: 1.5, textAlign: "justify" },
  destaque: { fontFamily: "Helvetica-Bold" },
  caixa: { borderWidth: 1, borderColor: "#111111", padding: 8, marginTop: 4 },
  caixaTitulo: { fontSize: 8, color: "#444444", marginBottom: 3, textTransform: "uppercase" },
  codigo: { fontSize: 13, fontFamily: "Courier-Bold", letterSpacing: 1, marginBottom: 3 },
  notaFina: { fontSize: 7.5, color: "#444444", lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 7, color: "#666666" },
});

export function AtestadoDeAnonimizacaoPdf({ dados, codigo, algoritmo, idioma }: PropsDoAtestado): React.ReactElement {
  const d = documentoNoIdioma(idioma);
  const { t } = d;
  // O documento traduzido leva uma fonte com as letras do turco (`fonte-do-documento.ts`);
  // os títulos em negrito trocam a Helvetica-Bold pela mesma família, em negrito.
  const fonte = d.idioma ? fonteDoDocumentoTraduzido() : undefined;
  const titulo = fonte ? [styles.title, { fontFamily: fonte, fontWeight: "bold" as const }] : styles.title;
  const secao = fonte
    ? [styles.sectionTitle, { fontFamily: fonte, fontWeight: "bold" as const }]
    : styles.sectionTitle;
  // `textTransform: uppercase` não conhece o turco (i → I, e não İ): o texto traduzido já vai em caixa alta do idioma.
  const caixaAlta = (texto: string) => (d.etiqueta ? texto.toLocaleUpperCase(d.etiqueta) : texto);
  const e = dados.evidencia;
  const executor = e.executor
    ? `${e.executor.nome}${e.executor.papel ? ` — ${e.executor.papel}` : ""}${e.executor.email ? ` <${e.executor.email}>` : ""}`
    : t("execução automática do sistema");
  return (
    <Document {...(d.etiqueta ? { language: d.etiqueta } : {})}>
      <Page size="A4" style={fonte ? [styles.page, { fontFamily: fonte }] : styles.page}>
        <View style={styles.header}>
          <Text style={titulo}>{t("Atestado de Anonimização de Dados Pessoais")}</Text>
          <Text style={styles.subtitle}>{t("Protocolo #{protocolo}", { protocolo: dados.request_id.slice(0, 8) })}</Text>
        </View>

        <View style={styles.section}>
          <Text style={secao}>{caixaAlta(t("Controlador"))}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Razão social:")}</Text>
            <Text style={styles.value}>{dados.organization_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("CNPJ:")}</Text>
            <Text style={styles.value}>{dados.organization_document ?? t("não cadastrado")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Encarregado (DPO):")}</Text>
            <Text style={styles.value}>{dados.organization_email ?? t("não cadastrado")}</Text>
          </View>
        </View>

        {/*
          O requerente entra pelo PROTOCOLO, e só por ele: o papel atesta o
          apagamento, e reimprimir nome/documento/contato — mesmo mascarados —
          guardaria numa cópia nova o dado que a cascata acabou de apagar.
        */}
        <View style={styles.section}>
          <Text style={secao}>{caixaAlta(t("Requerente"))}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Protocolo:")}</Text>
            <Text style={styles.value}>{dados.request_id}</Text>
          </View>
          <Text style={styles.notaFina}>
            {t(
              "O requerente é identificado apenas pelo protocolo do pedido: este documento não reproduz nome, documento nem contato do titular — nem mascarados. É a trilha de auditoria que guarda o vínculo com o pedido.",
            )}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={secao}>{caixaAlta(t("Declaração"))}</Text>
          <Text style={styles.declaracao}>{textoDaDeclaracao(dados, d.idioma)}</Text>
        </View>

        <View style={styles.section}>
          {/* A execução do apagamento — o "Execução" da tela é a de um processo ("Çalıştırma"). */}
          <Text style={secao}>{caixaAlta(t("Execução@@atestado"))}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Data e hora:")}</Text>
            <Text style={styles.value}>{dataHoraNoFuso(e.em, dados.fuso, d.etiqueta)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Executado por:")}</Text>
            <Text style={styles.value}>{executor}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("IP de origem:")}</Text>
            <Text style={styles.value}>{e.ip ?? t("sem ato humano (execução automática)")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Origem do pedido:")}</Text>
            <Text style={styles.value}>
              {e.origem === "aprovacao_manual" ? t("aprovação no painel") : t("automática")}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("Escopo:")}</Text>
            <Text style={styles.value}>
              {dados.escopo === "tenant" ? t("base completa da organização") : t("dados do titular")}
            </Text>
          </View>
        </View>

        <View style={styles.caixa}>
          <Text style={styles.caixaTitulo}>
            {algoritmo === "hmac-sha256"
              ? caixaAlta(t("Código de autenticidade (HMAC-SHA256)"))
              : caixaAlta(t("Código de integridade (SHA-256 — instalação sem chave de assinatura)"))}
          </Text>
          <Text style={styles.codigo}>{codigo}</Text>
          <Text style={styles.notaFina}>
            {algoritmo === "hmac-sha256"
              ? t(
                  "Produzido com a chave de assinatura desta instalação sobre os campos declarados neste documento: só quem tem a chave reproduz o código, e qualquer edição em qualquer campo o invalida.",
                )
              : t(
                  "Esta instalação não tem chave de assinatura configurada: o código prova que os campos declarados não foram editados, mas não prova a origem do documento.",
                )}
            {` ${t("Formato {versao}. O código é citável e reconferível pelo controlador.", { versao: VERSAO_DO_ATESTADO })}`}
          </Text>
        </View>

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
          t("Documento gerado automaticamente pelo sistema do controlador · página {pagina} de {total}", {
            pagina: pageNumber,
            total: totalPages,
          })
        } />
      </Page>
    </Document>
  );
}

export async function renderAtestadoPdf(props: PropsDoAtestado): Promise<Buffer> {
  const element = <AtestadoDeAnonimizacaoPdf {...props} />;
  return (await renderToBuffer(element)) as Buffer;
}
