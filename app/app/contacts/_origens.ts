/**
 * As origens que o filtro da lista de Contatos oferece.
 *
 * Mora fora de `_client.tsx` para ser lida sem subir a tela inteira — e porque
 * a lista depende da instalação: a Nuvemshop só entra com a loja ligada
 * (`env.NUVEMSHOP_ENABLED`, a mesma régua do passo da loja no onboarding). Numa
 * instalação que não a configurou, a opção filtrava por uma origem que nenhum
 * contato pode ter.
 */
export const SOURCE_OPTIONS = [
  { value: undefined, label: "Todas as origens" },
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site (landing page)" },
  { value: "nuvemshop", label: "Nuvemshop" },
  { value: "import_csv", label: "Importado (CSV)" },
  // Os dois valores que a atribuição de anúncio grava em `contacts.source`
  // (`PlataformaDeAnuncio` em lib/leads/atribuicao-de-anuncio.ts). Sem eles, o
  // contato que veio de um clique em anúncio existe no banco e não é
  // alcançável por nenhum filtro desta tela. O handler aceita qualquer valor
  // (`_handler.ts:167` faz `eq("source", q.source)`), então a lista é a única
  // porta — e ela estava incompleta desde que a atribuição passou a existir.
  { value: "meta_ads", label: "Anúncio da Meta" },
  { value: "google_ads", label: "Anúncio do Google" },
];

export function origensDoFiltro(lojaLigada: boolean): typeof SOURCE_OPTIONS {
  return lojaLigada ? SOURCE_OPTIONS : SOURCE_OPTIONS.filter((origem) => origem.value !== "nuvemshop");
}
