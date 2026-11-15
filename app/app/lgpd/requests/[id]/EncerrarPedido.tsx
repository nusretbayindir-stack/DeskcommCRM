"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useT } from "@/hooks/i18n/useT";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEncerrarPedido } from "@/hooks/useEncerrarPedido";
import {
  encerramentoSchema,
  MOTIVOS_DE_ENCERRAMENTO,
  type MotivoDeEncerramento,
} from "@/lib/lgpd/encerramento";
// Só o TIPO: o módulo do painel é de servidor e não entra no bundle.
import type { PainelDoPedido } from "@/lib/lgpd/painel-do-pedido";
import { TextoParaCopiar } from "./PainelDoPedidoManual";

export const ROTULOS_DOS_MOTIVOS: Record<MotivoDeEncerramento, string> = {
  aberto_por_engano: "Aberto por engano",
  duplicado: "Pedido duplicado",
  retirado_pelo_titular: "O titular retirou o pedido",
  identidade_nao_confirmada: "Identidade não confirmada",
  outro: "Outro",
};

interface Props {
  requestId: string;
  status: string;
  /** Painel ausente (ou neutro) vale como "sem e-mail para avisar". */
  painel?: PainelDoPedido;
}

/**
 * Os dois fechamentos do admin (U53): "Marcar como entregue" (relatório levado
 * ao titular por fora, só em `pending_review`) e "Encerrar com motivo" (o pedido
 * não segue, só em `received`).
 */
export function EncerrarPedido({ requestId, status, painel }: Props) {
  if (status === "pending_review") return <MarcarComoEntregue requestId={requestId} />;
  if (status === "received") return <EncerrarComMotivo requestId={requestId} painel={painel} />;
  return null;
}

/** A recusa pronta de um pedido já encerrado (identidade não confirmada, titular sem e-mail). */
export function RecusaPronta({ texto }: { texto: string }) {
  const t = useT();
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 px-4 py-3 text-sm">
      <p>{t("Envie esta resposta ao titular pela conversa do WhatsApp:")}</p>
      <TextoParaCopiar texto={texto} rotulo={t("Mensagem")} />
    </div>
  );
}

function MarcarComoEntregue({ requestId }: { requestId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState("");
  const { mutate, isPending } = useEncerrarPedido();

  const corpo = { acao: "entregue_manualmente" as const, nota: nota.trim() || undefined };
  const valido = encerramentoSchema.safeParse(corpo).success;

  function confirmar() {
    if (!valido) return;
    mutate(
      { id: requestId, corpo, avisarPorEmail: false },
      {
        onSuccess: () => {
          toast.success(t("Pedido marcado como entregue."));
          setOpen(false);
          setNota("");
        },
        onError: showApiError,
      },
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("Marcar como entregue")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Marcar como entregue")}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">{t("Marcar como entregue")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="nota_da_entrega">{t("Observação da entrega")}</Label>
          <Textarea
            id="nota_da_entrega"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmar();
            }}
            disabled={!valido || isPending}
          >
            {t("Confirmar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EncerrarComMotivo({ requestId, painel }: { requestId: string; painel?: PainelDoPedido }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDeEncerramento>("aberto_por_engano");
  const [nota, setNota] = useState("");
  const [avisar, setAvisar] = useState(true);
  const { mutate, isPending } = useEncerrarPedido();

  const podeAvisar = Boolean(painel?.aviso_por_email_disponivel) && motivo === "identidade_nao_confirmada";
  const corpo = { acao: "encerrado" as const, motivo_codigo: motivo, nota: nota.trim() || undefined };
  const valido = encerramentoSchema.safeParse(corpo).success;

  function confirmar() {
    if (!valido) return;
    mutate(
      { id: requestId, corpo, avisarPorEmail: podeAvisar && avisar },
      {
        onSuccess: () => {
          toast.success(t("Pedido encerrado."));
          setOpen(false);
          setNota("");
          setMotivo("aberto_por_engano");
          setAvisar(true);
        },
        onError: showApiError,
      },
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("Encerrar com motivo")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Encerrar com motivo")}</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">{t("Encerrar com motivo")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="motivo_do_encerramento">{t("Motivo")}</Label>
            <select
              id="motivo_do_encerramento"
              className="h-11 w-full lg:h-9 rounded-md border bg-background px-2 text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoDeEncerramento)}
            >
              {MOTIVOS_DE_ENCERRAMENTO.map((m) => (
                <option key={m} value={m}>
                  {t(ROTULOS_DOS_MOTIVOS[m])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nota_do_encerramento">{t("Observação")}</Label>
            <Textarea
              id="nota_do_encerramento"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
          </div>
          {podeAvisar && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
              {t("Avisar o titular por e-mail")}
            </label>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmar();
            }}
            disabled={!valido || isPending}
          >
            {t("Confirmar")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
