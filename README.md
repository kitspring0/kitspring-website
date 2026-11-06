# KitSpring — Digital Goods & Resources

**Useful ideas. Beautifully put to work.**

A premium, mobile-first storefront with an initial Supabase-backed catalogue and a private administrator workspace. The existing static site has been preserved and extended rather than replaced.

## Project structure

```text
KitSpring-Website/
├── index.html, shop.html, product.html, about.html, contact.html
├── faq.html, resources.html, privacy.html, terms.html, 404.html
├── collections/                 # Five collection landing pages
├── assets/css/styles.css        # Public brand and responsive styles
├── assets/js/main.js            # Navigation, catalogue, product detail, live catalogue fetch
├── assets/js/products.js        # Offline starter catalogue fallback
├── assets/images/               # Original logo and nine product-cover SVGs
├── admin/                       # Private browser dashboard at /admin/
│   ├── index.html, admin.css, admin.js
│   └── config.example.js
├── supabase/schema.sql          # Tables, roles, RLS, storage policies and starter data
├── docs/                        # Supabase, Android deployment and checkout instructions
├── config.example.js            # Public storefront Supabase configuration template
├── _headers                     # Cloudflare Pages security headers
├── sitemap.xml, robots.txt
└── README.md
```

## Technology

- Static HTML, CSS and vanilla JavaScript for a lightweight public site.
- Supabase Auth, PostgreSQL and Storage for the CMS backend.
- Supabase JS v2 loaded from jsDelivr; public anon/publishable key only.
- Cloudflare Pages for static hosting and GitHub for source control.
- No build step and no paid runtime dependency required.

## Implemented in this package

- Existing public pages, five collection pages, responsive navigation, product search/filter/sort, product details, contact mailto form, SEO metadata, sitemap, robots file and custom 404.
- Original SVG product cover art for the nine starter resources.
- Supabase schema with products, collections, pages, posts, FAQs, settings, administrator profiles and activity log.
- RLS policies and role checks for Super Admin, Admin and Editor.
- Private Storage bucket with authenticated upload/list/delete restrictions and signed temporary URLs.
- `/admin/` sign-in, overview, product/collection/page/blog/FAQ/settings CRUD, media interface, admin-role assignment, activity view and password update.
- Public catalogue fetch from Supabase when configured, with bundled fallback if not configured.
- Secure external checkout URL handling: only HTTPS checkout URLs are rendered as purchase links.

## Requires configuration or external credentials

- Supabase project, schema execution, Auth user creation and manual first Super Admin assignment.
- Root `config.js` and `admin/config.js` created from the supplied examples.
- GitHub repository and Cloudflare Pages deployment.
- Checkout provider account, KYC, product files, external checkout links and a successful real test purchase.
- Final custom domain and replacement of `kitspring.example` canonical/sitemap placeholders.

## Not yet implemented / known limitations

These are intentionally disclosed rather than represented as complete:

1. The CMS stores website page, blog/resource and FAQ records with RLS, but the existing static About, Resources and FAQ templates are not yet dynamically rendered from those CMS records. Product catalogue changes are the public dynamic CMS path implemented here.
2. The media bucket is private. The dashboard copies one-hour signed URLs, not permanent public image URLs. The public product cover URL field expects a public HTTPS image URL or a deployed relative asset path. A dedicated public asset bucket/CDN workflow still needs to be configured before using CMS uploads as public storefront images.
3. There is no order database, payment webhook, transaction confirmation, customer account area, refund workflow or sales analytics. Checkout is an external HTTPS link only.
4. No live Supabase project is configured in this ZIP. Authentication, database policies, storage and end-to-end CMS flows cannot be certified until configured against a real project.
5. The SQL is provided for Supabase PostgreSQL and includes RLS, but it has not been executed against your project. Validate in a disposable Supabase project before production.
6. The site does not claim legal compliance for every country. Review privacy/terms against actual analytics, cookies, tax and data handling before launch.

## Quick start

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Create the first Auth user and assign the Super Admin role using `docs/SUPABASE-SETUP.md`.
4. Edit the included `config.js` placeholder and fill in the Supabase Project URL and anon/publishable key.
5. Edit the included `admin/config.js` placeholder and fill in the same public values.
6. Test locally with `python3 -m http.server 8000` and open `http://localhost:8000`.
7. Deploy the repository root to Cloudflare Pages using `docs/DEPLOYMENT-ANDROID.md`.

## Android-first instructions

Follow `docs/DEPLOYMENT-ANDROID.md` for creating a GitHub repository and deploying through the Cloudflare mobile web dashboard. Follow `docs/SUPABASE-SETUP.md` for the first administrator and CMS configuration. The dashboard is responsive for phone use, though database SQL setup is easier in landscape mode.

## Checkout

Payhip is a suitable candidate to evaluate for a Nigerian seller because its current documentation lists Paystack and Flutterwave availability in Nigeria. This is not a guarantee of an individual account's approval. See `docs/CHECKOUT.md` for published availability, fee information and the account-level verification steps. Never paste secret payment keys into browser code.

## Security notes

- Never place a Supabase service-role key, payment secret or administrator password in this repository.
- RLS is mandatory. Never disable RLS to make a dashboard query work.
- The first Super Admin is inserted by a trusted project owner in SQL after creating an Auth user. There is no public bootstrap endpoint.
- Use strong unique passwords and enable MFA in Supabase Auth where available.
- Keep the private media bucket private. Signed URLs expire.
- The `_headers` file applies baseline Cloudflare Pages security headers. Test CSP against any future external integrations before adding them.

## Local checks

```bash
node --check assets/js/main.js
node --check assets/js/products.js
node --check admin/admin.js
python3 -m http.server 8000
```

No claim is made that the site is live or connected to a configured Supabase project. Provider free-tier quotas and terms can change; check Cloudflare and Supabase dashboards before relying on them for production.
