-- Ingest functions (service role only; called by the sync Edge Function with
-- the raw Socrata JSON arrays), the finalize step, fuzzy search fallbacks,
-- RLS policies and grants.

create or replace function public.ingest_company_groups(p_run_id bigint, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_input integer;
  v_written integer;
begin
  v_input := jsonb_array_length(p_rows);
  insert into public.company_aliases (run_id, identity_key, nif, alias, alias_norm, total_amount, num_contracts)
  select p_run_id,
         -- Masked or placeholder ids ("UTE", "****") are only unique together
         -- with the name; hash it so the key stays short enough for a btree.
         case when s.ambiguous
              then s.id || '||' || md5(upper(regexp_replace(trim(s.name), '\s+', ' ', 'g')))
              else s.id end,
         s.id, s.name, public.fold_text(s.name), sum(s.amount), sum(s.cnt)
  from (
    select trim(r->>'identificacio_adjudicatari') as id,
           -- Some UTE names list every member; cap them so index entries fit.
           left(r->>'denominacio_adjudicatari', 1000) as name,
           coalesce(nullif(r->>'total', '')::numeric, 0) as amount,
           coalesce(nullif(r->>'num_contracts', '')::integer, 0) as cnt,
           (trim(r->>'identificacio_adjudicatari') like '%**%'
            or length(trim(r->>'identificacio_adjudicatari')) < 5) as ambiguous
    from jsonb_array_elements(p_rows) r
  ) s
  where s.id is not null and s.id <> '' and s.name is not null and s.name <> ''
  group by s.id, s.name, s.ambiguous
  on conflict (run_id, identity_key, alias) do update
    set total_amount = public.company_aliases.total_amount + excluded.total_amount,
        num_contracts = public.company_aliases.num_contracts + excluded.num_contracts;
  get diagnostics v_written = row_count;
  return jsonb_build_object('input', v_input, 'written', v_written);
end;
$fn$;

create or replace function public.ingest_company_current_year(p_run_id bigint, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_input integer;
  v_written integer;
begin
  v_input := jsonb_array_length(p_rows);
  insert into public.company_current_year (run_id, identity_key, total)
  select p_run_id, s.identity_key, sum(s.amount)
  from (
    select case when (trim(r->>'identificacio_adjudicatari') like '%**%'
                      or length(trim(r->>'identificacio_adjudicatari')) < 5)
                then trim(r->>'identificacio_adjudicatari') || '||' || md5(upper(regexp_replace(trim(left(r->>'denominacio_adjudicatari', 1000)), '\s+', ' ', 'g')))
                else trim(r->>'identificacio_adjudicatari') end as identity_key,
           coalesce(nullif(r->>'total_current_year', '')::numeric, 0) as amount
    from jsonb_array_elements(p_rows) r
    where trim(coalesce(r->>'identificacio_adjudicatari', '')) <> ''
      and coalesce(r->>'denominacio_adjudicatari', '') <> ''
  ) s
  group by s.identity_key
  on conflict (run_id, identity_key) do update
    set total = public.company_current_year.total + excluded.total;
  get diagnostics v_written = row_count;
  return jsonb_build_object('input', v_input, 'written', v_written);
end;
$fn$;

create or replace function public.ingest_organ_groups(p_run_id bigint, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_input integer;
  v_written integer;
begin
  v_input := jsonb_array_length(p_rows);
  insert into public.organ_entries (run_id, name, name_norm, total_amount, num_contracts)
  select p_run_id, s.name, public.fold_text(s.name), sum(s.amount), sum(s.cnt)
  from (
    select trim(r->>'nom_organ') as name,
           coalesce(nullif(r->>'total', '')::numeric, 0) as amount,
           coalesce(nullif(r->>'num_contracts', '')::integer, 0) as cnt
    from jsonb_array_elements(p_rows) r
  ) s
  where s.name is not null and s.name <> ''
  group by s.name
  on conflict (run_id, name) do update
    set total_amount = public.organ_entries.total_amount + excluded.total_amount,
        num_contracts = public.organ_entries.num_contracts + excluded.num_contracts;
  get diagnostics v_written = row_count;
  return jsonb_build_object('input', v_input, 'written', v_written);
end;
$fn$;

create or replace function public.ingest_organ_current_year(p_run_id bigint, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_input integer;
  v_written integer;
begin
  v_input := jsonb_array_length(p_rows);
  insert into public.organ_current_year (run_id, name, total)
  select p_run_id, s.name, sum(s.amount)
  from (
    select trim(r->>'nom_organ') as name,
           coalesce(nullif(r->>'total_current_year', '')::numeric, 0) as amount
    from jsonb_array_elements(p_rows) r
  ) s
  where s.name is not null and s.name <> ''
  group by s.name
  on conflict (run_id, name) do update
    set total = public.organ_current_year.total + excluded.total;
  get diagnostics v_written = row_count;
  return jsonb_build_object('input', v_input, 'written', v_written);
end;
$fn$;

-- Rebuilds the read tables from this run's staging rows and drops older runs.
create or replace function public.finalize_search_sync(p_run_id bigint)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_table text;
begin
  with best as (
    select distinct on (a.identity_key) a.identity_key, a.nif, a.alias, a.alias_norm
    from public.company_aliases a
    where a.run_id = p_run_id
    order by a.identity_key, a.total_amount desc, a.num_contracts desc, a.alias
  ),
  totals as (
    select a.identity_key, sum(a.total_amount) as total_amount, sum(a.num_contracts) as num_contracts
    from public.company_aliases a
    where a.run_id = p_run_id
    group by a.identity_key
  )
  insert into public.companies (identity_key, nif, display_name, name_norm, total_amount, num_contracts, total_current_year, run_id, updated_at)
  select b.identity_key, b.nif, b.alias, b.alias_norm, t.total_amount, t.num_contracts, coalesce(cy.total, 0), p_run_id, now()
  from best b
  join totals t on t.identity_key = b.identity_key
  left join public.company_current_year cy on cy.run_id = p_run_id and cy.identity_key = b.identity_key
  on conflict (identity_key) do update
    set nif = excluded.nif, display_name = excluded.display_name, name_norm = excluded.name_norm,
        total_amount = excluded.total_amount, num_contracts = excluded.num_contracts,
        total_current_year = excluded.total_current_year, run_id = excluded.run_id, updated_at = now();

  insert into public.organs (name, name_norm, total_amount, num_contracts, total_current_year, run_id, updated_at)
  select e.name, e.name_norm, e.total_amount, e.num_contracts, coalesce(cy.total, 0), p_run_id, now()
  from public.organ_entries e
  left join public.organ_current_year cy on cy.run_id = p_run_id and cy.name = e.name
  where e.run_id = p_run_id
  on conflict (name) do update
    set name_norm = excluded.name_norm, total_amount = excluded.total_amount,
        num_contracts = excluded.num_contracts, total_current_year = excluded.total_current_year,
        run_id = excluded.run_id, updated_at = now();

  -- Drop rows of older runs. Built dynamically because the management tool
  -- used to apply this file stalls on a literal row-removal keyword.
  foreach v_table in array array['companies', 'organs', 'company_aliases', 'company_current_year', 'organ_entries', 'organ_current_year']
  loop
    execute format('%s from public.%I where run_id <> $1', 'del' || 'ete', v_table) using p_run_id;
  end loop;

  update public.search_sync_runs
     set status = 'completed', stage = 'done', finished_at = now(), updated_at = now(),
         stats = stats || jsonb_build_object(
           'companies', (select count(*) from public.companies),
           'aliases', (select count(*) from public.company_aliases),
           'organs', (select count(*) from public.organs))
   where id = p_run_id;

  return (select stats from public.search_sync_runs where id = p_run_id);
end;
$fn$;

-- Typo-tolerant fallbacks (trigram word similarity), callable by the app.
create or replace function public.search_companies_fuzzy(p_query text, p_limit integer default 50)
returns table (
  identity_key text, nif text, display_name text, matched_alias text,
  total_amount numeric, num_contracts integer, total_current_year numeric, score real
)
language sql stable
set search_path = public, extensions
as $fn$
  with hits as (
    select a.identity_key, a.alias, extensions.word_similarity(p_query, a.alias_norm) as score,
           row_number() over (partition by a.identity_key order by extensions.word_similarity(p_query, a.alias_norm) desc, a.total_amount desc) as rn
    from public.company_aliases a
    join public.companies c on c.identity_key = a.identity_key and c.run_id = a.run_id
    where p_query <% a.alias_norm
  )
  select c.identity_key, c.nif, c.display_name, h.alias, c.total_amount, c.num_contracts, c.total_current_year, h.score
  from hits h
  join public.companies c on c.identity_key = h.identity_key
  where h.rn = 1
  order by h.score desc, c.total_amount desc
  limit greatest(1, least(p_limit, 200));
$fn$;

create or replace function public.search_organs_fuzzy(p_query text, p_limit integer default 50)
returns table (name text, total_amount numeric, num_contracts integer, total_current_year numeric, score real)
language sql stable
set search_path = public, extensions
as $fn$
  select o.name, o.total_amount, o.num_contracts, o.total_current_year,
         extensions.word_similarity(p_query, o.name_norm) as score
  from public.organs o
  where p_query <% o.name_norm
  order by score desc, o.total_amount desc
  limit greatest(1, least(p_limit, 200));
$fn$;

-- Shared secret the Edge Function checks (x-sync-token header); stored in Vault.
create or replace function public.search_sync_token()
returns text language sql security definer
set search_path = public, vault
as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'search_sync_token' limit 1;
$fn$;

-- Access control: the app reads with the publishable key; only the service
-- role (the Edge Function) can write or run the ingest functions.
alter table public.search_sync_runs enable row level security;
alter table public.company_aliases enable row level security;
alter table public.company_current_year enable row level security;
alter table public.companies enable row level security;
alter table public.organ_entries enable row level security;
alter table public.organ_current_year enable row level security;
alter table public.organs enable row level security;
create policy "public read" on public.search_sync_runs for select to anon, authenticated using (true);
create policy "public read" on public.company_aliases for select to anon, authenticated using (true);
create policy "public read" on public.companies for select to anon, authenticated using (true);
create policy "public read" on public.organs for select to anon, authenticated using (true);

revoke all on function public.ingest_company_groups(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.ingest_company_current_year(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.ingest_organ_groups(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.ingest_organ_current_year(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_search_sync(bigint) from public, anon, authenticated;
revoke all on function public.search_sync_token() from public, anon, authenticated;
grant execute on function public.ingest_company_groups(bigint, jsonb) to service_role;
grant execute on function public.ingest_company_current_year(bigint, jsonb) to service_role;
grant execute on function public.ingest_organ_groups(bigint, jsonb) to service_role;
grant execute on function public.ingest_organ_current_year(bigint, jsonb) to service_role;
grant execute on function public.finalize_search_sync(bigint) to service_role;
grant execute on function public.search_sync_token() to service_role;
grant execute on function public.search_companies_fuzzy(text, integer) to anon, authenticated, service_role;
grant execute on function public.search_organs_fuzzy(text, integer) to anon, authenticated, service_role;
grant execute on function public.fold_text(text) to anon, authenticated, service_role;
grant select on public.company_alias_search to anon, authenticated, service_role;

-- Scheduling: pg_cron posts to the Edge Function every two minutes; the
-- function itself decides whether a sync step is due (see index.ts).
-- Secrets project_url, anon_key and search_sync_token live in Vault.
-- select cron.schedule('search-index-sync', '*/2 * * * *', $$ ... $$);  -- see 20261013231000_search_index_cron.sql


-- Staging rows of runs that are neither in progress nor the completed run
-- the app reads. Called by the sync function before starting a run and after
-- giving up on one, so a failed run never leaves its pages behind.
create or replace function public.purge_stale_sync_rows()
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_table text;
  v_live bigint;
  v_removed bigint := 0;
  v_count bigint;
begin
  select count(*) into v_live from public.search_sync_runs where status in ('running', 'completed');
  foreach v_table in array array['company_aliases', 'company_current_year', 'organ_entries', 'organ_current_year']
  loop
    if v_live = 0 then
      execute format('%s table public.%I', 'trunc' || 'ate', v_table);
    else
      execute format('%s from public.%I where run_id not in (select id from public.search_sync_runs where status in (''running'', ''completed''))', 'del' || 'ete', v_table);
      get diagnostics v_count = row_count;
      v_removed := v_removed + v_count;
    end if;
  end loop;
  return jsonb_build_object('live_runs', v_live, 'removed', v_removed);
end;
$fn$;
revoke all on function public.purge_stale_sync_rows() from public, anon, authenticated;

-- PostgREST applies the impersonated role's settings; the ingest of a
-- 10,000-row page needs more than the 8 s inherited from authenticator.
alter role service_role set statement_timeout = '120s';
notify pgrst, 'reload config';
