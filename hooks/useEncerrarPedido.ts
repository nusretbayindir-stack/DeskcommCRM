"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiClient } from "@/lib/api/client";
import type { encerramentoSchema } from "@/lib/lgpd/encerramento";

export interface EncerrarPedidoInput {
  id: string;
  corpo: z.infer<typeof encerramentoSchema>;
  /** Manda antes o aviso de recusa do art. 12.º por e-mail (a nota é o motivo escrito). */
  avisarPorEmail: boolean;
}

/**
 * Encerra o pedido do titular (U53): "entregue manualmente" ou "encerrado com motivo".
 *
 * Com `avisarPorEmail`, o aviso de recusa sai ANTES: se o envio falhar, o erro
 * sobe e o pedido NÃO é encerrado (a equipe tenta de novo, sem pedido fechado
 * e titular sem aviso). O `/art12` é idempotente pela própria linha — um aviso
 * já enviado volta 200 com `duplicate: true` e o encerramento segue.
 * Nenhuma das duas rotas pede Idempotency-Key.
 */
export function useEncerrarPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, corpo, avisarPorEmail }: EncerrarPedidoInput) => {
      if (avisarPorEmail) {
        await apiClient.post(`/api/v1/lgpd/requests/${id}/art12`, {
          kind: "refusal",
          reason: corpo.nota ?? "",
        });
      }
      return apiClient.post<{ data: { request_id: string; status: string } }>(
        `/api/v1/lgpd/requests/${id}/encerrar`,
        corpo,
      );
    },
    // Também no erro: um 409 quer dizer que o pedido mudou por outra mão, e a
    // tela precisa reler o estado em vez de insistir num botão que já não vale.
    onSettled: (_data, _erro, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["lgpd-request", id] });
      void queryClient.invalidateQueries({ queryKey: ["lgpd-requests"] });
    },
  });
}
