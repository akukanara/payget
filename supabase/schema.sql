create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.app_users add column if not exists is_approved boolean not null default false;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_keys_prefix on public.api_keys(key_prefix);
create index if not exists idx_api_keys_user_id on public.api_keys(user_id);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  order_id text not null unique,
  gross_amount numeric not null,
  payment_type text,
  transaction_status text,
  transaction_id text,
  customer_email text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_order_id on public.transactions(order_id);

alter table public.app_users enable row level security;
alter table public.api_keys enable row level security;
alter table public.transactions enable row level security;
