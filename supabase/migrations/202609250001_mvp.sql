begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.app_members (
  user_id uuid primary key references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_members enable row level security;
create policy own_membership on public.app_members for select to authenticated using (user_id = (select auth.uid()));
create function public.is_app_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_members where user_id = auth.uid() and active);
$$;
revoke all on function public.is_app_member() from public, anon;
grant execute on function public.is_app_member() to authenticated;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null check (length(name) between 1 and 120),
  target text not null check (length(target) between 1 and 200),
  location text not null check (length(location) between 1 and 160),
  objective text not null default '' check (length(objective) <= 1000),
  scope text not null default 'PJ' check (scope = 'PJ'),
  rules_version text not null default 'mvp-manual-review-v1',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.source_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  campaign_id uuid not null,
  source text not null check (source in ('manual','google_maps')),
  status text not null default 'CREATED',
  input_json jsonb not null default '{}',
  actor_id text, actor_build_id text, apify_run_id text unique, dataset_id text,
  item_count integer not null default 0,
  invalid_count integer not null default 0,
  duplicate_count integer not null default 0,
  usage_usd numeric,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id,user_id),
  foreign key (campaign_id,user_id) references public.campaigns(id,user_id)
);
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  identity_key text not null,
  name text not null,
  source text not null,
  source_id text, source_url text, website text, domain text, phone text,
  city text, address text, sector text, cnpj text, cnae text,
  qualification text not null default 'REVISÃO MANUAL' check (qualification in ('REVISÃO MANUAL','QUALIFICADO','NÃO QUALIFICADO')),
  stage text not null default 'NOVO' check (stage in ('NOVO','PESQUISA','CONTATO','ACOMPANHAMENTO','SUPRIMIDO')),
  review_reason text, evidence_url text,
  next_action text, due_at timestamptz,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id,identity_key), unique(id,user_id)
);
create table public.campaign_prospects (
  user_id uuid not null,
  campaign_id uuid not null,
  prospect_id uuid not null,
  primary key(campaign_id,prospect_id),
  foreign key(campaign_id,user_id) references public.campaigns(id,user_id),
  foreign key(prospect_id,user_id) references public.prospects(id,user_id)
);
create table public.raw_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_run_id uuid not null,
  row_index integer not null,
  source text not null,
  payload jsonb not null,
  sha256 text not null,
  observed_at timestamptz not null default now(),
  prospect_id uuid,
  error text,
  unique(source_run_id,row_index),
  foreign key(source_run_id,user_id) references public.source_runs(id,user_id),
  foreign key(prospect_id,user_id) references public.prospects(id,user_id)
);
create table public.prospect_events (
  id uuid primary key,
  user_id uuid not null,
  prospect_id uuid not null,
  kind text not null,
  detail jsonb not null,
  rules_version text not null default 'mvp-manual-review-v1',
  created_at timestamptz not null default now(),
  foreign key(prospect_id,user_id) references public.prospects(id,user_id)
);
create index campaigns_user_idx on public.campaigns(user_id,created_at desc);
create index prospects_user_idx on public.prospects(user_id,created_at desc);
create index runs_user_idx on public.source_runs(user_id,created_at desc);
create index raw_prospect_idx on public.raw_records(user_id,prospect_id);
create index events_prospect_idx on public.prospect_events(user_id,prospect_id,created_at desc);
create index links_user_idx on public.campaign_prospects(user_id);

do $$ declare t text; begin
  foreach t in array array['campaigns','source_runs','prospects','campaign_prospects','raw_records','prospect_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_read on public.%I for select to authenticated using (user_id = (select auth.uid()) and (select public.is_app_member()))', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
revoke all on public.app_members from anon, authenticated;
grant select on public.app_members to authenticated;
grant insert on public.campaigns,public.source_runs to authenticated;
grant update on public.source_runs to authenticated;
create policy owner_create on public.campaigns for insert to authenticated with check(user_id = (select auth.uid()) and (select public.is_app_member()));
create policy owner_create on public.source_runs for insert to authenticated with check(user_id = (select auth.uid()) and (select public.is_app_member()));
create policy owner_update on public.source_runs for update to authenticated using(user_id = (select auth.uid()) and (select public.is_app_member())) with check(user_id = (select auth.uid()) and (select public.is_app_member()));

create function public.ingest_batch(p_campaign uuid,p_batch uuid,p_source text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); run public.source_runs; item jsonb; c jsonb;
  idx integer := 0; invalids integer := 0; duplicates integer := 0; pid uuid;
  identity text; bad text; inserted_count integer;
begin
  if uid is null or not public.is_app_member() then raise exception 'SD: Acesso não autorizado.'; end if;
  if not exists(select 1 from public.campaigns where id=p_campaign and user_id=uid) then raise exception 'SD: Campanha não encontrada.'; end if;
  if p_source not in ('manual','google_maps') or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text) > 2000000 then raise exception 'SD: Lote inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into run from public.source_runs where id=p_batch for update;
  if found then
    if run.user_id <> uid or run.campaign_id <> p_campaign or run.source <> p_source then raise exception 'SD: Lote incompatível.'; end if;
    if run.status='IMPORTED' then return jsonb_build_object('id',run.id,'item_count',run.item_count,'invalid_count',run.invalid_count,'duplicate_count',run.duplicate_count,'replayed',true); end if;
  else
    insert into public.source_runs(id,user_id,campaign_id,source,status) values(p_batch,uid,p_campaign,p_source,'IMPORTING');
  end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    c := item->'canonical'; pid := null; bad := item->>'error';
    if jsonb_typeof(c) is distinct from 'object' or coalesce(length(trim(c->>'name')),0)=0 then bad := coalesce(bad,'Nome da empresa ausente.'); end if;
    if bad is null then
      identity := case when coalesce(c->>'source_id','')<>'' then p_source || ':' || (c->>'source_id') else 'row:' || p_batch::text || ':' || idx::text end;
      insert into public.prospects(user_id,identity_key,name,source,source_id,source_url,website,domain,phone,city,address,sector,cnpj,cnae)
      values(uid,identity,left(c->>'name',2000),p_source,c->>'source_id',c->>'source_url',c->>'website',c->>'domain',c->>'phone',c->>'city',c->>'address',c->>'sector',c->>'cnpj',c->>'cnae')
      on conflict(user_id,identity_key) do nothing returning id into pid;
      get diagnostics inserted_count = row_count;
      if inserted_count=0 then
        select id into pid from public.prospects where user_id=uid and identity_key=identity;
        duplicates := duplicates+1;
      end if;
      insert into public.campaign_prospects(user_id,campaign_id,prospect_id) values(uid,p_campaign,pid) on conflict do nothing;
    else invalids := invalids+1;
    end if;
    insert into public.raw_records(user_id,source_run_id,row_index,source,payload,sha256,prospect_id,error)
    values(uid,p_batch,idx,p_source,coalesce(item->'raw','null'::jsonb),encode(extensions.digest(convert_to(coalesce(item->'raw','null'::jsonb)::text,'UTF8'),'sha256'),'hex'),pid,bad);
    idx := idx+1;
  end loop;
  update public.source_runs set status='IMPORTED',item_count=idx,invalid_count=invalids,duplicate_count=duplicates,finished_at=now() where id=p_batch;
  return jsonb_build_object('id',p_batch,'item_count',idx,'invalid_count',invalids,'duplicate_count',duplicates);
end $$;
revoke all on function public.ingest_batch(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.ingest_batch(uuid,uuid,text,jsonb) to authenticated;

create function public.record_prospect_event(p_id uuid,p_event uuid,p_version integer,p_kind text,p_detail jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p public.prospects; previous public.prospect_events;
begin
  if uid is null or not public.is_app_member() then raise exception 'SD: Acesso não autorizado.'; end if;
  select * into p from public.prospects where id=p_id and user_id=uid for update;
  if not found then raise exception 'SD: Prospect não encontrado.'; end if;
  select * into previous from public.prospect_events where id=p_event;
  if found then
    if previous.user_id<>uid or previous.prospect_id<>p_id or previous.kind<>p_kind or previous.detail<>p_detail then raise exception 'SD: Identificador de evento já utilizado.'; end if;
    return to_jsonb(p);
  end if;
  if p.version<>p_version then raise exception 'SD: A ficha mudou. Atualize antes de salvar.'; end if;
  if p_kind not in ('review','note','stage') or coalesce(length(trim(p_detail->>'reason')),0) not between 1 and 2000 then raise exception 'SD: Informe uma justificativa de até 2000 caracteres.'; end if;
  if p_kind='review' then
    if coalesce(p_detail->>'qualification','') not in ('REVISÃO MANUAL','QUALIFICADO','NÃO QUALIFICADO') or coalesce(p_detail->>'evidence_url','') !~ '^https?://' then raise exception 'SD: Qualificação e referência obrigatórias.'; end if;
    update public.prospects set qualification=p_detail->>'qualification',review_reason=p_detail->>'reason',evidence_url=p_detail->>'evidence_url' where id=p_id;
  elsif p_kind='stage' then
    if coalesce(p_detail->>'stage','') not in ('NOVO','PESQUISA','CONTATO','ACOMPANHAMENTO','SUPRIMIDO') then raise exception 'SD: Etapa inválida.'; end if;
    if p.stage='SUPRIMIDO' and p_detail->>'stage'<>'SUPRIMIDO' then raise exception 'SD: Supressão ativa. Reativação requer revisão administrativa.'; end if;
    if p_detail->>'stage' in ('CONTATO','ACOMPANHAMENTO') and p.qualification<>'QUALIFICADO' then raise exception 'SD: Revise a qualificação da conta antes de registrar o contato.'; end if;
    if p_detail->>'stage'='ACOMPANHAMENTO' and (coalesce(trim(p_detail->>'next_action'),'')='' or p_detail->>'due_at' is null) then raise exception 'SD: Próxima ação e prazo obrigatórios.'; end if;
    update public.prospects set stage=p_detail->>'stage',next_action=case when p_detail->>'stage'='SUPRIMIDO' then null else nullif(p_detail->>'next_action','') end,due_at=case when p_detail->>'stage'='SUPRIMIDO' then null else (p_detail->>'due_at')::timestamptz end where id=p_id;
  end if;
  insert into public.prospect_events(id,user_id,prospect_id,kind,detail) values(p_event,uid,p_id,p_kind,p_detail);
  update public.prospects set version=version+1 where id=p_id returning * into p;
  return to_jsonb(p);
end $$;
revoke all on function public.record_prospect_event(uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.record_prospect_event(uuid,uuid,integer,text,jsonb) to authenticated;
commit;
