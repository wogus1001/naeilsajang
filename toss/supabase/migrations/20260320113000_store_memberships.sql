do $$
begin
  if not exists (select 1 from pg_type where typname = 'store_membership_role') then
    create type public.store_membership_role as enum ('owner', 'staff');
  end if;
end
$$;

create table if not exists public.store_memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  toss_user_key bigint not null,
  role public.store_membership_role not null,
  nickname text not null check (char_length(trim(nickname)) > 0),
  worker_id text references public.workers(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint store_memberships_store_user_key unique (store_id, toss_user_key)
);

create index if not exists store_memberships_toss_user_key_idx
  on public.store_memberships (toss_user_key);

drop trigger if exists store_memberships_set_updated_at on public.store_memberships;
create trigger store_memberships_set_updated_at
before update on public.store_memberships
for each row
execute function public.set_updated_at();

alter table public.store_memberships enable row level security;
