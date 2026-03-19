-- Minimal production schema for admin-only license server.
-- Safe for existing Supabase projects because it does NOT modify old tables
-- like users, user_profiles, qr_map, school_tokens, or telemetry_logs.
--
-- Use this when the web project is only for YOU as the license issuer.
-- The Vercel API will use SUPABASE_SERVICE_ROLE_KEY, so these tables do not
-- need browser-facing RLS policies.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.licenses (
  id text primary key,
  npsn text not null unique,
  school_name text,
  plan text not null default 'full' check (plan in ('full', 'trial')),
  activation_limit integer not null default 1 check (activation_limit >= 1),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licenses_npsn_format check (npsn ~ '^[0-9]{8}$')
);

create table if not exists public.license_activations (
  id text primary key,
  license_id text not null references public.licenses(id) on delete cascade,
  device_id text not null,
  device_label text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_id, device_id)
);

create table if not exists public.license_orders (
  order_id text primary key,
  license_id text references public.licenses(id) on delete set null,
  npsn text not null,
  school_name text,
  device_id text not null,
  amount bigint not null default 0 check (amount >= 0),
  currency text not null default 'IDR',
  status text not null default 'pending',
  payment_type text,
  payment_provider text not null default 'midtrans',
  redirect_url text,
  snap_token text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint license_orders_npsn_format check (npsn ~ '^[0-9]{8}$')
);

create index if not exists idx_licenses_status on public.licenses(status);
create index if not exists idx_license_activations_status on public.license_activations(status);
create index if not exists idx_license_activations_license_id on public.license_activations(license_id);
create index if not exists idx_license_orders_status on public.license_orders(status);
create index if not exists idx_license_orders_npsn on public.license_orders(npsn);
create index if not exists idx_license_orders_paid_at on public.license_orders(paid_at desc);

drop trigger if exists trg_licenses_updated_at on public.licenses;
create trigger trg_licenses_updated_at
before update on public.licenses
for each row
execute function public.set_updated_at();

drop trigger if exists trg_license_activations_updated_at on public.license_activations;
create trigger trg_license_activations_updated_at
before update on public.license_activations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_license_orders_updated_at on public.license_orders;
create trigger trg_license_orders_updated_at
before update on public.license_orders
for each row
execute function public.set_updated_at();

comment on table public.licenses is 'Master lisensi online untuk Exam Edukreasi';
comment on table public.license_activations is 'Ikatan device client ke lisensi';
comment on table public.license_orders is 'Riwayat checkout dan pembayaran lisensi online';
