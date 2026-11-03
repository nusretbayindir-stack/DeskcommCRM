-- manifest: Cobrança em euro (S4 do fork): cobranca_planos aceita moeda EUR (só com a Stripe), com IVA percentual, implantação de taxa única e cota mensal de respostas do assistente (só exibida, não limita); fn_respostas_do_assistente_no_mes conta, no mês do fuso da org, as respostas da IA a uma mensagem recebida. Plano em BRL e o Asaas não mudam.
--
-- Numeração da faixa do fork (7xxx): o upstream usa 07xx–08xx e 90xx.
--
-- A regra "IVA e implantação só em euro" mora aqui (cobranca_planos_extras_so_em_euro)
-- e em lib/schemas/cobranca-plano.ts (extraForaDoEuro). `respostas_mes` vale nas duas
-- moedas: é a cota que a aba Clientes compara com fn_respostas_do_assistente_no_mes.

-- ── A. moeda: BRL e EUR ─────────────────────────────────────────────────────
-- Mesmo nome do CHECK da 0583 (lido no banco real), escrito como `= any (array[...])`
-- para tests/invariants/vocabulario-banco-x-typescript.test.ts o ler como definição.
alter table public.cobranca_planos drop constraint if exists cobranca_planos_moeda_check;
alter table public.cobranca_planos
  add constraint cobranca_planos_moeda_check check (moeda = any (array['BRL'::text, 'EUR'::text]));

-- ── B. IVA, implantação e cota de respostas ─────────────────────────────────
alter table public.cobranca_planos
  add column if not exists iva_percentual numeric(5,2) not null default 0,
  add column if not exists implantacao_cents bigint,
  add column if not exists respostas_mes integer;

alter table public.cobranca_planos drop constraint if exists cobranca_planos_iva_check;
alter table public.cobranca_planos
  add constraint cobranca_planos_iva_check check (iva_percentual between 0 and 100);

alter table public.cobranca_planos drop constraint if exists cobranca_planos_implantacao_check;
alter table public.cobranca_planos
  add constraint cobranca_planos_implantacao_check check (implantacao_cents is null or implantacao_cents >= 500);

alter table public.cobranca_planos drop constraint if exists cobranca_planos_respostas_check;
alter table public.cobranca_planos
  add constraint cobranca_planos_respostas_check check (respostas_mes is null or respostas_mes >= 1);

alter table public.cobranca_planos drop constraint if exists cobranca_planos_extras_so_em_euro;
alter table public.cobranca_planos
  add constraint cobranca_planos_extras_so_em_euro check (moeda = 'EUR' or (iva_percentual = 0 and implantacao_cents is null));

comment on table public.cobranca_planos is
  'Planos que o dono da instalação vende às empresas dela (migration 0583; euro na 7001). Da INSTALAÇÃO, sem organization_id: RLS ligada sem policy, só o service_role. Limite nulo = sem limite. preco_cents >= 500 (centavos da moeda do plano); moeda BRL ou EUR (EUR só com a Stripe); iva_percentual e implantacao_cents só em EUR; respostas_mes é a cota exibida na aba Clientes, não limite; teto_ia_usd_cents na moeda de fn_gasto_de_ia_do_mes.';

-- ── C. respostas do assistente no mês ───────────────────────────────────────
-- O índice que serve o contador é o da 0133 (fn_atrito_metrics), mesmo nome e
-- mesmas colunas: na cadeia ele já existe (no-op); o baseline não o tinha, então
-- quem só aplica o baseline o ganha aqui. Sem CONCURRENTLY, como a 0585: o runner
-- envolve a migration em transação, e a criação trava escrita em `messages` pelo
-- tempo de construir o índice.
create index if not exists idx_messages_org_direction_sent
  on public.messages (organization_id, direction, sent_at);

-- Uma resposta = uma mensagem da IA (sent_via 'ai', outbound) cuja anterior NA MESMA
-- conversa é recebida: várias mensagens do cliente seguidas de várias da IA contam
-- uma; o follow-up da IA depois de outra mensagem da IA e a resposta humana não
-- contam (contrato, anexo 1). A hora é `sent_at` (a da mensagem, que o histórico
-- importado preserva; `created_at` é a da linha) e o filtro é o do índice acima:
-- organização, direção e sent_at. O mês é o do fuso da org; a janela abre 7 dias
-- antes para a 1ª resposta do mês enxergar a mensagem recebida no fim do mês
-- anterior — uma resposta cuja recebida é mais velha que isso não conta.
create or replace function public.fn_respostas_do_assistente_no_mes(p_org uuid, p_agora timestamptz default now())
returns integer language sql stable security definer set search_path = public as $$
  with tz as (select coalesce(nullif(o.timezone, ''), 'UTC') as z from public.organizations o where o.id = p_org),
  j as (select date_trunc('month', p_agora at time zone z) at time zone z as desde,
               (date_trunc('month', p_agora at time zone z) + interval '1 month') at time zone z as ate from tz),
  s as (select m.sent_via, m.direction, m.sent_at,
               lag(m.direction) over (partition by m.conversation_id order by m.sent_at, m.id) as anterior
          from public.messages m, j
         where m.organization_id = p_org and m.direction in ('inbound', 'outbound')
           and m.sent_at >= j.desde - interval '7 days' and m.sent_at < j.ate)
  select count(*)::int from s, j
   where s.sent_via = 'ai' and s.direction = 'outbound' and s.anterior = 'inbound' and s.sent_at >= j.desde;
$$;

comment on function public.fn_respostas_do_assistente_no_mes(uuid, timestamptz) is
  'Respostas do assistente da org no mês (fuso da org) de p_agora: mensagens da IA cuja anterior na conversa é recebida. Só exibição (aba Clientes da cobrança, migration 7001); não limita nada. Só o service_role executa.';

revoke execute on function public.fn_respostas_do_assistente_no_mes(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_respostas_do_assistente_no_mes(uuid, timestamptz) to service_role;
