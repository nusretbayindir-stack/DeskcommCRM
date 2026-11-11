-- manifest: Avisos que funções do banco gravam na Central saem também em neerlandês e em francês (S2a Task 7 do fork): nl e fr ficaram visíveis, e fn_central_no_idioma_da_empresa ganha os padrões dos dois idiomas, gerados do catálogo como os de es e tr. O gatilho trg_central_no_idioma_da_empresa (migration 7002) não muda.
--
-- Numeração da faixa do fork (7xxx): o upstream usa 07xx–08xx e 90xx.
--
-- Só a tabela de padrões muda: saída de scripts/i18n/padroes-dos-avisos-do-banco.ts
-- (lib/ai/avisos-do-banco.ts + catálogos). A 7002 já foi aplicada e não se edita.
-- Idempotente: create or replace. No baseline, logo depois da 7002 e antes da
-- VARREDURA anon. Prova: tests/unit/avisos-do-banco-no-idioma.test.ts (o jsonb
-- da última definição é o que a tabela gera) e tests/invariants/avisos-do-banco-no-idioma.test.ts.

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
  ],
  "nl": [
    ["^O acompanhamento não conseguiu enviar a mensagem$","De opvolging kon het bericht niet verzenden",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: envio indisponível$","Open de opvolging en controleer het kanaal. Reden: verzenden niet beschikbaar",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: (.*)$","Open de opvolging en controleer het kanaal. Reden: \\1",""],
    ["^Uma conversa aguarda um responsável$","Een gesprek wacht op een verantwoordelijke",""],
    ["^Confira o canal de origem desta conversa nas Conexões\\.$","Controleer in Verbindingen via welk kanaal dit gesprek binnenkwam.",""],
    ["^Confira os responsáveis do canal em Configurações → Atendimento e a disponibilidade da equipe\\. A distribuição continuará tentando\\.$","Controleer de verantwoordelijken van het kanaal in Instellingen → Klantcontact en de beschikbaarheid van het team. De verdeling blijft het proberen.",""],
    ["^Link da reunião precisa de atenção$","De link van de vergadering vraagt aandacht",""],
    ["^Abra o compromisso na Agenda para verificar o link ou autorizar uma nova entrega\\.$","Open de afspraak in de Agenda om de link te controleren of een nieuwe verzending toe te staan.",""],
    ["^Presença sem confirmação há mais tempo$","Aanwezigheid al het langst onbevestigd",""],
    ["^Confirme a presença no compromisso$","Bevestig de aanwezigheid bij de afspraak",""],
    ["^Compromisso: (.*)\\. Abra e registre se a pessoa compareceu, faltou ou cancelou\\. O horário sozinho não confirma falta\\.$","Afspraak: \\1. Open de afspraak en registreer of de persoon is opgedaagd, niet is opgedaagd of heeft geannuleerd. Alleen het tijdstip bevestigt geen no-show.",""],
    ["^A conta foi reativada — há conversas para revisar$","Het account is opnieuw geactiveerd — er zijn gesprekken om na te kijken",""],
    ["^A conta foi reativada — há agendamentos e follow-ups para revisar$","Het account is opnieuw geactiveerd — er zijn geplande verzendingen en opvolgberichten om na te kijken",""],
    ["1 conversa recebeu mensagem enquanto a conta estava suspensa\\.","1 gesprek heeft een bericht ontvangen terwijl het account was opgeschort.","g"],
    ["([0-9]+) conversas receberam mensagem enquanto a conta estava suspensa\\.","\\1 gesprekken kregen een bericht terwijl het account was opgeschort.","g"],
    ["1 agendamento de disparo único venceu durante a suspensão e não foi disparado\\.","1 geplande eenmalige verzending is tijdens de opschorting verlopen en werd niet verzonden.","g"],
    ["([0-9]+) agendamentos de disparo único venceram durante a suspensão e não foram disparados\\.","\\1 eenmalige geplande verzendingen zijn tijdens de opschorting verlopen en niet verzonden.","g"],
    ["1 passo de follow-up foi descartado durante a suspensão; confira o follow-up do contato\\.","1 stap van een opvolgbericht is tijdens de opschorting overgeslagen; controleer het opvolgbericht van het contact.","g"],
    ["([0-9]+) passos de follow-up foram descartados durante a suspensão; confira o follow-up dos contatos\\.","\\1 stappen van opvolgberichten zijn tijdens de opschorting weggegooid; controleer de opvolgberichten van de contacten.","g"],
    ["^A recuperação não foi iniciada$","Het herstel is niet gestart",""],
    ["^Este contato já tem outro acompanhamento\\. Revise o próximo passo; nenhuma recuperação ficou aguardando vaga\\.$","Dit contact heeft al een andere opvolging. Bekijk de volgende stap opnieuw; er wacht geen enkel herstel op een plaats.",""],
    ["^Mais de um fluxo atende a esta falta\\. Deixe apenas um configurado ou escolha manualmente o próximo passo\\.$","Meer dan één flow behandelt deze no-show. Laat er maar één ingesteld of kies handmatig de volgende stap.",""],
    ["^Configure um fluxo de recuperação e habilite-o em um assistente publicado\\. Esta falta não será iniciada retroativamente\\.$","Configureer een herstelflow en activeer die in een gepubliceerde assistent. Voor deze no-show wordt het herstel niet met terugwerkende kracht gestart.",""],
    ["^O contexto mudou ou não há contato vinculado\\. Abra o compromisso e escolha o próximo passo\\.$","De context is gewijzigd of er is geen gekoppeld contact. Open de afspraak en kies de volgende stap.",""],
    ["^Agente recuperado$","Assistent hersteld",""],
    ["^A configuração foi recuperada\\. As respostas usam a versão publicada\\.$","De instellingen zijn hersteld. De antwoorden gebruiken de gepubliceerde versie.",""],
    ["^Contato anonimizado\\.$","Contact geanonimiseerd.",""]
  ],
  "fr": [
    ["^O acompanhamento não conseguiu enviar a mensagem$","Le suivi n'a pas pu envoyer le message",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: envio indisponível$","Ouvrez le suivi et vérifiez le canal. Motif : envoi indisponible",""],
    ["^Abra o acompanhamento e confira o canal\\. Motivo: (.*)$","Ouvrez le suivi et vérifiez le canal. Motif : \\1",""],
    ["^Uma conversa aguarda um responsável$","Une conversation attend un responsable",""],
    ["^Confira o canal de origem desta conversa nas Conexões\\.$","Vérifiez le canal d'origine de cette conversation dans Connexions.",""],
    ["^Confira os responsáveis do canal em Configurações → Atendimento e a disponibilidade da equipe\\. A distribuição continuará tentando\\.$","Vérifiez les responsables du canal dans Paramètres → Prise en charge et la disponibilité de l'équipe. La répartition continuera d'essayer.",""],
    ["^Link da reunião precisa de atenção$","Le lien de la réunion demande de l'attention",""],
    ["^Abra o compromisso na Agenda para verificar o link ou autorizar uma nova entrega\\.$","Ouvrez le rendez-vous dans l'Agenda pour vérifier le lien ou autoriser un nouvel envoi.",""],
    ["^Presença sem confirmação há mais tempo$","Présence sans confirmation depuis le plus longtemps",""],
    ["^Confirme a presença no compromisso$","Confirmez la présence au rendez-vous",""],
    ["^Compromisso: (.*)\\. Abra e registre se a pessoa compareceu, faltou ou cancelou\\. O horário sozinho não confirma falta\\.$","Rendez-vous : \\1. Ouvrez-le et indiquez si la personne s'est présentée, ne s'est pas présentée ou a annulé. L'heure à elle seule ne confirme pas une absence.",""],
    ["^A conta foi reativada — há conversas para revisar$","Le compte a été réactivé — des conversations sont à vérifier",""],
    ["^A conta foi reativada — há agendamentos e follow-ups para revisar$","Le compte a été réactivé — des envois programmés et des messages de relance sont à vérifier",""],
    ["1 conversa recebeu mensagem enquanto a conta estava suspensa\\.","1 conversation a reçu un message pendant que le compte était suspendu.","g"],
    ["([0-9]+) conversas receberam mensagem enquanto a conta estava suspensa\\.","\\1 conversations ont reçu un message pendant que le compte était suspendu.","g"],
    ["1 agendamento de disparo único venceu durante a suspensão e não foi disparado\\.","1 envoi programmé unique est arrivé à échéance pendant la suspension et n'a pas été envoyé.","g"],
    ["([0-9]+) agendamentos de disparo único venceram durante a suspensão e não foram disparados\\.","\\1 envois programmés uniques sont arrivés à échéance pendant la suspension et n'ont pas été envoyés.","g"],
    ["1 passo de follow-up foi descartado durante a suspensão; confira o follow-up do contato\\.","1 étape de relance a été abandonnée pendant la suspension ; vérifiez le message de relance du contact.","g"],
    ["([0-9]+) passos de follow-up foram descartados durante a suspensão; confira o follow-up dos contatos\\.","\\1 étapes de relance ont été écartées pendant la suspension ; vérifiez les messages de relance des contacts.","g"],
    ["^A recuperação não foi iniciada$","La récupération n'a pas été lancée",""],
    ["^Este contato já tem outro acompanhamento\\. Revise o próximo passo; nenhuma recuperação ficou aguardando vaga\\.$","Ce contact a déjà un autre suivi. Revoyez l'étape suivante ; aucune récupération n'est restée en attente d'une place.",""],
    ["^Mais de um fluxo atende a esta falta\\. Deixe apenas um configurado ou escolha manualmente o próximo passo\\.$","Plus d'un flux répond à cette absence. N'en laissez qu'un seul configuré ou choisissez manuellement l'étape suivante.",""],
    ["^Configure um fluxo de recuperação e habilite-o em um assistente publicado\\. Esta falta não será iniciada retroativamente\\.$","Configurez un flux de récupération et activez-le dans un assistant publié. Cette absence ne déclenchera pas de récupération rétroactive.",""],
    ["^O contexto mudou ou não há contato vinculado\\. Abra o compromisso e escolha o próximo passo\\.$","Le contexte a changé ou aucun contact n'est lié. Ouvrez le rendez-vous et choisissez la suite.",""],
    ["^Agente recuperado$","Assistant récupéré",""],
    ["^A configuração foi recuperada\\. As respostas usam a versão publicada\\.$","La configuration a été récupérée. Les réponses utilisent la version publiée.",""],
    ["^Contato anonimizado\\.$","Contact anonymisé.",""]
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
