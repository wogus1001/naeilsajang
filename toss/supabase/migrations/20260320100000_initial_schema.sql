create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'store_auth_source') then
    create type public.store_auth_source as enum ('toss', 'sandbox', 'browser-demo');
  end if;

  if not exists (select 1 from pg_type where typname = 'checklist_type') then
    create type public.checklist_type as enum ('open', 'close');
  end if;

  if not exists (select 1 from pg_type where typname = 'completion_actor_kind') then
    create type public.completion_actor_kind as enum ('owner', 'worker');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  toss_user_key bigint unique,
  store_name text not null check (char_length(trim(store_name)) > 0),
  owner_nickname text not null check (char_length(trim(owner_nickname)) > 0),
  auth_source public.store_auth_source not null default 'browser-demo',
  agreed_scopes text[] not null default '{}',
  agreed_terms text[] not null default '{}',
  auth_verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workers (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  added_at timestamptz not null,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.checklist_items (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0),
  type public.checklist_type not null,
  sort_order integer not null check (sort_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.completion_records (
  id text primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  record_date date not null,
  checklist_type public.checklist_type not null,
  completed_at timestamptz not null,
  total_items integer not null check (total_items >= 0),
  checked_item_ids text[] not null default '{}',
  actor_kind public.completion_actor_kind not null,
  actor_worker_id text references public.workers(id) on delete set null,
  actor_name_snapshot text not null check (char_length(trim(actor_name_snapshot)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint completion_records_store_date_type_key unique (store_id, record_date, checklist_type)
);

create index if not exists stores_toss_user_key_idx
  on public.stores (toss_user_key);

create index if not exists workers_store_id_idx
  on public.workers (store_id);

create unique index if not exists checklist_items_store_type_order_idx
  on public.checklist_items (store_id, type, sort_order)
  where is_active = true;

create index if not exists completion_records_store_date_idx
  on public.completion_records (store_id, record_date desc);

create index if not exists completion_records_actor_worker_id_idx
  on public.completion_records (actor_worker_id)
  where actor_worker_id is not null;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
before update on public.stores
for each row
execute function public.set_updated_at();

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
before update on public.workers
for each row
execute function public.set_updated_at();

drop trigger if exists checklist_items_set_updated_at on public.checklist_items;
create trigger checklist_items_set_updated_at
before update on public.checklist_items
for each row
execute function public.set_updated_at();

drop trigger if exists completion_records_set_updated_at on public.completion_records;
create trigger completion_records_set_updated_at
before update on public.completion_records
for each row
execute function public.set_updated_at();

alter table public.stores enable row level security;
alter table public.workers enable row level security;
alter table public.checklist_items enable row level security;
alter table public.completion_records enable row level security;
