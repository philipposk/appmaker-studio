-- AppMaker Studio Pro: credit ledger fixes.
--
-- credit_hold now expires the user's orphaned holds (function killed before it
-- could settle) so they stop blocking the balance. Expired holds are charged $0.

create or replace function appmaker.credit_hold(p_user uuid, p_amount bigint, p_model text)
returns bigint
language plpgsql security definer set search_path = appmaker, public
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  -- A build runs at most 300s; a hold older than 15 min will never settle.
  update appmaker.credit_ledger
     set kind = 'usage', amount_micros = 0, note = 'expired hold (unfinished build, not charged)', settled_at = now()
   where user_id = p_user and kind = 'hold' and created_at < now() - interval '15 minutes';
  if appmaker.credit_balance(p_user) < p_amount then
    return null;
  end if;
  insert into appmaker.credit_ledger (user_id, kind, amount_micros, model, note)
  values (p_user, 'hold', -p_amount, p_model, 'reserved for generation')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function appmaker.credit_hold(uuid, bigint, text) from public, anon, authenticated;
grant execute on function appmaker.credit_hold(uuid, bigint, text) to service_role;
