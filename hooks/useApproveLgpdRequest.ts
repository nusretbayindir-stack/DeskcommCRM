"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { randomId } from "@/lib/random-id";

interface ApproveInput {
  id: string;
  approved_reason: string;
  /** U53: a equipe confirma que mandou o aviso da exclusão pelo WhatsApp (titular sem e-mail). */
  aviso_whatsapp_enviado?: true;
}

interface ApproveResponse {
  data: {
    request_id: string;
    status: "processing";
  };
}

export function useApproveLgpdRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved_reason, aviso_whatsapp_enviado }: ApproveInput) => {
      const idempotencyKey = randomId();
      return apiClient.post<ApproveResponse>(
        `/api/v1/lgpd/requests/${id}/approve`,
        { approved_reason, ...(aviso_whatsapp_enviado ? { aviso_whatsapp_enviado } : {}) },
        { idempotencyKey },
      );
    },
    // Também no erro (U53): um 409/422 quer dizer que o pedido ou o cadastro do
    // contato mudou, e o painel precisa reler o estado em vez de insistir.
    onSettled: (_data, _erro, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["lgpd-request", id] });
      void queryClient.invalidateQueries({ queryKey: ["lgpd-requests"] });
    },
  });
}
