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
  {
    grupo: "ia",
    titulo: "Inteligência artificial",
    resumo: "Como o atendimento automático opera.",
    // A IA com que as empresas NOVAS nascem (migration 9096) é uma coluna de
    // `platform_settings`, e quem a grava é Recursos opcionais — mas é aqui,
    // na tela que se chama "Configuração da instalação", que quem procura
    // "configurar a IA das empresas" chega primeiro. Mesmo motivo do ponteiro
    // do e-mail, logo acima.
    ponteiro: {
      href: "/admin/sistema#molde-de-ia",
      texto: "A IA com que as empresas novas nascem se escolhe em Recursos opcionais →",
    },
  },
];
