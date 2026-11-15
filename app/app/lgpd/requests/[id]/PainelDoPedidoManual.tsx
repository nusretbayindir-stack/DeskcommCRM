"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";

import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { LgpdRequestType } from "@/hooks/useLgpdRequests";
// Só o TIPO: o módulo do painel é de servidor (banco e node:crypto) e não entra no bundle.
import type { PainelDoPedido } from "@/lib/lgpd/painel-do-pedido";

const CANAL_LABELS: Record<string, string> = {
  whatsapp_registrado: "Pelo número de WhatsApp cadastrado",
  email_registrado: "Pelo e-mail cadastrado",
  outro: "Por outro meio",
};

/** O instante gravado pelo servidor, ou nada se ele não for uma data legível. */
function dataLegivel(iso: string, formato: string, locale: ReturnType<typeof useLocaleDeData>): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, formato, { locale });
}

/** Texto pronto para a equipe levar à conversa: leitura apenas e um botão que copia. */
export function TextoParaCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const t = useT();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success(t("Copiado"));
    } catch {
      // Sem permissão do navegador: o texto segue selecionável na caixa.
    }
  }

  return (
    <div className="space-y-2">
      <Textarea readOnly aria-label={rotulo} value={texto} rows={5} className="resize-none text-sm" />
      <Button type="button" size="sm" variant="outline" onClick={() => void copiar()}>
        {copiado ? t("Copiado") : t("Copiar")}
      </Button>
    </div>
  );
}

/**
 * O bloco da exclusão sem e-mail, dentro da janela de aprovação: sem a mensagem
 * enviada antes, depois da exclusão não há mais como falar com a pessoa.
 */
export function AvisoDaExclusaoSemEmail({
  painel,
  enviado,
  onEnviado,
}: {
  painel: Pick<PainelDoPedido, "mensagem_de_exclusao" | "conversa_href">;
  enviado: boolean;
  onEnviado: (valor: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm">
      <p>
        {t(
          "Depois da aprovação não será possível falar com esta pessoa: o número e a conversa também são apagados. Envie agora, pela conversa do WhatsApp, a mensagem abaixo.",
        )}
      </p>
      {painel.mensagem_de_exclusao && (
        <TextoParaCopiar texto={painel.mensagem_de_exclusao} rotulo={t("Mensagem")} />
      )}
      {painel.conversa_href && (
        <Button asChild type="button" size="sm" variant="link" className="h-auto px-0">
          <Link href={painel.conversa_href} target="_blank" rel="noopener noreferrer">
            {t("Abrir a conversa")}
          </Link>
        </Button>
      )}
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={enviado} onChange={(e) => onEnviado(e.target.checked)} />
        {t("Enviei a mensagem")}
      </label>
    </div>
  );
}

interface Props {
  painel: PainelDoPedido;
  requestType: LgpdRequestType;
  status: string;
  /** Quem recebe o envio; cobre o painel neutro (painel que não pôde ser montado). */
  emailDoTitular?: string | null;
}

/**
 * "Como o pedido chegou", "Para onde vai o relatório" e os avisos antes de
 * aprovar (U53). Painel neutro (todos os campos vazios) não mostra aviso nenhum.
 */
export function PainelDoPedidoManual({ painel, requestType, status, emailDoTitular = null }: Props) {
  const t = useT();
  const localeDaData = useLocaleDeData();
  const fechado = status === "completed" || status === "failed";
  const abertura = painel.abertura;
  const criadoEm = abertura ? dataLegivel(abertura.criado_em, "dd/MM/yyyy HH:mm", localeDaData) : null;
  const destino = painel.destino_do_relatorio ?? emailDoTitular;

  const mostraArt15 = painel.art15_vazio && requestType === "data_request" && !fechado;
  const mostraAcessoAberto = painel.acesso_aberto && requestType === "redact" && !fechado;
  const mostraDestino = requestType === "data_request";

  if (!abertura && !mostraDestino && !mostraArt15 && !mostraAcessoAberto) return null;

  return (
    <div className="flex flex-col gap-4">
      {mostraArt15 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <span>
            {t(
              'A parte "finalidades, destinatários, prazo de conservação" do relatório está vazia. Preencha em Configurações › Empresa; sem isso o relatório diz "não informado".',
            )}
          </span>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/app/settings/tenant">{t("Abrir configurações")}</Link>
          </Button>
        </div>
      )}

      {mostraAcessoAberto && (
        <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          {t(
            "Este contato tem um pedido de acesso aberto. Envie o relatório primeiro; depois da exclusão ele sai vazio.",
          )}
        </div>
      )}

      {(abertura || mostraDestino) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {abertura && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("Como o pedido chegou")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Linha rotulo={t("Como chegou")} valor={t(CANAL_LABELS[abertura.canal] ?? abertura.canal)} />
                {abertura.criado_por_nome && <Linha rotulo={t("Aberto por")} valor={abertura.criado_por_nome} />}
                {criadoEm && <Linha rotulo={t("Aberto em")} valor={criadoEm} />}
                {abertura.observacao && <Linha rotulo={t("Observação")} valor={abertura.observacao} />}
              </CardContent>
            </Card>
          )}

          {mostraDestino && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("Para onde vai o relatório")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm break-words">
                {destino ?? t("Sem e-mail cadastrado; o relatório será entregue à mão.")}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{rotulo}</span>
      <span className="text-right break-words">{valor}</span>
    </div>
  );
}
