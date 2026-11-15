"use client";
import { useId, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { useCriarPedidoDoTitular } from "@/hooks/usePedidoDoTitular";
import { ApiError } from "@/lib/api/types";
import {
  PRAZO_DO_PEDIDO_MANUAL,
  type CanalDoPedido,
  type TipoDoPedidoManual,
} from "@/lib/lgpd/pedido-manual";
import { prazoEmBr } from "@/lib/lgpd/sla";

interface Props {
  contactId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canais: { whatsapp: boolean; email: boolean };
  tiposAbertos: ReadonlyArray<TipoDoPedidoManual>;
}

const TIPOS: ReadonlyArray<TipoDoPedidoManual> = ["data_request", "redact"];

/** Hoje no relógio do navegador, como AAAA-MM-DD (o `max` do campo e o dia de saída). */
function hojeLocal(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Soma dias de CALENDÁRIO a um dia AAAA-MM-DD (aritmética em UTC, sem fuso). */
function somaDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function primeiroTipoLivre(abertos: ReadonlyArray<TipoDoPedidoManual>): TipoDoPedidoManual {
  return TIPOS.find((t) => !abertos.includes(t)) ?? "data_request";
}

/**
 * Registra um pedido do titular que chegou por fora do CRM (U53).
 *
 * O servidor é quem vale: aqui só se guia. O aviso de prazo vencido é uma
 * estimativa em dias de calendário; o dia exato é calculado no servidor.
 */
export function NovoPedidoDoTitularDialog({
  contactId,
  open,
  onOpenChange,
  canais,
  tiposAbertos,
}: Props) {
  const t = useT();
  const criar = useCriarPedidoDoTitular();
  const idDia = useId();
  const idCanal = useId();
  const idObs = useId();

  const hoje = hojeLocal();
  const canaisVisiveis: CanalDoPedido[] = [
    ...(canais.whatsapp ? (["whatsapp_registrado"] as const) : []),
    ...(canais.email ? (["email_registrado"] as const) : []),
    "outro",
  ];

  const [tipo, setTipo] = useState<TipoDoPedidoManual>(() => primeiroTipoLivre(tiposAbertos));
  const [dia, setDia] = useState<string>(hoje);
  const [canal, setCanal] = useState<CanalDoPedido>(canaisVisiveis[0]);
  const [observacao, setObservacao] = useState("");
  // Prazo do pedido que já existe, quando o servidor responde 409 `pedido_aberto`.
  const [prazoExistente, setPrazoExistente] = useState<string | null>(null);

  const obs = observacao.trim();
  const obsValida = canal !== "outro" || (obs.length >= 10 && obs.length <= 500);
  const diaValido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= hoje;
  const prazoVencido = diaValido && somaDias(dia, PRAZO_DO_PEDIDO_MANUAL[tipo]) < hoje;
  const semEmail = tipo === "data_request" && !canais.email;
  const podeSalvar = !criar.isPending && diaValido && obsValida && !tiposAbertos.includes(tipo);

  function reiniciar() {
    setTipo(primeiroTipoLivre(tiposAbertos));
    setDia(hojeLocal());
    setCanal(canaisVisiveis[0]);
    setObservacao("");
    setPrazoExistente(null);
  }

  function mudarAbertura(v: boolean) {
    if (!v) reiniciar();
    onOpenChange(v);
  }

  function salvar() {
    setPrazoExistente(null);
    criar.mutate(
      {
        contact_id: contactId,
        request_type: tipo,
        received_at: dia,
        canal,
        ...(obs ? { observacao: obs } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t("Pedido registrado; os admins foram avisados."));
          mudarAbertura(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === "pedido_aberto") {
            const prazo = prazoEmBr(
              typeof err.details?.due_at === "string" ? err.details.due_at : null,
            );
            setPrazoExistente(prazo ?? "—");
            return;
          }
          showApiError(err);
        },
      },
    );
  }

  const rotuloDoTipo: Record<TipoDoPedidoManual, string> = {
    data_request: t('Acesso — "o que vocês guardam sobre mim"'),
    redact: t('Exclusão — "apaguem os meus dados"'),
  };
  const rotuloDoCanal: Record<CanalDoPedido, string> = {
    whatsapp_registrado: t("Pelo número de WhatsApp cadastrado"),
    email_registrado: t("Pelo e-mail cadastrado"),
    outro: t("Por outro meio"),
  };

  return (
    <Dialog open={open} onOpenChange={mudarAbertura}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Registrar pedido do titular")}</DialogTitle>
          <DialogDescription>
            {t(
              "Um admin aprova o pedido; o relatório só é preparado depois disso. A exclusão também só acontece depois da aprovação.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("Tipo")}</legend>
            {TIPOS.map((valor) => (
              <label key={valor} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`tipo-${idDia}`}
                  value={valor}
                  checked={tipo === valor}
                  disabled={tiposAbertos.includes(valor)}
                  onChange={() => setTipo(valor)}
                />
                {rotuloDoTipo[valor]}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor={idDia}>{t("Dia em que chegou")}</Label>
            <input
              id={idDia}
              type="date"
              className="h-11 w-full lg:h-9 max-w-xs rounded-md border bg-background px-2 text-sm"
              value={dia}
              max={hoje}
              onChange={(e) => setDia(e.target.value)}
            />
            {prazoVencido && (
              <p role="alert" className="text-sm text-warning-fg">
                {t("O prazo deste pedido já passou; avise um admin agora.")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={idCanal}>{t("Como chegou")}</Label>
            <select
              id={idCanal}
              className="h-11 w-full lg:h-9 rounded-md border bg-background px-2 text-sm"
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalDoPedido)}
            >
              {canaisVisiveis.map((valor) => (
                <option key={valor} value={valor}>
                  {rotuloDoCanal[valor]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor={idObs}>{t("Observação")}</Label>
            <Textarea
              id={idObs}
              value={observacao}
              maxLength={500}
              onChange={(e) => setObservacao(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("Obrigatória quando chegou por outro meio (10 a 500 caracteres).")}
            </p>
          </div>

          {semEmail && (
            <p className="text-sm text-muted-foreground">
              {t(
                "Este contato não tem e-mail cadastrado. Quando o relatório ficar pronto, um admin baixa e entrega.",
              )}
            </p>
          )}

          {prazoExistente && (
            <p role="alert" className="text-sm text-error-fg">
              {t("Já existe um pedido aberto deste tipo — prazo {data}").replace(
                "{data}",
                () => prazoExistente,
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => mudarAbertura(false)}>
            {t("Cancelar")}
          </Button>
          <Button disabled={!podeSalvar} onClick={salvar}>
            {t("Registrar pedido")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
