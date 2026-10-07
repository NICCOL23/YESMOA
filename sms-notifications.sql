begin;
create table if not exists yesmoa_private.sms_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 recipient text not null default '' check(recipient='' or recipient ~ '^01[016789][0-9]{7,8}$'),
 live_ready boolean not null default false, updated_at timestamptz not null default now()
);
insert into yesmoa_private.sms_settings(id) values(true) on conflict do nothing;
create table if not exists yesmoa_private.sms_jobs (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 title text not null, recipient text not null, mode text not null check(mode in ('mock','live')),
 status text not null check(status in ('pending','processing','simulated','accepted','failed','unknown','skipped')),
 created_at timestamptz not null default now(), processed_at timestamptz,
 provider_id text, result_code text
);
alter table yesmoa_private.sms_settings enable row level security;
alter table yesmoa_private.sms_jobs enable row level security;
revoke all on yesmoa_private.sms_settings,yesmoa_private.sms_jobs from public,anon,authenticated;

create or replace function public.yesmoa_sms_settings_get() returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings jsonb; logs jsonb;
begin
 if auth.uid() is null or not public.yesmoa_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select jsonb_build_object('enabled',enabled,'recipient',recipient,'live_ready',live_ready) into settings from yesmoa_private.sms_settings where id;
 select coalesce(jsonb_agg(to_jsonb(j)),'[]'::jsonb) into logs from
 (select created_at,status,result_code from yesmoa_private.sms_jobs order by created_at desc limit 20) j;
 return settings || jsonb_build_object('logs',logs);
end $$;
create or replace function public.yesmoa_sms_settings_save(p_recipient text,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare phone text := regexp_replace(coalesce(p_recipient,''),'[[:space:]-]','','g');
begin
 if auth.uid() is null or not public.yesmoa_is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_enabled is null or (phone<>'' and phone !~ '^01[016789][0-9]{7,8}$') or (p_enabled and phone='') then raise exception 'Invalid phone'; end if;
 update yesmoa_private.sms_settings set recipient=phone,enabled=p_enabled,updated_at=now() where id;
 return public.yesmoa_sms_settings_get();
end $$;

create or replace function yesmoa_private.enqueue_sms() returns trigger
language plpgsql security definer set search_path='' as $$
declare s yesmoa_private.sms_settings%rowtype;
begin
 if new.yesmoa_id is null or new.yesmoa_title is null then return new; end if;
 select * into s from yesmoa_private.sms_settings where id;
 insert into yesmoa_private.sms_jobs(request_id,title,recipient,mode,status,result_code)
 values(new.yesmoa_id,left(new.yesmoa_title,150),s.recipient,case when s.live_ready then 'live' else 'mock' end,
 case when s.enabled and s.recipient<>'' then case when s.live_ready then 'pending' else 'simulated' end else 'skipped' end,
 case when not s.enabled or s.recipient='' then 'ALERT_DISABLED' when not s.live_ready then 'MOCK_NO_SMS' else null end)
 on conflict(request_id) do nothing;
 return new;
exception when others then
 -- Notification infrastructure must never prevent a purchase request from committing.
 raise warning 'YESMOA notification enqueue failed (SQLSTATE %)',SQLSTATE;
 return new;
end $$;
create or replace trigger yesmoa_sms_after_insert after insert on public.requests for each row execute function yesmoa_private.enqueue_sms();

create or replace function public.yesmoa_sms_claim() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service required' using errcode='42501'; end if;
 -- Never retry a potentially accepted external send after a crash or timeout.
 update yesmoa_private.sms_jobs set status='unknown',result_code='WORKER_INTERRUPTED',processed_at=now()
 where status='processing' and processed_at<now()-interval '5 minutes';
 with candidates as (select id from yesmoa_private.sms_jobs where status='pending' order by created_at for update skip locked limit 10),
 claimed as (update yesmoa_private.sms_jobs j set status='processing',processed_at=now() from candidates c where j.id=c.id returning j.id,j.title,j.recipient,j.mode)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
create or replace function public.yesmoa_sms_finish(p_id uuid,p_status text,p_provider_id text default null,p_code text default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service required' using errcode='42501'; end if;
 if p_status not in ('simulated','accepted','failed','unknown') then raise exception 'Invalid status'; end if;
 update yesmoa_private.sms_jobs set status=p_status,processed_at=now(),provider_id=left(p_provider_id,100),result_code=left(p_code,80)
 where id=p_id and status='processing'; return found;
end $$;
revoke all on function public.yesmoa_sms_settings_get(),public.yesmoa_sms_settings_save(text,boolean),public.yesmoa_sms_claim(),public.yesmoa_sms_finish(uuid,text,text,text),yesmoa_private.enqueue_sms() from public,anon,authenticated;
grant execute on function public.yesmoa_sms_settings_get(),public.yesmoa_sms_settings_save(text,boolean) to authenticated;
grant execute on function public.yesmoa_sms_claim(),public.yesmoa_sms_finish(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
