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

create table if not exists public.license_settings (
  id text primary key,
  checkout_price bigint not null default 0 check (checkout_price >= 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.license_settings
add column if not exists student_alt_download_url text;

alter table public.license_settings
add column if not exists student_latest_version_code bigint not null default 0;

alter table public.license_settings enable row level security;

insert into public.license_settings (id, checkout_price)
values ('default', 0)
on conflict (id) do nothing;

drop trigger if exists trg_license_settings_updated_at on public.license_settings;
create trigger trg_license_settings_updated_at
before update on public.license_settings
for each row
execute function public.set_updated_at();

drop policy if exists license_settings_server_only_access on public.license_settings;
create policy license_settings_server_only_access
on public.license_settings
for all
to anon, authenticated
using (false)
with check (false);

comment on table public.license_settings is 'Pengaturan runtime checkout lisensi yang dapat diubah superadmin.';
