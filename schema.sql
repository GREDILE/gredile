-- GR Edile Gestionale: schema per Supabase.
-- Come usarlo: Supabase > SQL Editor > New query > incolla tutto > Run.
-- PRIMA di eseguirlo, sostituisci le due email qui sotto con quelle di chi può entrare.

-- 1) Chi può usare l'app (elenco di email autorizzate)
create table if not exists public.membri (email text primary key);
alter table public.membri enable row level security;   -- senza regole: nessuno la legge dall'app

insert into public.membri (email) values
  ('TUA-EMAIL@esempio.it'),
  ('EMAIL-DEL-SUOCERO@esempio.it')
on conflict do nothing;

create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membri
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- 2) Dati dell'app: una riga per ogni cantiere, cliente, fattura, ecc.
create table if not exists public.records (
  coll       text        not null,            -- tipo di dato: clienti, cantieri, fatture, ...
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid        default auth.uid(),
  primary key (coll, id)
);
alter table public.records enable row level security;

drop policy if exists "membri leggono"    on public.records;
drop policy if exists "membri inseriscono" on public.records;
drop policy if exists "membri modificano" on public.records;
drop policy if exists "membri eliminano"  on public.records;

create policy "membri leggono"     on public.records for select to authenticated using (public.is_member());
create policy "membri inseriscono" on public.records for insert to authenticated with check (public.is_member());
create policy "membri modificano"  on public.records for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "membri eliminano"   on public.records for delete to authenticated using (public.is_member());

create or replace function public.records_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records
  for each row execute function public.records_touch();

-- 3) Tempo reale: le modifiche arrivano subito agli altri dispositivi
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;

-- 4) Archivio dei documenti (contratti, DURC, assicurazioni, ...), privato
insert into storage.buckets (id, name, public)
values ('documenti', 'documenti', false)
on conflict (id) do nothing;

drop policy if exists "documenti leggi"     on storage.objects;
drop policy if exists "documenti caricano"  on storage.objects;
drop policy if exists "documenti eliminano" on storage.objects;

create policy "documenti leggi"     on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and public.is_member());
create policy "documenti caricano"  on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and public.is_member());
create policy "documenti eliminano" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and public.is_member());
