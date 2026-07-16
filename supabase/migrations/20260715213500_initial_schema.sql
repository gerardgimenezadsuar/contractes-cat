-- Profiles: issuer identity (doctor)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  nif text not null,
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  province text not null default '',
  irpf_rate numeric not null default 15,
  invoice_prefix text not null default 'F',
  next_invoice_number integer not null default 1,
  created_at timestamptz not null default now()
);

-- Clients: patients or clinics
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nif text not null,
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  created_at timestamptz not null default now()
);

-- Invoice templates ("1a visita", etc.)
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  concept text not null,
  unit_price numeric not null default 0,
  irpf_applies boolean not null default false,
  created_at timestamptz not null default now()
);

-- Invoices (issuer + client snapshotted as jsonb)
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text not null,
  issue_date date not null default current_date,
  issuer jsonb not null,
  client_id uuid references public.clients(id) on delete set null,
  client jsonb not null,
  lines jsonb not null,
  subtotal numeric not null,
  vat_exempt boolean not null default true,
  vat_rate numeric not null default 0,
  vat_amount numeric not null default 0,
  irpf_rate numeric not null default 0,
  irpf_amount numeric not null default 0,
  total numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, number)
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.templates enable row level security;
alter table public.invoices enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own templates" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomically allocate the next invoice number for the current user
create or replace function public.allocate_invoice_number()
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefix text;
  v_num integer;
begin
  update profiles
     set next_invoice_number = next_invoice_number + 1
   where user_id = auth.uid()
  returning invoice_prefix, next_invoice_number - 1 into v_prefix, v_num;
  if v_num is null then
    raise exception 'Profile not found';
  end if;
  return v_prefix || '-' || lpad(v_num::text, 4, '0');
end;
$$;

revoke all on function public.allocate_invoice_number() from public;
revoke all on function public.allocate_invoice_number() from anon;
grant execute on function public.allocate_invoice_number() to authenticated;
