-- Search index for contractes.cat: companies (with name aliases) and organs,
-- synced from the Socrata open-data dataset by the sync-search-index Edge
-- Function (supabase/functions/sync-search-index). The Next.js app reads it
-- with the publishable key; RLS allows public SELECT only.
--
-- Applied to the project with the Supabase MCP tools; kept here for review
-- and for recreating the project.

-- Folded form used for matching: uppercase, accent-free, letters and digits
-- only. Mirrors normalizeForMatch() in src/lib/search-query.ts.
create or replace function public.fold_text(input text)
returns text language sql stable parallel safe
set search_path = public, extensions
as $$
  select regexp_replace(upper(extensions.unaccent(coalesce(input, ''))), '[^A-Z0-9]', '', 'g');
$$;

create table public.search_sync_runs (
  id bigint generated always as identity primary key,
  status text not null default 'running',       -- running | completed | failed
  stage text not null default 'companies',       -- companies | companies_cy | organs | organs_cy | finalize | done
  page integer not null default 0,
  consecutive_errors integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text
);

-- One row per (awardee id, name spelling) as grouped by Socrata.
create table public.company_aliases (
  run_id bigint not null,
  identity_key text not null,
  nif text not null,
  alias text not null,
  alias_norm text not null,
  total_amount numeric not null default 0,
  num_contracts integer not null default 0,
  primary key (run_id, identity_key, alias)
);
create index company_aliases_norm_trgm on public.company_aliases using gin (alias_norm extensions.gin_trgm_ops);
create index company_aliases_identity on public.company_aliases (identity_key);

create table public.company_current_year (
  run_id bigint not null,
  identity_key text not null,
  total numeric not null default 0,
  primary key (run_id, identity_key)
);

-- One row per company identity (real NIF, or masked id + name), rebuilt at
-- the end of each sync from the aliases of that run.
create table public.companies (
  identity_key text primary key,
  nif text not null,
  display_name text not null,
  name_norm text not null,
  total_amount numeric not null default 0,
  num_contracts integer not null default 0,
  total_current_year numeric not null default 0,
  run_id bigint not null,
  updated_at timestamptz not null default now()
);
create index companies_total on public.companies (total_amount desc);
create index companies_run on public.companies (run_id);

create table public.organ_entries (
  run_id bigint not null,
  name text not null,
  name_norm text not null,
  total_amount numeric not null default 0,
  num_contracts integer not null default 0,
  primary key (run_id, name)
);

create table public.organ_current_year (
  run_id bigint not null,
  name text not null,
  total numeric not null default 0,
  primary key (run_id, name)
);

create table public.organs (
  name text primary key,
  name_norm text not null,
  total_amount numeric not null default 0,
  num_contracts integer not null default 0,
  total_current_year numeric not null default 0,
  run_id bigint not null,
  updated_at timestamptz not null default now()
);
create index organs_norm_trgm on public.organs using gin (name_norm extensions.gin_trgm_ops);
create index organs_total on public.organs (total_amount desc);

-- Read model for company search: every alias of every company in the
-- active run, with the company's consolidated figures.
create or replace view public.company_alias_search
with (security_invoker = true) as
  select a.identity_key, c.nif, c.display_name, a.alias as matched_alias, a.alias_norm,
         a.total_amount as alias_total, c.total_amount, c.num_contracts, c.total_current_year
  from public.company_aliases a
  join public.companies c on c.identity_key = a.identity_key and c.run_id = a.run_id;
