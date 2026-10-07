begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create or replace function yesmoa_private.dispatch_sms() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text; gateway_jwt text; request_id bigint;
begin
 if not exists(select 1 from yesmoa_private.sms_settings where id and live_ready) then return null; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='yesmoa_sms_worker_token' limit 1;
 select decrypted_secret into gateway_jwt from vault.decrypted_secrets where name='yesmoa_sms_gateway_jwt' limit 1;
 if token is null or gateway_jwt is null then return null; end if;
 select net.http_post(
  url:='https://rkjifgvzmetzdnawehnt.supabase.co/functions/v1/sms-notifications',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_jwt,'x-sms-worker-token',token),
  body:='{}'::jsonb,timeout_milliseconds:=10000
 ) into request_id;
 return request_id;
end $$;
revoke all on function yesmoa_private.dispatch_sms() from public,anon,authenticated;
select cron.schedule('yesmoa-sms-notifications','* * * * *','select yesmoa_private.dispatch_sms();');
commit;
select jobname,schedule,active from cron.job where jobname='yesmoa-sms-notifications';
