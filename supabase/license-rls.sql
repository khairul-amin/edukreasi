-- Terapkan RLS hanya untuk tabel lisensi web ini.
-- Aman untuk project yang sudah berjalan karena akses server tetap memakai service role.

alter table if exists public.licenses enable row level security;
alter table if exists public.license_activations enable row level security;
alter table if exists public.license_orders enable row level security;
alter table if exists public.license_settings enable row level security;

drop policy if exists licenses_server_only_access on public.licenses;
create policy licenses_server_only_access
on public.licenses
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists license_activations_server_only_access on public.license_activations;
create policy license_activations_server_only_access
on public.license_activations
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists license_orders_server_only_access on public.license_orders;
create policy license_orders_server_only_access
on public.license_orders
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists license_settings_server_only_access on public.license_settings;
create policy license_settings_server_only_access
on public.license_settings
for all
to anon, authenticated
using (false)
with check (false);
