/* Copy this file to config.js and paste your PUBLIC Supabase values (Project Settings -> API).
   Only the Project URL and the anon / publishable key belong here. The anon key is designed for browsers;
   Row Level Security in supabase/schema.sql protects the data.
   NEVER put a service_role or secret key in this file: the site and admin refuse to use one. */
window.KITSPRING_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};
