
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_premium boolean not null default false,
  premium_since timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Read own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin updates profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.is_premium(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select is_premium from public.profiles where id = _user_id), false) $$;

-- New user: profile + first account becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public app settings (single row)
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "Anyone reads settings" on public.app_settings for select to anon, authenticated using (true);
create policy "Admin inserts settings" on public.app_settings for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates settings" on public.app_settings for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Private admin settings (AI keys, payment secrets)
create table public.admin_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.admin_settings to authenticated;
grant all on public.admin_settings to service_role;
alter table public.admin_settings enable row level security;
create policy "Admin reads admin settings" on public.admin_settings for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admin inserts admin settings" on public.admin_settings for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates admin settings" on public.admin_settings for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Method pages
create table public.method_pages (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  type text not null default 'frame',
  partie text not null default '',
  chapitre text not null default '',
  titre text not null default '',
  sous_chapitre text not null default '',
  body text not null default '',
  image_url text,
  image_size int not null default 100,
  updated_at timestamptz not null default now()
);
grant select on public.method_pages to anon, authenticated;
grant insert, update, delete on public.method_pages to authenticated;
grant all on public.method_pages to service_role;
alter table public.method_pages enable row level security;
create policy "Anyone reads pages" on public.method_pages for select to anon, authenticated using (true);
create policy "Admin inserts pages" on public.method_pages for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates pages" on public.method_pages for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin deletes pages" on public.method_pages for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Rectangles (content + premium masks)
create table public.method_rects (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.method_pages(id) on delete cascade,
  kind text not null default 'content',
  x_percent numeric not null default 10,
  y_percent numeric not null default 10,
  width_percent numeric not null default 50,
  height_percent numeric not null default 20,
  full_page boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.method_rects to anon, authenticated;
grant insert, update, delete on public.method_rects to authenticated;
grant all on public.method_rects to service_role;
alter table public.method_rects enable row level security;
create policy "Anyone reads rects" on public.method_rects for select to anon, authenticated using (true);
create policy "Admin inserts rects" on public.method_rects for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates rects" on public.method_rects for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin deletes rects" on public.method_rects for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Price = Time rules
create table public.day_prices (
  id uuid primary key default gen_random_uuid(),
  day int not null unique,
  amount numeric not null default 0
);
grant select on public.day_prices to anon, authenticated;
grant insert, update, delete on public.day_prices to authenticated;
grant all on public.day_prices to service_role;
alter table public.day_prices enable row level security;
create policy "Anyone reads prices" on public.day_prices for select to anon, authenticated using (true);
create policy "Admin inserts prices" on public.day_prices for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin updates prices" on public.day_prices for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin deletes prices" on public.day_prices for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Activation codes
create table public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.activation_codes to authenticated;
grant all on public.activation_codes to service_role;
alter table public.activation_codes enable row level security;
create policy "Admin manages codes" on public.activation_codes for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.redeem_activation_code(_code text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare _id uuid;
begin
  if auth.uid() is null then return false; end if;
  select id into _id from public.activation_codes
    where upper(trim(code)) = upper(trim(_code)) and used_by is null limit 1 for update;
  if _id is null then return false; end if;
  update public.activation_codes set used_by = auth.uid(), used_at = now() where id = _id;
  update public.profiles set is_premium = true, premium_since = now() where id = auth.uid();
  return true;
end;
$$;
grant execute on function public.redeem_activation_code(text) to authenticated;

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null default 'simple',
  amount numeric not null default 0,
  currency text not null default 'EUR',
  status text not null default 'pending',
  external_ref text,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Users read own orders" on public.orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users create own pending orders" on public.orders for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "Admin updates orders" on public.orders for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.sync_paid_order()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    update public.profiles set is_premium = true, premium_since = coalesce(premium_since, now()) where id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger on_order_paid after insert or update on public.orders
  for each row execute function public.sync_paid_order();

-- Premium exercise content
create table public.premium_content (
  key text primary key,
  mode text not null default 'text',
  html text not null default '',
  pdf_path text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.premium_content to authenticated;
grant all on public.premium_content to service_role;
alter table public.premium_content enable row level security;
create policy "Premium or admin reads content" on public.premium_content for select to authenticated
  using (public.is_premium(auth.uid()) or public.has_role(auth.uid(), 'admin'));
create policy "Admin writes content" on public.premium_content for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Which premium exercises have content (public, no content leak)
create or replace function public.premium_content_status()
returns table (key text, ready boolean) language sql stable security definer set search_path = public
as $$ select key, (case when mode = 'pdf' then pdf_path is not null and pdf_path <> '' else length(trim(html)) > 0 end) from public.premium_content $$;
grant execute on function public.premium_content_status() to anon, authenticated;

-- Seed
insert into public.app_settings (id, config) values (1, '{}'::jsonb);
insert into public.admin_settings (id, config) values (1, '{}'::jsonb);
insert into public.day_prices (day, amount) values
 (1,5),(2,10),(3,15),(4,20),(5,25),(6,30),(7,35),(8,40),(9,45),(10,50);

insert into public.method_pages (position, type, partie, chapitre, titre, sous_chapitre, body) values
(1, 'full', 'Partie 2 : Comprendre l''éjaculation', 'Chapitre 1 :', 'Introduction à l''éjaculation', '1.1 DÉFINITION DE L''ÉJACULATION.',
 '<p>L''éjaculation est un processus complexe et essentiel à la reproduction humaine, qui se caractérise par l''expulsion de sperme hors du corps masculin, généralement accompagnée d''une sensation de plaisir intense, appelée orgasme. Bien que l''éjaculation soit souvent associée à l''acte sexuel, elle peut également survenir dans d''autres circonstances, telles que la masturbation ou même pendant le sommeil, dans ce qu''on appelle communément les "rêves érotiques" ou "pollutions nocturnes".</p><p>Le sperme, également connu sous le nom de liquide séminal, est un mélange de plusieurs sécrétions produites par les organes sexuels masculins, notamment les vésicules séminales, la prostate et les glandes de Cowper. La principale fonction du sperme est de transporter les spermatozoïdes, les cellules reproductrices masculines, vers l''ovule féminin pour permettre la fécondation.</p><p>L''éjaculation est le résultat d''une série de réactions physiologiques et neurologiques qui se produisent dans le corps masculin. Elle est généralement précédée par une phase d''excitation sexuelle, au cours de laquelle le pénis se dilate et se rigidifie, un processus connu sous le nom d''érection.</p>'),
(2, 'chapter', '', 'Chapitre 2 :', 'L''oxygène et la dopamine et leurs liens avec l''éjaculation', '',
 '<p>Le fonctionnement de nos méthodes repose en partie sur l''interaction entre l''oxygène et la dopamine dans le corps.</p><p>🧪 <strong>Qu’est-ce que la dopamine ?</strong> La dopamine est un neurotransmetteur, c’est-à-dire une molécule chimique produite par le cerveau pour transmettre des messages entre les neurones. Elle joue un rôle essentiel dans de nombreux processus : la motivation, le plaisir, le désir sexuel, la concentration et même le mouvement. Mais dans le cadre de la sexualité, la dopamine est bien plus qu’une simple "molécule du plaisir". C’est elle qui déclenche l’envie d’agir, met le corps en éveil, prépare l’érection, et active le mécanisme qui mène à l’éjaculation.</p><p>🎯 <strong>Dopamine = carburant du désir sexuel</strong> Dès que tu es excité, que ce soit par une image, une sensation, une odeur ou un contact physique, ton cerveau commence à sécréter de la dopamine dans certaines zones bien précises : le striatum (plaisir pur), le noyau accumbens (motivation à atteindre le plaisir), l’hypothalamus (coordination avec les hormones sexuelles).</p>');
