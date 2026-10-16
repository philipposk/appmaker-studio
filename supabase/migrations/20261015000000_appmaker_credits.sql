-- AppMaker Studio Pro: prepaid credit ledger.
--
-- Amounts are USD micro-dollars (1 USD = 1_000_000). Positive = credit added
-- (top-up / grant), negative = spend (hold / usage). Balance = sum(amount).
-- Clients never write here: only the service role (Edge Functions) calls the
-- RPCs below. Signed-in users may read their own rows.

create table if not exists appmaker.credit_ledger (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('topup', 'grant', 'hold', 'usage', 'refund')),
  amount_micros   bigint not null,
  raw_cost_micros bigint,          -- provider cost before markup (usage rows)
  model           text,
  tokens          integer,
  ref             text unique,     -- Stripe Checkout session id for top-ups (idempotency)
  note            text,
  created_at      timestamptz not null default now(),
  settled_at      timestamptz
);

create index if not exists credit_ledger_user_idx on appmaker.credit_ledger (user_id, created_at desc);

alter table appmaker.credit_ledger enable row level security;

drop policy if exists "own ledger rows" on appmaker.credit_ledger;
create policy "own ledger rows" on appmaker.credit_ledger
  for select to authenticated using (auth.uid() = user_id);

grant select on appmaker.credit_ledger to authenticated;
grant all on appmaker.credit_ledger to service_role;
grant usage, select on sequence appmaker.credit_ledger_id_seq to service_role;

-- Current balance in micro-dollars.
create or replace function appmaker.credit_balance(p_user uuid)
returns bigint
language sql stable security definer set search_path = appmaker, public
as $$
  select coalesce(sum(amount_micros), 0)::bigint from appmaker.credit_ledger where user_id = p_user;
$$;

-- Reserve p_amount before a generation. Serialised per user (advisory lock) so
-- parallel tabs can't overspend. Returns the hold id, or null if balance is short.
create or replace function appmaker.credit_hold(p_user uuid, p_amount bigint, p_model text)
returns bigint
language plpgsql security definer set search_path = appmaker, public
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if appmaker.credit_balance(p_user) < p_amount then
    return null;
  end if;
  insert into appmaker.credit_ledger (user_id, kind, amount_micros, model, note)
  values (p_user, 'hold', -p_amount, p_model, 'reserved for generation')
  returning id into v_id;
  return v_id;
end;
$$;

-- Turn a hold into the final charge (actual cost x markup).
create or replace function appmaker.credit_settle(
  p_hold bigint, p_amount bigint, p_raw_cost bigint, p_tokens integer, p_model text
)
returns void
language sql security definer set search_path = appmaker, public
as $$
  update appmaker.credit_ledger
     set kind = 'usage', amount_micros = -p_amount, raw_cost_micros = p_raw_cost,
         tokens = p_tokens, model = p_model, note = null, settled_at = now()
   where id = p_hold and kind = 'hold';
$$;

-- Record usage without a hold (owner / comped accounts: amount 0, cost tracked).
create or replace function appmaker.credit_log_usage(
  p_user uuid, p_amount bigint, p_raw_cost bigint, p_tokens integer, p_model text
)
returns void
language sql security definer set search_path = appmaker, public
as $$
  insert into appmaker.credit_ledger (user_id, kind, amount_micros, raw_cost_micros, tokens, model, settled_at)
  values (p_user, 'usage', -p_amount, p_raw_cost, p_tokens, p_model, now());
$$;

-- Credit a paid top-up exactly once per Stripe session. Returns true if new.
create or replace function appmaker.credit_topup(p_user uuid, p_amount bigint, p_ref text)
returns boolean
language plpgsql security definer set search_path = appmaker, public
as $$
begin
  insert into appmaker.credit_ledger (user_id, kind, amount_micros, ref, note, settled_at)
  values (p_user, 'topup', p_amount, p_ref, 'Stripe top-up', now())
  on conflict (ref) do nothing;
  return found;
end;
$$;

revoke all on function appmaker.credit_balance(uuid)                        from public, anon, authenticated;
revoke all on function appmaker.credit_hold(uuid, bigint, text)             from public, anon, authenticated;
revoke all on function appmaker.credit_settle(bigint, bigint, bigint, integer, text) from public, anon, authenticated;
revoke all on function appmaker.credit_log_usage(uuid, bigint, bigint, integer, text) from public, anon, authenticated;
revoke all on function appmaker.credit_topup(uuid, bigint, text)            from public, anon, authenticated;
grant execute on function appmaker.credit_balance(uuid)                        to service_role;
grant execute on function appmaker.credit_hold(uuid, bigint, text)             to service_role;
grant execute on function appmaker.credit_settle(bigint, bigint, bigint, integer, text) to service_role;
grant execute on function appmaker.credit_log_usage(uuid, bigint, bigint, integer, text) to service_role;
grant execute on function appmaker.credit_topup(uuid, bigint, text)            to service_role;
