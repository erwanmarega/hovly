-- Partage d'une sélection de biens via un lien public en lecture seule.
-- Le token est la seule porte d'entrée publique : aucune policy anon n'est
-- créée, même idiome que `marche_quartier` (accès via clé service uniquement,
-- appliqué côté application dans server/api/partages/[token].get.ts).

create table if not exists public.partages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token      text not null unique,
  titre      text,
  cree_le    timestamptz not null default now(),
  expire_le  timestamptz
);

create index if not exists partages_user_id_idx on public.partages (user_id);
create index if not exists partages_token_idx on public.partages (token);

create table if not exists public.partage_biens (
  partage_id uuid not null references public.partages (id) on delete cascade,
  bien_id    uuid not null references public.biens (id) on delete cascade,
  primary key (partage_id, bien_id)
);

alter table public.partages enable row level security;
alter table public.partage_biens enable row level security;

drop policy if exists "partages_own" on public.partages;
create policy "partages_own" on public.partages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vérifie à la fois que le partage appartient à l'utilisateur et que le bien
-- référencé lui appartient aussi : un bug applicatif ne peut pas glisser le
-- bien d'un autre utilisateur dans un partage.
drop policy if exists "partage_biens_own" on public.partage_biens;
create policy "partage_biens_own" on public.partage_biens
  for all using (
    exists (select 1 from public.partages p where p.id = partage_id and p.user_id = auth.uid())
    and exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.partages p where p.id = partage_id and p.user_id = auth.uid())
    and exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );
