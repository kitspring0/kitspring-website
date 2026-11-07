# KitSpring QA report

Date: 7 November 2026. Tested with Chromium (Playwright) against a local static server, desktop 1366×900 and mobile 390×844 emulation.

## Results
| # | Check | Result |
|---|---|---|
| 1 | HTML well-formedness (19 files: tags balanced, doctype, no duplicate ids) | Pass. This is a structural check, **not** the W3C validator. |
| 2 | JavaScript syntax (`node --check`, 5 files) | Pass |
| 3 | CSS brace balance (2 files) | Pass (structural only) |
| 4 | JSON (`site.webmanifest`) | Pass |
| 5 | Sitemap XML parses, 22 URLs, every target exists | Pass |
| 6–7 | Internal links and asset references (637 checked) | 0 broken |
| 8 | Admin route: `/admin/` opens; `/admin.html` redirects to `/admin/`; homepage and footer link to `admin/` | Pass |
| 9 | Config validation: placeholders → set-up screen with no connection attempt; secret/service-role key refused by both site and admin | Pass |
| 10 | Admin UI (31 checks, **mock Supabase client**): login form, show/hide password, wrong-password error, sign-in, dashboard, product/FAQ/page/post/collection create, validation (non-HTTPS checkout rejected), publish/unpublish/archive/delete, settings save, media page, administrators page, activity log, password-mismatch, sign-out, editor role restrictions, mobile admin menu | 31/31 pass |
| 11 | Public site (49 checks): all 16 public pages on desktop and mobile with no JS errors and no horizontal scroll; mobile menu; shop search/filter/sort/empty state; product states; header search; CMS integration with mocked REST (products→shop/collection/product page with HTTPS Buy button, announcement, FAQ, articles, CMS page overriding About); Supabase failure → bundled catalogue still shown | 49/49 pass |
| 12 | Database schema review (manual): RLS on all 8 tables, public read limited to published/visible rows, editor/admin/super-admin split, immutable activity log, last-Super-Admin trigger, HTTPS/price/slug constraints, storage policies | Reviewed, **not executed** |

## NOT verified (be clear about these)
- **No live Supabase project was available.** Real authentication, real RLS behaviour, storage uploads and the SQL file itself were **not executed**. The admin and CMS tests used an in-memory mock of the Supabase client; they prove the interface logic, not the server. Run the schema and a real sign-in before launch. No successful real login is claimed.
- `schema.sql` was not run against PostgreSQL (none available here); it is reviewed by reading only. If Supabase reports an error, send it for a fix.
- Google Fonts and the pinned supabase-js CDN script could not load in the offline test environment (fonts fell back to system fonts; the library was stubbed). Verify both in a real browser.
- Mobile checks used Chromium device emulation, not a physical Android phone.
- No Lighthouse/performance audit, no screen-reader testing, no cross-browser testing (Firefox/Safari).
- Real checkout, email delivery and password-reset emails depend on your own provider setup.

## Known limitations
- Product, article and CMS page URLs use query strings (`product.html?slug=…`) because the site is static. Search engines can index them but dedicated pre-rendered pages would be stronger for SEO.
- Canonical URLs use the placeholder `https://kitspring.example` until you replace it (see REMAINING-MANUAL-CONFIGURATION.md).
- Roles are enforced by RLS, but an Editor can publish content (not delete). Tighten the policies if you want publishing to be Admin-only.
