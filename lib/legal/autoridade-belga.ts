/**
 * A autoridade belga de proteção de dados em FRANCÊS.
 *
 * O perfil do país (`lib/legal/perfil-do-pais.ts`) traz o nome neerlandês,
 * "Gegevensbeschermingsautoriteit (GBA)". Quem lê em francês a conhece por este
 * nome e por este site: a política de privacidade em francês
 * (`lib/legal/politica-belga.ts`) e o relatório de acesso em francês
 * (`lib/lgpd/idioma-do-documento.ts`, S2a Task 13) usam a mesma constante.
 *
 * Arquivo próprio porque `politica-belga.ts` importa `next/headers`, e o worker
 * que desenha o relatório não pode carregar isso.
 */
export const AUTORIDADE_EM_FRANCES = {
  nome: "Autorité de protection des données (APD)",
  site: "https://www.autoriteprotectiondonnees.be",
};
