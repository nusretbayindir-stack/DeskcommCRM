"use client";
import { useState } from "react";

import { NovoPedidoDoTitularDialog } from "@/components/contacts/NovoPedidoDoTitularDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/hooks/i18n/useT";
import { usePedidosAbertosDoContato } from "@/hooks/usePedidoDoTitular";
import { prazoEmBr } from "@/lib/lgpd/sla";

interface Props {
  contactId: string;
}

/**
 * Cartão "Pedido do titular" da ficha (U53): mostra os pedidos abertos deste
 * contato, com o prazo, e o botão que registra um novo. Só aparece para quem o
 * servidor deixa ver a ficha; o gate de papel e de contato anonimizado fica na
 * ficha, que decide se monta o cartão.
 */
export function CartaoDoPedidoDoTitular({ contactId }: Props) {
  const t = useT();
  const abertos = usePedidosAbertosDoContato(contactId, true);
  const [aberto, setAberto] = useState(false);

  const pedidos = abertos.data?.pedidos ?? [];
  const tiposAbertos = pedidos.map((p) => p.request_type);
  const todosAbertos = tiposAbertos.includes("data_request") && tiposAbertos.includes("redact");

  const rotuloDoTipo = { data_request: t("Acesso"), redact: t("Exclusão") } as const;

  return (
    <Card className="p-4" data-testid="pedido-do-titular">
      <h2 className="text-sm font-semibold">{t("Pedido do titular")}</h2>

      {pedidos.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {pedidos.map((p) => (
            <li key={`${p.request_type}-${p.due_at}`}>
              {t("Pedido aberto: {tipo} · prazo {data}")
                .replace("{tipo}", () => rotuloDoTipo[p.request_type])
                .replace("{data}", () => prazoEmBr(p.due_at) ?? "—")}
            </li>
          ))}
        </ul>
      )}

      {abertos.data && !todosAbertos && (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setAberto(true)}>
          {t("Registrar pedido do titular")}
        </Button>
      )}

      {/* Monta só aberto: cada abertura começa do zero, com os tipos abertos de agora. */}
      {abertos.data && aberto && (
        <NovoPedidoDoTitularDialog
          contactId={contactId}
          open={aberto}
          onOpenChange={setAberto}
          canais={abertos.data.canais}
          tiposAbertos={tiposAbertos}
        />
      )}
    </Card>
  );
}
