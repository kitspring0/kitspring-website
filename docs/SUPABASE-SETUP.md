# Supabase setup and first Super Admin

## 1. Create the project
1. On your Android browser, open https://supabase.com and create a free project.
2. Choose a strong database password and keep it in a password manager. Free projects can pause after inactivity and have usage/storage limits; check the current Supabase pricing page before launch.
3. In Project Settings → API, copy the Project URL and the **anon/publishable** key. Never copy the `service_role` or secret key into website files.

## 2. Create the first account
1. In Supabase open Authentication → Users → Add user.
2. Create the first administrator account with an email you control and a strong unique password. Confirm the user if the dashboard offers that option.
3. Open that user's details and copy the Auth user UUID.
4. Open SQL Editor → New query. Paste and run the complete `supabase/schema.sql` file first.
5. Run this separate query, replacing the UUID and display name with your own values:

```sql
insert into public.admin_profiles(user_id, display_name, role, active)
values ('PASTE-AUTH-USER-UUID-HERE', 'KitSpring Owner', 'super_admin', true);
```

6. Open `https://YOUR-SITE.pages.dev/admin/`, sign in using the account created in step 2, and confirm the Overview appears.
7. Add future users under Authentication → Users first. Then use Administrators & roles in the KitSpring dashboard to assign Editor or Admin. Only the Super Admin can manage roles.

**Important:** the bootstrap SQL is a deliberate manual owner-only step. There is no public signup or public role-escalation endpoint. Do not run a role assignment for an untrusted UUID.

## 3. Configure the website
1. In the project root, open the included `config.js` file. (It is prefilled with safe placeholders.)
2. Put your Supabase Project URL and anon/publishable key into `config.js`.
3. In `admin/`, open the included `config.js` file and put the same two public values there.
4. Upload both config files to the GitHub repository. The anon key is public by design; RLS policies protect data. Never upload a service-role key.
5. Run `supabase/schema.sql` in Supabase SQL Editor. It creates the CMS tables, policies, private media bucket and starter catalogue. The starter products are all Coming Soon.

## 4. Media library
The SQL creates a private `kitspring-media` bucket, 5 MB maximum image size, and PNG/JPEG/WebP/SVG MIME restrictions. Authenticated staff upload into a folder named with their own Auth UUID. The dashboard creates one-hour signed URLs for copying. These temporary URLs expire; do not use them as permanent public product image URLs. For public images, either configure a dedicated public bucket and carefully reviewed public-read policy, or use an approved image CDN. Do not make the private admin bucket public.

## 5. Roles
- **Super Admin:** all CMS permissions and administrator role management.
- **Admin:** content and settings administration; cannot manage administrator roles.
- **Editor:** content creation and updates; cannot manage site settings/collections, delete records, or inspect the activity log.

The database uses RLS. Hiding a navigation item is not the security boundary. Never disable RLS to troubleshoot.

## 6. Public website integration
The storefront reads public products from Supabase when `config.js` is present and the database is reachable. It falls back to the bundled starter catalogue if the connection is not configured. Public products are limited by RLS to visible `published` or `coming_soon` records. A checkout link alone does not make a product purchasable: publish only after the external checkout has been tested. The product detail UI shows a purchase link only for a published product with a checkout URL.

The CMS tables for pages, posts and FAQs are available to administrators and have public-read policies for published content. Their full public-site templating/rendering is a remaining integration task; the existing static About, FAQ and Resources pages are still the visitor-facing versions in this package. Do not assume editing those CMS records currently rewrites the static page layout.
