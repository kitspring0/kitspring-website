# Supabase setup and first Super Admin

No administrator account or password is included. `/admin/` works only after you complete these steps. There is **no public sign-up**; roles are granted only by the database owner (first Super Admin) and afterwards by a Super Admin.

## 1. Create the Supabase project
1. Go to https://supabase.com, create an account and a new project. Save the database password in a password manager.
2. Project Settings → API: copy the **Project URL** and the **anon / publishable** key. Never copy the `service_role` / secret key anywhere in this website.

## 2. Run the SQL schema
1. SQL Editor → New query → paste the whole of `supabase/schema.sql` → Run. It is safe to re-run.
2. It creates the tables (`admin_profiles`, `products`, `collections`, `pages`, `posts`, `faqs`, `settings`, `activity_log`), indexes, `updated_at` triggers, Row Level Security policies, role functions, the public `kitspring-media` image bucket with storage policies, starter settings, the five collections and nine Coming Soon products.

## 3. Create the first Auth user
Authentication → Users → **Add user** → your email + a strong unique password (tick *Auto Confirm User* if offered).

## 4. Get the user's UUID
Open the user in the list and copy its **UID**.

## 5. Assign the Super Admin role
SQL Editor, new query (replace the UUID and name):
```sql
insert into public.admin_profiles(user_id, display_name, role, active)
values ('PASTE-AUTH-USER-UUID-HERE', 'Your Name', 'super_admin', true);
```
Only do this for yourself. Later staff are added from **Administrators** inside the dashboard (create their Auth user first, then assign a role by email).

## 6. Configure the website
Copy `config.example.js` to `config.js` (a placeholder `config.js` ships by default) and paste your Project URL and anon key. This one file is used by the public site **and** `/admin/`. Commit/upload it and redeploy.

## 7. Open the dashboard
Visit `https://YOUR-DOMAIN.com/admin/` and sign in. If the page shows a set-up screen, config.js still has placeholder values.

## Roles (enforced by Postgres RLS, not only by the UI)
| Capability | Editor | Admin | Super Admin |
|---|---|---|---|
| Create / edit products, pages, articles, FAQs | ✔ | ✔ | ✔ |
| Publish / unpublish / archive content | ✔ | ✔ | ✔ |
| Delete content | ✘ | ✔ | ✔ |
| Create / edit / delete collections | ✘ | ✔ | ✔ |
| Website settings | ✘ | ✔ | ✔ |
| Activity log (read) | ✘ | ✔ | ✔ |
| Upload media / delete own uploads | ✔ | ✔ | ✔ |
| Delete any media | ✘ | ✔ | ✔ |
| Manage administrators and roles | ✘ | ✘ | ✔ |

The last active Super Admin cannot be demoted, disabled or removed (database trigger).

## Public visibility rules
Anonymous visitors can read only: products with status `published` or `coming_soon` and `visible = true`; visible collections; published pages; published posts; published FAQs; and the public settings keys (`site`, `contact`, `social`, `announcement`, `seo`, `newsletter`). Drafts and archived items are never readable publicly.

## Password reset
Authentication → URL Configuration: add `https://YOUR-DOMAIN.com/admin/` to **Redirect URLs** so reset emails return to the admin. Configure SMTP for reliable delivery.
