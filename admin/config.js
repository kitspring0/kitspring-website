/* Public Supabase project settings only. Safe to expose the anon/publishable key when RLS is enabled. */
window.KITSPRING_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};

window.KITSPRING_CONFIG_VALIDATION = {
  isPlaceholder(value) {
    return !value || /YOUR_PROJECT|YOUR_SUPABASE|example|placeholder|replace-me/i.test(String(value));
  },
  validate() {
    const url = window.KITSPRING_CONFIG?.supabaseUrl || "";
    const key = window.KITSPRING_CONFIG?.supabaseAnonKey || "";
    return !this.isPlaceholder(url) && !this.isPlaceholder(key);
  }
};
