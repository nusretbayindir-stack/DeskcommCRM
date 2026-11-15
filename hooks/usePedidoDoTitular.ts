"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { randomId } from "@/lib/random-id";
import type { CanalDoPedido, TipoDoPedidoManual } from "@/lib/lgpd/pedido-manual";

/** Um pedido ainda aberto do contato; `due_at` chega cru e a tela formata com `prazoEmBr`. */
export interface PedidoAbertoDoContato {
  request_type: TipoDoPedidoManual;
  status: string;
  due_at: string;
}

export interface PedidosAbertosDoContato {
  pedidos: PedidoAbertoDoContato[];
  canais: { whatsapp: boolean; email: boolean };
}

export interface NovoPedidoDoTitularInput {
  contact_id: string;
  request_type: TipoDoPedidoManual;
  received_at: string;
  canal: CanalDoPedido;
  observacao?: string;
}

/** Pedidos abertos do contato + canais que o cadastro permite. `enabled` evita busca à toa. */
export function usePedidosAbertosDoContato(contactId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pedidos-do-titular", contactId],
    enabled: enabled && !!contactId,
    staleTime: 30_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: PedidosAbertosDoContato }>(
          `/api/v1/lgpd/contacts/${contactId}/open-requests`,
        )
      ).data,
  });
}

/** Registra o pedido; quem chama trata o erro (o 409 `pedido_aberto` é mostrado no diálogo). */
export function useCriarPedidoDoTitular() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovoPedidoDoTitularInput) =>
      apiClient.post<{ data: { id: string; due_at: string } }>("/api/v1/lgpd/requests", input, {
        idempotencyKey: randomId(),
      }),
    onSuccess: (_data, { contact_id }) => {
      void queryClient.invalidateQueries({ queryKey: ["pedidos-do-titular", contact_id] });
      void queryClient.invalidateQueries({ queryKey: ["lgpd-requests"] });
    },
  });
}
