create extension if not exists "pgcrypto";

create table if not exists public.biens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  url_source  text not null,
  site_source text,
  titre       text,
  prix        integer,
  surface     integer,
  nb_pieces   integer,
  etage       integer,
  charges     integer,
  dpe         char(1),
  adresse     text,
  ville       text,
  code_postal char(5),
  lat         double precision,
  lon         double precision,
  photos      text[] default '{}',
  description text,
  statut      text not null default 'a_visiter',
  note_perso  text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists biens_user_id_idx on public.biens (user_id);
create index if not exists biens_created_at_idx on public.biens (created_at desc);

create table if not exists public.prix_historique (
  id          uuid primary key default gen_random_uuid(),
  bien_id     uuid not null references public.biens (id) on delete cascade,
  prix        integer,
  controle_le timestamptz not null default now()
);

create index if not exists prix_historique_bien_id_idx on public.prix_historique (bien_id);

create table if not exists public.alertes (
  id           uuid primary key default gen_random_uuid(),
  bien_id      uuid not null references public.biens (id) on delete cascade,
  type         text,
  ancien_prix  integer,
  nouveau_prix integer,
  envoyee_le   timestamptz not null default now(),
  vue          boolean not null default false
);

create index if not exists alertes_bien_id_idx on public.alertes (bien_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists biens_set_updated_at on public.biens;
create trigger biens_set_updated_at
  before update on public.biens
  for each row execute function public.set_updated_at();

alter table public.biens enable row level security;
alter table public.prix_historique enable row level security;
alter table public.alertes enable row level security;

drop policy if exists "biens_select_own" on public.biens;
create policy "biens_select_own" on public.biens
  for select using (auth.uid() = user_id);

drop policy if exists "biens_insert_own" on public.biens;
create policy "biens_insert_own" on public.biens
  for insert with check (auth.uid() = user_id);

drop policy if exists "biens_update_own" on public.biens;
create policy "biens_update_own" on public.biens
  for update using (auth.uid() = user_id);

drop policy if exists "biens_delete_own" on public.biens;
create policy "biens_delete_own" on public.biens
  for delete using (auth.uid() = user_id);

drop policy if exists "prix_historique_own" on public.prix_historique;
create policy "prix_historique_own" on public.prix_historique
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );

drop policy if exists "alertes_own" on public.alertes;
create policy "alertes_own" on public.alertes
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );
