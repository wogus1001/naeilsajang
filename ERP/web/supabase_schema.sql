-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. COMPANIES Table (Tenants)
create table if not exists public.companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  business_number text,
  owner_id uuid, -- Link to auth.users later
  status text default 'active', -- active, non_payment, blocked
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. PROFILES Table (Extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  company_id uuid references public.companies(id),
  email text,
  name text,
  role text default 'staff', -- admin, manager, staff
  status text default 'pending', -- active, pending
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. RLS (Row Level Security) Helper Function
-- Function to get the current user's company_id
create or replace function get_my_company_id()
returns uuid
language sql
security definer
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- 4. ENABLE RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;

-- 5. RLS POLICIES

-- Companies: Users can only view their own company
create policy "Users can view own company" on public.companies
  for select using (id = get_my_company_id());

-- Profiles: Users can view profiles from the same company
create policy "Users can view members of same company" on public.profiles
  for select using (company_id = get_my_company_id());

-- Profiles: Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());

-- 6. AUTH TRIGGER (Auto-create profile)
-- Note: This trigger handles new user signups via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'staff');
  return new;
end;
$$;

-- Drop existing trigger if exists to allow update
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. MEMOS Table
create table if not exists public.memos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. NOTICES Table
create table if not exists public.notices (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade, -- Null if system notice
  title text not null,
  content text,
  type text default 'team', -- team, system
  author_id uuid, -- informational only
  is_pinned boolean default false,
  views integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. PHASE 2 RLS POLICIES
alter table public.memos enable row level security;
alter table public.notices enable row level security;

-- Memos: Private to user
create policy "Users can manage own memos" on public.memos
  for all using (user_id = auth.uid());

-- Notices: View (System wide OR My Company)
create policy "Users can view relevant notices" on public.notices
  for select using (
    company_id is null 
    or 
    company_id = get_my_company_id()
  );

-- Notices: Create/Update (Admins/Managers of their company)
-- Simplified: Allow any auth user to create for now, restricted by logic later or refine policy
create policy "Users can create notices for their company" on public.notices
  for insert with check (
    -- System notice: only if super admin (skip implementation for now, allow null for logic)
    -- Team notice: company_id match
    company_id = get_my_company_id()
  );

-- 10. FIXES & ALTERATIONS
-- Add missing FK for author_id in notices to enable joins
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notices_author_id_fkey') then
    alter table public.notices
    add constraint notices_author_id_fkey
    foreign key (author_id)
    references public.profiles (id);
  end if;
end $$;

-- 11. PROPERTIES Table (Hybrid: Core Cols + JSONB)
create table if not exists public.properties (
  id text primary key, -- Legacy ID preservation
  company_id uuid references public.companies(id) on delete cascade not null,
  manager_id uuid references public.profiles(id), -- Can be null?
  name text,
  status text, -- progress/grade
  operation_type text, -- type
  address text,
  is_favorite boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb default '{}'::jsonb -- Full payload for detail fields
);

-- 12. CUSTOMERS Table
create table if not exists public.customers (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  manager_id uuid references public.profiles(id),
  name text,
  grade text, -- progress/status
  mobile text, 
  is_favorite boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb default '{}'::jsonb
);

-- 13. CONTRACTS Table
create table if not exists public.contracts (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade, 
  user_id uuid references public.profiles(id), -- Manager who owns contract
  property_id text references public.properties(id) on delete set null,
  name text,
  status text, -- on_going, etc
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb default '{}'::jsonb
);

-- 14. PHASE 3 RLS
alter table public.properties enable row level security;
alter table public.customers enable row level security;
alter table public.contracts enable row level security;

-- Properties: View/Manage own company's data
create policy "Company members can view properties" on public.properties
  for select using (company_id = get_my_company_id());

create policy "Company members can insert properties" on public.properties
  for insert with check (company_id = get_my_company_id());

create policy "Company members can update properties" on public.properties
  for update using (company_id = get_my_company_id());

create policy "Company members can delete properties" on public.properties
  for delete using (company_id = get_my_company_id());

-- Customers
create policy "Company members can view customers" on public.customers
  for select using (company_id = get_my_company_id());

create policy "Company members can insert customers" on public.customers
  for insert with check (company_id = get_my_company_id());

create policy "Company members can update customers" on public.customers
  for update using (company_id = get_my_company_id());

create policy "Company members can delete customers" on public.customers
  for delete using (company_id = get_my_company_id());

-- Contracts
create policy "Company members can view contracts" on public.contracts
  for select using (company_id = get_my_company_id());

create policy "Company members can insert contracts" on public.contracts
  for insert with check (company_id = get_my_company_id());

create policy "Company members can update contracts" on public.contracts
  for update using (company_id = get_my_company_id());

create policy "Company members can delete contracts" on public.contracts
  for delete using (company_id = get_my_company_id());



-- 15. UCANSIGN INTEGRATION
alter table public.profiles add column if not exists ucansign_expires_at bigint; -- Store as timestamp ms


-- 16. SCHEDULES Table (Work History)
create table if not exists public.schedules (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  user_id uuid references public.profiles(id),
  customer_id text references public.customers(id) on delete set null,
  property_id text references public.properties(id) on delete set null,
  business_card_id text, -- No FK yet
  title text,
  date text, -- YYYY-MM-DD
  scope text, -- work, public, personal
  status text, -- progress, done, etc
  type text, -- work, schedule
  color text,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Schedules
alter table public.schedules enable row level security;

create policy "Company members can view schedules" on public.schedules
  for select using (company_id = get_my_company_id());

create policy "Company members can insert schedules" on public.schedules
  for insert with check (company_id = get_my_company_id());

create policy "Company members can update schedules" on public.schedules
  for update using (company_id = get_my_company_id());

create policy "Company members can delete schedules" on public.schedules
  for delete using (company_id = get_my_company_id());


-- 17. SHARE LINKS Table (Secret Briefing)
create table if not exists public.share_links (
  id bigint generated by default as identity primary key,
  token text unique not null,
  property_id text references public.properties(id) on delete cascade not null,
  consultant_id uuid references public.profiles(id) not null,
  company_id uuid references public.companies(id) not null, -- Added for RLS
  options jsonb, -- { "memo": "Recipient Name", "hide_address": true, "show_briefing_price": true }
  view_count int default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Share Links
alter table public.share_links enable row level security;

-- Consultants can view/manage their own links (or company links)
create policy "Company members can view share_links" on public.share_links
  for select using (company_id = get_my_company_id());

create policy "Company members can insert share_links" on public.share_links
  for insert with check (company_id = get_my_company_id());
  
create policy "Company members can update share_links" on public.share_links
  for update using (company_id = get_my_company_id());

create policy "Company members can delete share_links" on public.share_links
  for delete using (company_id = get_my_company_id());

-- Public Access (Anonymous users with valid token)
-- Note: This is tricky with standard RLS if auth.uid() is null.
-- We might need a security definer function or open up public select with token match?
-- For now, allow public select on ALL rows? No, that's unsafe.
-- Strategy: Route Handler will use Service Role Key to fetch data, so public RLS might not be needed for direct client access if we proxy via API.
-- If we use API Route (backend), we bypass RLS using Service Role or we ensure the user is authenticated.
-- Since the receiver is anonymous, we will rely on the Server-Side API endpoint to fetch with admin privileges (Service Role) and return sanitized data.
-- So we DO NOT add a public select policy here to keep it secure. Only authenticated company members can see the raw rows.
