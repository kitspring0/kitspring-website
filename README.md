# KitSpring – premium website + CMS

Static HTML/CSS/JS storefront with a Supabase-backed admin CMS, deployable to Cloudflare Pages with no build step.

**Tagline:** Useful ideas. Beautifully put to work.

## Structure
```
index.html shop.html product.html about.html contact.html resources.html post.html faq.html page.html privacy.html terms.html 404.html
collections/ business | productivity | lifestyle | creative | guides .html
admin/ index.html  admin.js  admin.css          <- canonical admin at /admin/
admin.html                                       <- redirects to /admin/ (plus _redirects rule)
assets/css/styles.css   assets/js/site.js products.js   assets/images/ (logo PNGs, product SVGs, collection art, icons, og-image)
config.js (placeholders)  config.example.js      <- ONE config for site + admin
supabase/schema.sql     docs/                    _headers _redirects robots.txt sitemap.xml site.webmanifest
```

## How content flows
Public pages read published rows directly from Supabase's REST API with the anon key (protected by RLS). If Supabase is not configured or unreachable they fall back to the bundled catalogue (`assets/js/products.js`) and built-in copy, so nothing is ever blank. Products, collections, settings (announcement bar, contact, socials, SEO), published articles, FAQs and pages are all CMS-driven. Published CMS pages with slug `about`, `privacy` or `terms` replace the built-in body; any other slug opens at `page.html?slug=…`.

## Deploy (Cloudflare Pages)
Framework preset: None. Build command: empty. Output directory: `/` (project root). See `docs/DEPLOYMENT-ANDROID.md`.

## Set-up
`docs/SUPABASE-SETUP.md`, then `docs/REMAINING-MANUAL-CONFIGURATION.md`. QA results: `docs/QA-REPORT.md`.

## Logo
The supplied logo is used throughout: `assets/images/logo.png` (header), `logo-light.png` (dark backgrounds), `logo-full*.png` (with tagline), `logo-mark*.png` and the app icons/favicons.

## Security notes
Only the anon key is used in the browser; roles are enforced by RLS; checkout URLs must be HTTPS (UI + DB constraint); all CMS text is escaped before rendering; `/admin/*` is `noindex` and `no-store`.
