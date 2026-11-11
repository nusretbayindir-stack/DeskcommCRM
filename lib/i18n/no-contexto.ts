/**
 * A MESMA FRASE EM PORTUGUÊS, SENTIDOS DIFERENTES NOUTRA LÍNGUA.
 *
 * O catálogo é indexado pela frase portuguesa, e às vezes uma frase só serve a
 * duas telas que outra língua separa. "Salvar plano" é a formule do faturamento
 * e o plano de tarefas em francês; "Atendimento" é o grupo do menu
 * ("Conversations") e a aba de Equipe ("Prise en charge"); "Autenticação" é a
 * categoria de modelo do Meta ("Verificatie" em neerlandês) e a autenticação do
 * servidor MCP.
 *
 * A chave com contexto é a frase seguida de `@@<contexto>` (letras minúsculas,
 * dígitos e hífen, no fim): `t("Salvar plano@@tarefas")`. `traduzir` dá ao
 * português a frase, letra por letra, e às outras línguas a entrada própria do
 * contexto, ou, sem ela, a tradução da frase. Só a língua que precisa separar
 * escreve a entrada com contexto no catálogo; o espanhol e o turco seguem como
 * estavam.
 *
 * Doc S2a, Task 7. Sem dependência de nada: `dicionario.ts` importa daqui.
 */
const CONTEXTO = /@@[a-z0-9-]+$/;

/** A frase sem o contexto; a chave sem contexto volta como está. */
export function semContexto(chave: string): string {
  return chave.includes("@@") ? chave.replace(CONTEXTO, "") : chave;
}
