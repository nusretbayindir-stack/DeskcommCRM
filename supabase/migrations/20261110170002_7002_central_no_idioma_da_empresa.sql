-- manifest: Avisos que funções do banco gravam na Central saem no idioma da empresa (S2a U14 do fork): o gatilho trg_central_no_idioma_da_empresa (before insert or update of title, body em agent_inbox_items) troca o texto em português conhecido de funções do upstream (fn_followup_inline_settle, fn_routing_unassigned_notice, fn_meet_notice, fn_appointment_confirmation_sweep, fn_reativar_organizacao, fn_appointment_recover, fn_agent_legacy_published e a anonimização de avisos) pelo do idioma visível da organização; as funções não mudam, e idioma escondido ou sem tradução fica em português.
--
-- Numeração da faixa do fork (7xxx): o upstream usa 07xx–08xx e 90xx.
--
-- Por que um gatilho, e não reescrever as funções: a cópia do corpo de cada
-- uma ficaria no fork, e a cada sincronização ou ela apagaria uma correção do
-- upstream (create or replace com o corpo velho), ou a do upstream apagaria a
-- tradução sem ninguém ver. O gatilho reconhece o texto que elas escrevem, e
-- tests/unit/avisos-do-banco-no-idioma.test.ts fica vermelho quando o upstream
-- muda um desses textos ou quando uma função nova passa a gravar texto na
-- Central (insert, update de title/body com literal, ou chamada a
-- fn_agent_legacy_notice com texto fixo).
--
-- Os padrões são gerados de lib/ai/avisos-do-banco.ts e do catálogo
-- (scripts/i18n/padroes-dos-avisos-do-banco.ts): por idioma, [padrão,
-- substituição, flags] do regexp_replace, aplicados NA ORDEM do array (with
-- ordinality) ao título e ao corpo. Padrão com ^…$ casa o campo inteiro; sem
-- âncora, troca a frase onde ela estiver (o corpo da reativação junta até
-- três). O pedaço que vem do banco (título do compromisso, erro do job,
-- contagem) passa cru.
--
-- Idioma: organizations.locale exato entre os visíveis, como normalizarIdioma.
-- Sem organização, sem idioma ou idioma escondido (nl, fr…) = português.
-- A migration não reescreve aviso nenhum; um aviso antigo só muda quando o
-- próprio título ou corpo é reescrito (on conflict do update, anonimização).
-- Idempotente: create or replace, drop trigger if exists. No baseline, antes da
-- VARREDURA anon: cria função.
-- Prova: tests/invariants/avisos-do-banco-no-idioma.test.ts.

create or replace function public.fn_central_no_idioma_da_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_padroes constant jsonb := $padroes$
{
  "es": [
    ["^O acompanhamento não conseguiu enviar a mensagem$","El seguimiento no pudo enviar el mensaje",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: envio indisponível$","Abre el seguimiento y revisa el canal. Motivo: envío no disponible",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: (.*)$","Abre el seguimiento y revisa el canal. Motivo: \\1",""],
    ["^Uma conversa aguarda um responsável$","Una conversación espera un responsable",""],
    ["^Confira o canal de origem desta conversa nas Conexões\\.$","Revisa el canal de origen de esta conversación en Conexiones.",""],
    ["^Confira os responsáveis do canal em Configurações → Atendimento e a disponibilidade da equipe\\. A distribuição continuará tentando\\.$","Revisa los responsables del canal en Configuración → Atención y la disponibilidad del equipo. La distribución seguirá intentándolo.",""],
    ["^Link da reunião precisa de atenção$","El enlace de la reunión necesita atención",""],
    ["^Abra o compromisso na Agenda para verificar o link ou autorizar uma nova entrega\\.$","Abre la cita en la Agenda para verificar el enlace o autorizar un nuevo envío.",""],
    ["^Presença sem confirmação há mais tempo$","Asistencia sin confirmar desde hace tiempo",""],
    ["^Confirme a presença no compromisso$","Confirma la asistencia a la cita",""],
    ["^Compromisso: (.*)\\. Abra e registre se a pessoa compareceu, faltou ou cancelou\\. O horário sozinho não confirma falta\\.$","Cita: \\1. Ábrela y registra si la persona asistió, faltó o canceló. La hora por sí sola no confirma la ausencia.",""],
    ["^A conta foi reativada — há conversas para revisar$","La cuenta fue reactivada — hay conversaciones para revisar",""],
    ["^A conta foi reativada — há agendamentos e follow-ups para revisar$","La cuenta fue reactivada — hay envíos programados y seguimientos para revisar",""],
    ["1 conversa recebeu mensagem enquanto a conta estava suspensa\\.","1 conversación recibió mensajes mientras la cuenta estaba suspendida.","g"],
    ["([0-9]+) conversas receberam mensagem enquanto a conta estava suspensa\\.","\\1 conversaciones recibieron mensajes mientras la cuenta estaba suspendida.","g"],
    ["1 agendamento de disparo único venceu durante a suspensão e não foi disparado\\.","1 envío programado único venció durante la suspensión y no se envió.","g"],
    ["([0-9]+) agendamentos de disparo único venceram durante a suspensão e não foram disparados\\.","\\1 envíos programados únicos vencieron durante la suspensión y no se enviaron.","g"],
    ["1 passo de follow-up foi descartado durante a suspensão; confira o follow-up do contato\\.","1 paso de seguimiento se descartó durante la suspensión; revisa el seguimiento del contacto.","g"],
    ["([0-9]+) passos de follow-up foram descartados durante a suspensão; confira o follow-up dos contatos\\.","\\1 pasos de seguimiento se descartaron durante la suspensión; revisa el seguimiento de los contactos.","g"],
    ["^A recuperação não foi iniciada$","La recuperación no se inició",""],
    ["^Este contato já tem outro acompanhamento\\. Revise o próximo passo; nenhuma recuperação ficou aguardando vaga\\.$","Este contacto ya tiene otro seguimiento. Revisa el siguiente paso; ninguna recuperación quedó esperando turno.",""],
    ["^Mais de um fluxo atende a esta falta\\. Deixe apenas um configurado ou escolha manualmente o próximo passo\\.$","Más de un flujo atiende esta ausencia. Deja solo uno configurado o elige manualmente el siguiente paso.",""],
    ["^Configure um fluxo de recuperação e habilite-o em um assistente publicado\\. Esta falta não será iniciada retroativamente\\.$","Configura un flujo de recuperación y habilítalo en un asistente publicado. Esta ausencia no se iniciará de forma retroactiva.",""],
    ["^O contexto mudou ou não há contato vinculado\\. Abra o compromisso e escolha o próximo passo\\.$","El contexto cambió o no hay un contacto vinculado. Abre la cita y elige el siguiente paso.",""],
    ["^Agente recuperado$","Se recuperó el agente",""],
    ["^A configuração foi recuperada\\. As respostas usam a versão publicada\\.$","La configuración se recuperó. Las respuestas usan la versión publicada.",""],
    ["^Contato anonimizado\\.$","Contacto anonimizado.",""]
  ],
  "tr": [
    ["^O acompanhamento não conseguiu enviar a mensagem$","Takip mesajı gönderilemedi",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: envio indisponível$","Takip mesajı akışını açın ve kanalı kontrol edin. Neden: gönderim yapılamıyor",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: (.*)$","Takip mesajı akışını açın ve kanalı kontrol edin. Neden: \\1",""],
    ["^Uma conversa aguarda um responsável$","Bir konuşma sorumlu bekliyor",""],
    ["^Confira o canal de origem desta conversa nas Conexões\\.$","Bu konuşmanın geldiği kanalı Bağlantılar bölümünde kontrol edin.",""],
    ["^Confira os responsáveis do canal em Configurações → Atendimento e a disponibilidade da equipe\\. A distribuição continuará tentando\\.$","Kanalın sorumlularını Ayarlar → Görüşme bölümünde, ekibin müsaitliğini de kontrol edin. Dağıtım denemeye devam edecek.",""],
    ["^Link da reunião precisa de atenção$","Toplantı bağlantısının kontrol edilmesi gerekiyor",""],
    ["^Abra o compromisso na Agenda para verificar o link ou autorizar uma nova entrega\\.$","Bağlantıyı kontrol etmek ya da yeniden gönderilmesine izin vermek için randevuyu Takvim'de açın.",""],
    ["^Presença sem confirmação há mais tempo$","Katılım uzun süredir onaylanmadı",""],
    ["^Confirme a presença no compromisso$","Randevuya katılımı onaylayın",""],
    ["^Compromisso: (.*)\\. Abra e registre se a pessoa compareceu, faltou ou cancelou\\. O horário sozinho não confirma falta\\.$","Randevu: \\1. Açın ve kişinin geldiğini, gelmediğini ya da iptal ettiğini kaydedin. Saatin geçmiş olması tek başına gelmediğini göstermez.",""],
    ["^A conta foi reativada — há conversas para revisar$","Hesap yeniden etkinleştirildi — gözden geçirilecek konuşmalar var",""],
    ["^A conta foi reativada — há agendamentos e follow-ups para revisar$","Hesap yeniden etkinleştirildi — gözden geçirilecek planlı gönderimler ve takip mesajları var",""],
    ["1 conversa recebeu mensagem enquanto a conta estava suspensa\\.","Hesap askıdayken 1 konuşmaya mesaj geldi.","g"],
    ["([0-9]+) conversas receberam mensagem enquanto a conta estava suspensa\\.","Hesap askıdayken \\1 konuşmaya mesaj geldi.","g"],
    ["1 agendamento de disparo único venceu durante a suspensão e não foi disparado\\.","Askı sırasında 1 tek seferlik planlı gönderimin zamanı geçti ve gönderilmedi.","g"],
    ["([0-9]+) agendamentos de disparo único venceram durante a suspensão e não foram disparados\\.","Askı sırasında \\1 tek seferlik planlı gönderimin zamanı geçti ve gönderilmedi.","g"],
    ["1 passo de follow-up foi descartado durante a suspensão; confira o follow-up do contato\\.","Askı sırasında 1 takip mesajı adımı atlandı; kişinin takip mesajını kontrol edin.","g"],
    ["([0-9]+) passos de follow-up foram descartados durante a suspensão; confira o follow-up dos contatos\\.","Askı sırasında \\1 takip mesajı adımı atlandı; kişilerin takip mesajlarını kontrol edin.","g"],
    ["^A recuperação não foi iniciada$","Kurtarma başlatılmadı",""],
    ["^Este contato já tem outro acompanhamento\\. Revise o próximo passo; nenhuma recuperação ficou aguardando vaga\\.$","Bu kişinin zaten başka bir takip mesajı akışı var. Sonraki adımı gözden geçirin; sırada bekleyen kurtarma yok.",""],
    ["^Mais de um fluxo atende a esta falta\\. Deixe apenas um configurado ou escolha manualmente o próximo passo\\.$","Bu gelmeme durumu için birden fazla akış var. Yalnızca birini ayarlı bırakın ya da sonraki adımı elle seçin.",""],
    ["^Configure um fluxo de recuperação e habilite-o em um assistente publicado\\. Esta falta não será iniciada retroativamente\\.$","Bir kurtarma akışı ayarlayın ve yayımlanmış bir asistanda etkinleştirin. Bu gelmeme durumu için kurtarma geriye dönük başlatılmaz.",""],
    ["^O contexto mudou ou não há contato vinculado\\. Abra o compromisso e escolha o próximo passo\\.$","Durum değişti ya da bağlı bir kişi yok. Randevuyu açın ve sonraki adımı seçin.",""],
    ["^Agente recuperado$","Asistan kurtarıldı",""],
    ["^A configuração foi recuperada\\. As respostas usam a versão publicada\\.$","Kurulum kurtarıldı. Yanıtlar yayımlanmış sürümü kullanıyor.",""],
    ["^Contato anonimizado\\.$","Kişi anonimleştirildi.",""]
  ]
}
$padroes$;
  v_idioma text;
  v_passo jsonb;
begin
  if new.organization_id is null then
    return new;
  end if;
  select o.locale into v_idioma from public.organizations o where o.id = new.organization_id;
  if v_idioma is null or not (c_padroes ? v_idioma) then
    return new;
  end if;
  for v_passo in
    select p.passo
      from jsonb_array_elements(c_padroes -> v_idioma) with ordinality as p(passo, ordem)
     order by p.ordem
  loop
    new.title := regexp_replace(new.title, v_passo ->> 0, v_passo ->> 1, v_passo ->> 2);
    new.body := regexp_replace(new.body, v_passo ->> 0, v_passo ->> 1, v_passo ->> 2);
  end loop;
  return new;
end;
$$;

alter function public.fn_central_no_idioma_da_empresa() owner to postgres;

revoke all     on function public.fn_central_no_idioma_da_empresa() from public;
revoke execute on function public.fn_central_no_idioma_da_empresa() from anon, authenticated;

drop trigger if exists trg_central_no_idioma_da_empresa on public.agent_inbox_items;
create trigger trg_central_no_idioma_da_empresa
  before insert or update of title, body on public.agent_inbox_items
  for each row execute function public.fn_central_no_idioma_da_empresa();
