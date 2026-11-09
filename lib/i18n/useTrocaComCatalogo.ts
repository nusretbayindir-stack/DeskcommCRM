import { useCallback, useEffect, useRef } from "react";

import { carregarCatalogo, catalogoCarregado } from "@/lib/i18n/catalogos";
import type { Idioma } from "./idiomas";

/**
 * A TROCA DE IDIOMA SÓ PINTA COM O TEXTO NA MÃO.
 *
 * Quem usa: o `IdiomaProvider` (o seletor do topo) e a página de erro global,
 * que roda sem provider. A regra é a mesma para os dois e mora aqui uma vez.
 *
 * - Texto na mão (português, espanhol, catálogo já baixado): pinta na hora.
 *   Esperar uma volta do microtask sem motivo atrasa o clique e quem lê a tela
 *   logo depois dele.
 * - Senão baixa, e pinta só se o catálogo CHEGOU. Se falhou (a aba é de antes
 *   de um deploy e o arquivo sumiu), a tela fica no idioma em que está — nunca
 *   no português de passagem — e o leitor já deixou o motivo no console. O
 *   pedido seguinte do mesmo idioma tenta de novo.
 * - O ÚLTIMO pedido vence: voltar ao espanhol antes de o turco chegar não é
 *   desfeito quando ele chega (o seletor faz isso quando o servidor recusa).
 * - Pedir o idioma que já está na tela não baixa nada. Sem catálogo, isso só
 *   acontece quando ele falhou na primeira carga (a tela abriu em português);
 *   a reconciliação com o servidor ao montar não repete a falha.
 */
export function useTrocaComCatalogo(
  naTela: Idioma,
  pintar: (idioma: Idioma) => void,
): (novo: Idioma) => void {
  const ultimoPedido = useRef(0);
  const atual = useRef(naTela);
  useEffect(() => {
    atual.current = naTela;
  }, [naTela]);

  return useCallback(
    (novo: Idioma) => {
      const pedido = ++ultimoPedido.current;
      if (catalogoCarregado(novo)) {
        pintar(novo);
        return;
      }
      if (novo === atual.current) return;
      void carregarCatalogo(novo).then(() => {
        if (ultimoPedido.current === pedido && catalogoCarregado(novo)) pintar(novo);
      });
    },
    [pintar],
  );
}
