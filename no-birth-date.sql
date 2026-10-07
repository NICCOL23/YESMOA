begin;

create or replace function public.yesmoa_admin_update(p_id uuid, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.yesmoa_is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_data->>'title')),0) not between 1 and 150
    or coalesce(length(trim(p_data->>'author')),0) not between 1 and 100
    or coalesce(length(trim(p_data->>'phone')),0) not between 1 and 100
    or coalesce(length(trim(p_data->>'body')),0) not between 1 and 10000
    or coalesce(p_data->>'category','') not in
      ('직접 방문','직접 발송','택배 방문','출장 매입','데이터 삭제','기타')
    or length(coalesce(p_data->>'bank_name','')) > 100
    or length(coalesce(p_data->>'account_number','')) > 100 then
    raise exception 'Invalid input';
  end if;
  update public.requests
  set yesmoa_title=trim(p_data->>'title'),
      yesmoa_category=p_data->>'category',
      yesmoa_author=trim(p_data->>'author'),
      yesmoa_phone=trim(p_data->>'phone'),
      yesmoa_bank_name=nullif(trim(p_data->>'bank_name'),''),
      yesmoa_account_number=nullif(trim(p_data->>'account_number'),''),
      yesmoa_body=trim(p_data->>'body')
  where yesmoa_id=p_id and yesmoa_deleted_at is null;
  return found;
end;
$function$;

revoke all on function public.yesmoa_admin_update(uuid,jsonb) from public, anon;
grant execute on function public.yesmoa_admin_update(uuid,jsonb) to authenticated;
-- Ignore birth dates from older clients for new requests only.
-- Existing rows and their saved birth dates are left untouched.
create or replace function yesmoa_private.omit_new_birth_date() returns trigger
language plpgsql security definer set search_path='' as $omit$
begin
 if new.yesmoa_id is not null then new.yesmoa_birth_date:=null; end if;
 return new;
end;
$omit$;
revoke all on function yesmoa_private.omit_new_birth_date() from public, anon, authenticated;
create or replace trigger yesmoa_omit_new_birth_date before insert on public.requests
for each row execute function yesmoa_private.omit_new_birth_date();
notify pgrst, 'reload schema';
commit;
