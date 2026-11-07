-- Update the existing public contact setting without disturbing other contact fields.
-- Safe to run repeatedly: the email is set to the same value each time.
update public.settings
set value = jsonb_set(
  coalesce(value, '{}'::jsonb),
  '{email}',
  to_jsonb('kitspring411@gmail.com'::text),
  true
),
updated_at = now()
where key = 'contact';
