import type { GrupoDaInstalacao } from "@/lib/instalacao/catalogo";

/**
 * A ordem dos grupos é a ordem em que a instalação DÓI, não a alfabética.
 *
 * E-mail primeiro porque é o que falta em toda instalação nova — sem ele não sai
 * convite para a equipe nem recuperação de senha, e a pessoa descobre isso
 * quando já precisava. Depois o que ela pode querer conferir; por último o que
 * ela não troca aqui, que é referência e não tarefa.
 *
 * Mora fora de `page.tsx` porque o arquivo de página só pode exportar o que o
 * Next conhece, e `tests/unit/catalogo-de-dados-tem-o-idioma-do-catalogo`
 * precisa ler estes textos: eles chegam à tela por `t(g.titulo)`, nunca como
 * literal num `t()`.
 */
export const GRUPOS_DA_TELA: readonly {
  grupo: GrupoDaInstalacao;
  titulo: string;
  resumo: string;
  ponteiro?: { href: string; texto: string };
}[] = [
  {
    grupo: "email",
    titulo: "E-mail",
    resumo: "Sem isto o sistema não envia convite para a equipe nem recuperação de senha.",
    ponteiro: {
      href: "/admin/email",
      texto: "O serviço de envio de e-mail — próprio ou externo — fica em E-mail →",
    },
  },
  {
    grupo: "seguranca",
    titulo: "Segurança e privacidade",
    resumo: "Contatos obrigatórios e as chaves que protegem o que está guardado.",
  },
  {
    grupo: "whatsapp",
    titulo: "WhatsApp",
    resumo: "As senhas que ligam o sistema ao programa que conecta o WhatsApp.",
  },
  { grupo: "banco", titulo: "Banco de dados", resumo: "Onde ficam todos os seus dados." },
  { grupo: "fila", titulo: "Fila de tarefas", resumo: "Controla o ritmo dos envios." },
  { grupo: "ia", titulo: "Inteligência artificial", resumo: "Como o atendimento automático opera." },
];
