# Remaining manual configuration

Things only you can do, in order of importance:

1. **Supabase** – follow `SUPABASE-SETUP.md` (project, schema, first user, Super Admin SQL, `config.js`).
2. **Domain** – every canonical URL, `og:url`, `sitemap.xml` and `robots.txt` uses the placeholder `https://kitspring.example`. After you know your domain run, from the project root:
   `grep -rl "kitspring.example" . | xargs sed -i 's#https://kitspring.example#https://YOUR-DOMAIN.com#g'`
3. **Supabase Auth redirect URL** – add `https://YOUR-DOMAIN.com/admin/` (needed for password-reset emails).
4. **Checkout** – create products in Payhip (or another provider), paste each HTTPS checkout URL into the product, set a price, then set status **Published**. A Buy button appears only when status = Published, price is set and the URL is HTTPS. See `CHECKOUT.md`. Do a real low-value test purchase first.
5. **Newsletter** – no email service is bundled, so no fake form is shown. To enable one, paste your provider's HTTPS form action URL in Admin → Website settings → Email updates, and add that provider's domain to `form-action` in `_headers`.
6. **Social links, phone, address** – Admin → Website settings.
7. **Legal pages** – the Privacy Policy and Terms are starter texts; get them reviewed before launch. You can replace them from Admin → Website pages using the slugs `privacy` and `terms`.
8. **Content** – publish your first articles and FAQs (the site shows honest "coming soon" placeholders until then).
9. **Optional hardening** – self-host `supabase-js` and Google Fonts if you want a stricter CSP, and add Subresource Integrity to the pinned jsDelivr script tag in `admin/index.html`.
