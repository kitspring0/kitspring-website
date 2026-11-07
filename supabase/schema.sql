-- =====================================================================
-- KitSpring database, security and storage  (v2)
-- Run the WHOLE file once in Supabase -> SQL Editor. It is safe to re-run.
-- No admin account is created here. See docs/SUPABASE-SETUP.md.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.admin_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', role text not null check (role in ('super_admin','admin','editor')),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.collections (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 description text not null default '', cover_url text, sort_order integer not null default 0,
 visible boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 collection text not null, type text not null default 'Digital resource', short_description text not null default '',
 description text not null default '', details text not null default '', audience text not null default '',
 includes jsonb not null default '[]'::jsonb, price numeric(12,2), currency text not null default 'USD', checkout_url text, cover_url text,
 status text not null default 'coming_soon' check (status in ('draft','published','coming_soon','archived')),
 featured boolean not null default false, visible boolean not null default true, seo_title text, seo_description text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.pages (
 id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, content text not null default '',
 published boolean not null default false, seo_title text, seo_description text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique, excerpt text not null default '',
 content text not null default '', cover_url text, status text not null default 'draft' check (status in ('draft','published','archived')),
 published_at timestamptz, seo_title text, seo_description text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.faqs (
 id uuid primary key default gen_random_uuid(), question text not null, answer text not null, sort_order integer not null default 0,
 published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.settings (
 id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.activity_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
 action text not null, entity text not null, entity_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

-- ---------- upgrade older installs / data rules ----------
alter table public.products drop constraint if exists products_collection_check;   -- collections are now managed in the CMS
alter table public.products drop constraint if exists products_checkout_https;
alter table public.products add constraint products_checkout_https check (checkout_url is null or checkout_url ~* '^https://[^\s]+$');
alter table public.products drop constraint if exists products_price_nonneg;
alter table public.products add constraint products_price_nonneg check (price is null or price >= 0);
alter table public.products drop constraint if exists products_slug_fmt;   alter table public.products add constraint products_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.collections drop constraint if exists collections_slug_fmt; alter table public.collections add constraint collections_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.pages drop constraint if exists pages_slug_fmt;         alter table public.pages add constraint pages_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.posts drop constraint if exists posts_slug_fmt;         alter table public.posts add constraint posts_slug_fmt check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------- indexes ----------
create index if not exists products_public_idx on public.products(status, visible, featured desc);
create index if not exists products_collection_idx on public.products(collection);
create index if not exists posts_public_idx on public.posts(status, published_at desc);
create index if not exists faqs_public_idx on public.faqs(published, sort_order);
create index if not exists collections_order_idx on public.collections(sort_order);
create index if not exists activity_created_idx on public.activity_log(created_at desc);

-- ---------- role helpers (security definer so RLS policies can call them) ----------
create or replace function public.current_admin_role() returns text language sql stable security definer set search_path=public,auth
as $$ select role from public.admin_profiles where user_id=auth.uid() and active=true limit 1 $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and active=true and role in ('super_admin','admin','editor')) $$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and active=true and role='super_admin') $$;
create or replace function public.is_admin_or_super() returns boolean language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and active=true and role in ('super_admin','admin')) $$;
revoke all on function public.current_admin_role(),public.is_admin(),public.is_super_admin(),public.is_admin_or_super() from public;
grant execute on function public.current_admin_role(),public.is_admin(),public.is_super_admin(),public.is_admin_or_super() to anon,authenticated;

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['admin_profiles','collections','products','pages','posts','faqs','settings'] loop
 execute format('drop trigger if exists touch_updated_at on public.%I',t);
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
end loop; end $$;

-- ---------- never remove the last active Super Admin ----------
create or replace function public.protect_last_super_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  if old.role='super_admin' and old.active and not exists(select 1 from public.admin_profiles where user_id<>old.user_id and role='super_admin' and active=true) then raise exception 'At least one active Super Admin must remain.'; end if;
  return old;
 end if;
 if old.role='super_admin' and old.active and (new.role<>'super_admin' or new.active=false) and not exists(select 1 from public.admin_profiles where user_id<>old.user_id and role='super_admin' and active=true) then raise exception 'At least one active Super Admin must remain.'; end if;
 return new;
end $$;
drop trigger if exists protect_last_super_admin on public.admin_profiles;
create trigger protect_last_super_admin before update or delete on public.admin_profiles for each row execute function public.protect_last_super_admin();

-- ---------- Row Level Security ----------
alter table public.admin_profiles enable row level security; alter table public.collections enable row level security;
alter table public.products enable row level security;       alter table public.pages enable row level security;
alter table public.posts enable row level security;          alter table public.faqs enable row level security;
alter table public.settings enable row level security;       alter table public.activity_log enable row level security;

-- Public (anonymous) reads: ONLY intentionally public rows. Drafts and archived items are never exposed.
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon,authenticated using (status in ('published','coming_soon') and visible=true);
drop policy if exists collections_public_read on public.collections;
create policy collections_public_read on public.collections for select to anon,authenticated using (visible=true);
drop policy if exists pages_public_read on public.pages;
create policy pages_public_read on public.pages for select to anon,authenticated using (published=true);
drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select to anon,authenticated using (status='published');
drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs for select to anon,authenticated using (published=true);
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon,authenticated using (key in ('site','contact','social','announcement','seo','newsletter'));

-- Staff reads (editors see everything except the activity log and non-public settings)
do $$ declare t text; begin foreach t in array array['products','collections','pages','posts','faqs'] loop
 execute format('drop policy if exists staff_read_%1$s on public.%1$s',t);
 execute format('create policy staff_read_%1$s on public.%1$s for select to authenticated using (public.is_admin())',t);
 execute format('drop policy if exists staff_insert_%1$s on public.%1$s',t);
 execute format('drop policy if exists staff_update_%1$s on public.%1$s',t);
 execute format('drop policy if exists staff_delete_%1$s on public.%1$s',t);
 -- Collections are structural: Admin/Super Admin only. Everything else: editors may create and edit.
 if t='collections' then
  execute format('create policy staff_insert_%1$s on public.%1$s for insert to authenticated with check (public.is_admin_or_super())',t);
  execute format('create policy staff_update_%1$s on public.%1$s for update to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super())',t);
 else
  execute format('create policy staff_insert_%1$s on public.%1$s for insert to authenticated with check (public.is_admin())',t);
  execute format('create policy staff_update_%1$s on public.%1$s for update to authenticated using (public.is_admin()) with check (public.is_admin())',t);
 end if;
 -- Deleting is never allowed for editors.
 execute format('create policy staff_delete_%1$s on public.%1$s for delete to authenticated using (public.is_admin_or_super())',t);
end loop; end $$;

-- Settings: Admin / Super Admin only (editors cannot read or change the non-public rows, nor write any)
drop policy if exists staff_read_settings on public.settings;   create policy staff_read_settings on public.settings for select to authenticated using (public.is_admin_or_super());
drop policy if exists staff_insert_settings on public.settings; create policy staff_insert_settings on public.settings for insert to authenticated with check (public.is_admin_or_super());
drop policy if exists staff_update_settings on public.settings; create policy staff_update_settings on public.settings for update to authenticated using (public.is_admin_or_super()) with check (public.is_admin_or_super());
drop policy if exists staff_delete_settings on public.settings; create policy staff_delete_settings on public.settings for delete to authenticated using (public.is_admin_or_super());

-- Administrator profiles: a user can read their own row; ONLY a Super Admin can read all rows or change roles. No self-promotion.
drop policy if exists profile_self_or_super_read on public.admin_profiles;
create policy profile_self_or_super_read on public.admin_profiles for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
drop policy if exists super_manage_profiles on public.admin_profiles;
create policy super_manage_profiles on public.admin_profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Activity log: Admin/Super Admin read; any staff member may append an entry as themselves; entries are immutable.
drop policy if exists activity_staff_read on public.activity_log;
create policy activity_staff_read on public.activity_log for select to authenticated using (public.is_admin_or_super());
drop policy if exists activity_staff_insert on public.activity_log;
create policy activity_staff_insert on public.activity_log for insert to authenticated with check (actor_id=auth.uid() and public.is_admin());

-- Table privileges (RLS still applies on top of these)
revoke all on public.admin_profiles, public.activity_log, public.settings from anon;
grant select on public.products, public.collections, public.pages, public.posts, public.faqs, public.settings to anon;
grant select, insert, update, delete on public.products, public.collections, public.pages, public.posts, public.faqs, public.settings, public.admin_profiles to authenticated;
grant select, insert on public.activity_log to authenticated;
revoke update, delete on public.activity_log from authenticated;

-- ---------- Super Admin-only administration functions ----------
-- Lists administrators with their sign-in email (auth.users is not readable from the browser).
create or replace function public.admin_directory()
returns table(user_id uuid, email text, display_name text, role text, active boolean, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path=public,auth as $$
begin
 if not public.is_super_admin() then raise exception 'Only a Super Admin can view the administrator directory.'; end if;
 return query select p.user_id, u.email::text, p.display_name, p.role, p.active, u.last_sign_in_at, p.created_at
   from public.admin_profiles p join auth.users u on u.id=p.user_id order by p.created_at;
end $$;
-- Gives an EXISTING Supabase Auth user (created in Authentication -> Users) a role. Never creates accounts or passwords.
create or replace function public.assign_admin_role(p_email text, p_role text, p_name text default '')
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_id uuid;
begin
 if not public.is_super_admin() then raise exception 'Only a Super Admin can assign roles.'; end if;
 if p_role not in ('super_admin','admin','editor') then raise exception 'Invalid role.'; end if;
 select id into v_id from auth.users where lower(email)=lower(trim(p_email));
 if v_id is null then raise exception 'No Auth user with that email. Create the user in Supabase Authentication first.'; end if;
 insert into public.admin_profiles(user_id,display_name,role,active) values (v_id, coalesce(nullif(trim(p_name),''), split_part(p_email,'@',1)), p_role, true)
 on conflict (user_id) do update set role=excluded.role, display_name=coalesce(nullif(trim(p_name),''), public.admin_profiles.display_name), active=true;
end $$;
revoke all on function public.admin_directory(), public.assign_admin_role(text,text,text) from public, anon;
grant execute on function public.admin_directory(), public.assign_admin_role(text,text,text) to authenticated;

-- ---------- Storage: public-read image bucket, controlled writes ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kitspring-media','kitspring-media',true,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists media_staff_read on storage.objects;
create policy media_staff_read on storage.objects for select to authenticated using (bucket_id='kitspring-media' and public.is_admin());
drop policy if exists media_user_upload on storage.objects;
create policy media_user_upload on storage.objects for insert to authenticated with check (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists media_user_update on storage.objects;
create policy media_user_update on storage.objects for update to authenticated using (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
-- Editors may delete only their own uploads; Admin / Super Admin may delete any file in the bucket.
drop policy if exists media_user_delete on storage.objects;
create policy media_user_delete on storage.objects for delete to authenticated using (bucket_id='kitspring-media' and public.is_admin() and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin_or_super()));

-- ---------- starter settings (public, non-secret) ----------
insert into public.settings(key,value) values
 ('site','{"title":"KitSpring","description":"Practical digital resources, templates, workbooks and guides for work and everyday life."}'),
 ('contact','{"email":"kitspring@gmail.com","whatsapp":"2349128732396","phone":"","address":""}'),
 ('social','{"instagram":"","facebook":"","x":"","linkedin":"","youtube":"","tiktok":"","pinterest":""}'),
 ('announcement','{"enabled":true,"text":"The first KitSpring resources are in development. See what is coming.","link_text":"Explore the shop","link_url":"shop.html"}'),
 ('seo','{"default_title":"KitSpring | Useful ideas. Beautifully put to work.","default_description":"Practical digital resources, templates, workbooks and guides for work and everyday life.","og_image":"","site_url":""}'),
 ('newsletter','{"form_action":"","note":""}')
on conflict(key) do nothing;

-- Seed starter catalogue. Products remain coming_soon and cannot be purchased.
insert into public.collections(name,slug,description,sort_order) values
('Business','business','Practical systems and documents for independent work.',1),('Productivity','productivity','Planning tools for focused, manageable work.',2),('Lifestyle','lifestyle','Thoughtful resources for everyday routines.',3),('Creative','creative','Clear structures for creative projects.',4),('Guides','guides','Useful learning resources with practical next steps.',5)
on conflict(slug) do nothing;
insert into public.products(name,slug,collection,type,short_description,description,details,audience,includes,status,featured,price) values
('The Solo Business Operating Kit','solo-business-operating-kit','business','Complete toolkit','Bring your independent business into one clear, manageable system.','A practical operating system for independent service providers who want clearer client workflows, better pricing and more control over day-to-day operations.','Designed to organise the moving parts of a solo service business without complicated software.','Freelancers, virtual assistants, consultants, designers, developers and independent service providers', '["Business Control Centre","Client Management Documents","Client Communication Library","Pricing and Profit Toolkit","Implementation Handbook"]','coming_soon',true,null),
('Weekly Focus Planner','weekly-focus-planner','productivity','Digital planner','Plan a more intentional, workable week.','A simple planning resource for turning a busy week into realistic priorities and next actions.','A future KitSpring Productivity resource.','Professionals, students and independent workers','["Weekly overview","Priority list","Weekly reflection"]','coming_soon',false,null),
('The Everyday Reset Workbook','everyday-reset-workbook','lifestyle','Workbook','A thoughtful reset for your everyday routines.','A guided workbook concept for reviewing routines and taking small practical steps.','A future KitSpring Lifestyle resource.','Anyone seeking a more intentional routine','["Life-area check-in","Routine review","Small-step action plan"]','coming_soon',false,null),
('Creative Project Brief','creative-project-brief','creative','Template','Give good creative work a clearer starting point.','A structured brief to capture the purpose, audience, deliverables and direction of a project.','A future KitSpring Creative resource.','Designers, creators and creative teams','["Project purpose","Audience notes","Deliverables and direction"]','coming_soon',false,null),
('Digital Products: A Practical Starter Guide','digital-products-starter-guide','guides','Guide','Turn a useful idea into a well-prepared digital resource.','A beginner-friendly guide concept for shaping a useful digital product and preparing a simple launch plan.','A future KitSpring Guides resource.','Creators and aspiring digital product sellers','["Idea validation prompts","Product planning","Launch checklist"]','coming_soon',false,null)
on conflict(slug) do nothing;

insert into public.products(name,slug,collection,type,short_description,description,details,audience,includes,status,featured,price) values
('Business Control Centre','business-control-centre','business','Spreadsheet','A clearer view of the moving parts of your business.','A central workspace concept for tracking business activity, priorities, income and essential operating information.','Planned as one component of The Solo Business Operating Kit.','Solo business owners and independent professionals','["Business overview","Priority tracker","Income overview"]','coming_soon',false,null),
('Client Management Documents','client-management-documents','business','Document pack','Create a smoother, more professional client journey.','A considered set of client-facing and internal documents to support a consistent service experience.','Planned as one component of The Solo Business Operating Kit.','Freelancers, consultants and service providers','["Client intake templates","Project brief","Onboarding checklist"]','coming_soon',false,null),
('Client Communication Library','client-communication-library','business','Template library','Communicate clearly, confidently and consistently.','Reusable message frameworks for common client conversations, from first enquiry to project wrap-up.','Planned as one component of The Solo Business Operating Kit.','Client-facing independent professionals','["Enquiry responses","Project updates","Feedback and follow-up messages"]','coming_soon',false,null),
('Pricing and Profit Toolkit','pricing-profit-toolkit','business','Spreadsheet + guide','Make pricing decisions with more clarity.','A practical framework for thinking through rates, costs, workload and business sustainability.','Planned as one component of The Solo Business Operating Kit.','Freelancers and independent service providers','["Pricing worksheet","Cost planner","Profit review prompts"]','coming_soon',false,null)
on conflict(slug) do nothing;


-- FIRST SUPER ADMIN: see docs/SUPABASE-SETUP.md. Never put a service_role key in website files.
