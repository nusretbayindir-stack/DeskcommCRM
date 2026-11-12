/**
 * O idioma do TITULAR para os documentos do pedido (S2a Task 13, D10): o
 * `contacts.locale` dele; sem contato, ou com um idioma que o produto não
 * serve, o da organização. A regra de quais países traduzem mora em
 * `lib/lgpd/idioma-do-documento.ts`.
 *
 * Brasil e Portugal não perguntam nada ao banco: o documento deles é o
 * texto-fonte, e uma leitura a mais no caminho deles mudaria o que os workers
 * leem hoje (os testes do #2342 contam as consultas do worker de anonimização).
 *
 * Nunca lança: as duas leituras reaproveitadas caem no idioma do produto quando
 * falham — e o idioma do produto é o texto-fonte. O documento sai em português,
 * mas sai: atrasar um direito do titular por causa de idioma trocaria o menor
 * problema pelo maior.
 */
import { idiomaDaOrgPeloSupabase } from "@/lib/ai/agents/idioma-da-org";
import { idiomaDoContatoPeloSupabase } from "@/lib/contacts/idioma-do-contato";
import type { Idioma } from "@/lib/i18n/idiomas";
import { idiomaDoDocumento, paisTraduzODocumento } from "@/lib/lgpd/idioma-do-documento";

export interface PedidoDoTitular {
  organizationId: string;
  /** O contato do pedido; `null` quando o pedido não achou contato (só a empresa decide). */
  contactId: string | null | undefined;
  /** O código do país da organização (`perfil.codigo`), já resolvido por quem chama. */
  pais: string | null | undefined;
}

/** O idioma dos documentos do pedido, ou `undefined` para o texto-fonte. */
export async function idiomaDoTitular(admin: unknown, pedido: PedidoDoTitular): Promise<Idioma | undefined> {
  if (!paisTraduzODocumento(pedido.pais)) return undefined;
  const idioma = pedido.contactId
    ? await idiomaDoContatoPeloSupabase(admin, pedido.organizationId, pedido.contactId)
    : await idiomaDaOrgPeloSupabase(admin, pedido.organizationId);
  return idiomaDoDocumento(pedido.pais, idioma);
}
