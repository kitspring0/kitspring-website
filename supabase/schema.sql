-- KitSpring production database foundation. Run in Supabase SQL Editor as project owner.
create extension if not exists pgcrypto;
create table if not exists public.admin_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', role text not null check (role in ('super_admin','admin','editor')),
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.collections (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 description text not null default '', cover_url text, sort_order integer not null default 0,
 visible boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 collection text not null check (collection in ('business','productivity','lifestyle','creative','guides')),
 type text not null default 'Digital resource', short_description text not null default '', description text not null default '',
 details text not null default '', audience text not null default '', includes jsonb not null default '[]'::jsonb,
 price numeric(12,2), currency text not null default 'USD', checkout_url text, cover_url text,
 status text not null default 'coming_soon' check(status in ('draft','published','coming_soon','archived')),
 featured boolean not null default false, visible boolean not null default true,
 seo_title text, seo_description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.pages (
 id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique,
 content text not null default '', published boolean not null default false, seo_title text, seo_description text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(), title text not null, slug text not null unique,
 excerpt text not null default '', content text not null default '', cover_url text,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 published_at timestamptz, seo_title text, seo_description text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.faqs (
 id uuid primary key default gen_random_uuid(), question text not null, answer text not null,
 sort_order integer not null default 0, published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.settings (
 id uuid primary key default gen_random_uuid(), key text not null unique, value jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
 action text not null, entity text not null, entity_id text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.current_admin_role() returns text
language sql stable security definer set search_path=public,auth
as $$ select role from public.admin_profiles where user_id=auth.uid() and active=true limit 1 $$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and active=true and role in ('super_admin','admin','editor')) $$;
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path=public,auth
as $$ select exists(select 1 from public.admin_profiles where user_id=auth.uid() and active=true and role='super_admin') $$;
grant execute on function public.current_admin_role(),public.is_admin(),public.is_super_admin() to anon,authenticated;

-- Updated timestamps are maintained by the database.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['admin_profiles','collections','products','pages','posts','faqs','settings'] loop
 execute format('drop trigger if exists touch_updated_at on public.%I',t);
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
end loop; end $$;

alter table public.admin_profiles enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.pages enable row level security;
alter table public.posts enable row level security;
alter table public.faqs enable row level security;
alter table public.settings enable row level security;
alter table public.activity_log enable row level security;

-- Prevent accidental removal/demotion of the final active Super Admin.
create or replace function public.protect_last_super_admin() returns trigger
language plpgsql security definer set search_path=public
as $$
begin
 if tg_op='DELETE' then
  if old.role='super_admin' and old.active and not exists(select 1 from public.admin_profiles where user_id<>old.user_id and role='super_admin' and active=true) then
   raise exception 'At least one active Super Admin must remain.';
  end if;
  return old;
 end if;
 if old.role='super_admin' and old.active and (new.role<>'super_admin' or new.active=false)
   and not exists(select 1 from public.admin_profiles where user_id<>old.user_id and role='super_admin' and active=true) then
  raise exception 'At least one active Super Admin must remain.';
 end if;
 return new;
end $$;
drop trigger if exists protect_last_super_admin on public.admin_profiles;
create trigger protect_last_super_admin before update or delete on public.admin_profiles
for each row execute function public.protect_last_super_admin();

-- Public storefront can only read intentionally public records.
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

-- Authenticated staff can read CMS records; editors cannot change site settings or roles.
do $$ declare t text; begin foreach t in array array['products','collections','pages','posts','faqs','settings'] loop
 execute format('drop policy if exists staff_read_%I on public.%I',t,t);
 if t='settings' then
  execute format('create policy staff_read_%I on public.%I for select to authenticated using (public.current_admin_role() in (''super_admin'',''admin''))',t,t);
 else
  execute format('create policy staff_read_%I on public.%I for select to authenticated using (public.is_admin())',t,t);
 end if;
 execute format('drop policy if exists staff_insert_%I on public.%I',t,t);
 if t='settings' or t='collections' then
  execute format('create policy staff_insert_%I on public.%I for insert to authenticated with check (public.current_admin_role() in (''super_admin'',''admin''))',t,t);
 else
  execute format('create policy staff_insert_%I on public.%I for insert to authenticated with check (public.is_admin())',t,t);
 end if;
 execute format('drop policy if exists staff_update_%I on public.%I',t,t);
 if t='settings' or t='collections' then
  execute format('create policy staff_update_%I on public.%I for update to authenticated using (public.current_admin_role() in (''super_admin'',''admin'')) with check (public.current_admin_role() in (''super_admin'',''admin''))',t,t);
 else
  execute format('create policy staff_update_%I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',t,t);
 end if;
 execute format('drop policy if exists staff_delete_%I on public.%I',t,t);
 if t='settings' or t='collections' then
  execute format('create policy staff_delete_%I on public.%I for delete to authenticated using (public.current_admin_role() in (''super_admin'',''admin''))',t,t);
 else
  execute format('create policy staff_delete_%I on public.%I for delete to authenticated using (public.current_admin_role() in (''super_admin'',''admin''))',t,t);
 end if;
end loop; end $$;

-- Admin profile access: staff can see their own row; only Super Admin manages roles.
drop policy if exists profile_self_or_super_read on public.admin_profiles;
create policy profile_self_or_super_read on public.admin_profiles for select to authenticated using (user_id=auth.uid() or public.is_super_admin());
drop policy if exists super_manage_profiles on public.admin_profiles;
create policy super_manage_profiles on public.admin_profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- No user can self-promote: profile writes are restricted to Super Admin policy above.
drop policy if exists activity_staff_read on public.activity_log;
create policy activity_staff_read on public.activity_log for select to authenticated using (public.current_admin_role() in ('super_admin','admin'));
drop policy if exists activity_staff_insert on public.activity_log;
create policy activity_staff_insert on public.activity_log for insert to authenticated with check (actor_id=auth.uid() and public.is_admin());
revoke all on public.admin_profiles,public.activity_log from anon;
grant select on public.products,public.collections,public.pages,public.posts,public.faqs to anon,authenticated;
grant select,insert,update,delete on public.products,public.collections,public.pages,public.posts,public.faqs,public.settings to authenticated;
grant select,insert on public.activity_log to authenticated;
grant select,insert,update,delete on public.admin_profiles to authenticated;

-- Media bucket: private by default. Uploads/deletes are confined to a user's own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kitspring-media','kitspring-media',false,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists media_staff_read on storage.objects;
create policy media_staff_read on storage.objects for select to authenticated using (bucket_id='kitspring-media' and public.is_admin());
drop policy if exists media_user_upload on storage.objects;
create policy media_user_upload on storage.objects for insert to authenticated with check (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists media_user_update on storage.objects;
create policy media_user_update on storage.objects for update to authenticated using (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists media_user_delete on storage.objects;
create policy media_user_delete on storage.objects for delete to authenticated using (bucket_id='kitspring-media' and public.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);

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

-- FIRST SUPER ADMIN: see docs/SUPABASE-SETUP.md. Do not expose service_role keys.
