# KitSpring official contact email update

The sole official public KitSpring contact email is **kitspring411@gmail.com**. The public contact address is separate from the email used to sign in to Supabase Auth.

## Existing Supabase projects

Changing the starter value in `supabase/schema.sql` does not update an existing settings record: the schema seed intentionally uses `ON CONFLICT DO NOTHING`. Run the following migration in the existing Supabase project's **SQL Editor** (or run `supabase/migrations/202611070001_update_kitspring_contact_email.sql` there). This changes only the `email` JSON field on the existing `public.settings` row with `key = 'contact'`, preserves WhatsApp, phone, address, and other fields, and refreshes `updated_at`. It is safe to run more than once.

```sql
update public.settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{email}',
  to_jsonb('kitspring411@gmail.com'::text),
  true
),
updated_at = now()
where key = 'contact';
```

Run this against the existing project's database. Do not rely on rerunning `schema.sql` to update existing contact settings.

## Supabase administrator sign-in

Changing the public contact email does not change any administrator's Supabase Auth identity. The project owner can optionally change the login email in **Supabase Dashboard → Authentication → Users**: select the relevant user and update its email using the dashboard's user-management controls. Complete any email verification Supabase requires. No administrator account needs to be deleted or recreated, and the website should not modify `auth.users` from browser JavaScript. Do not place administrator login credentials in website configuration.
