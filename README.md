# KitSpring website

A lightweight, responsive, static website for KitSpring — Digital Goods & Resources.

**Brand line:** Useful ideas. Beautifully put to work.

## What's included

- Homepage, shop/catalogue and reusable product-detail page
- Five collection pages: Business, Productivity, Lifestyle, Creative and Guides
- About, Contact, FAQ, Privacy Policy, Terms of Use, Resources/Blog and custom 404
- Responsive navigation and mobile menu
- Client-side product search, collection filtering and sorting
- Product data in `assets/js/products.js`
- Brand wordmark SVG, favicon, sitemap, robots.txt and web manifest
- SEO titles, descriptions, canonical placeholders and Open Graph basics
- No backend, database, authentication, paid service or fake checkout

## Important launch configuration

1. Replace every `https://kitspring.example/` canonical URL in the HTML and `sitemap.xml` with the final custom domain. If you do not have a domain yet, temporarily remove canonical tags rather than publish the placeholder.
2. Review the Privacy Policy and Terms of Use for your actual operations and obtain legal review where appropriate.
3. Products are intentionally marked `coming-soon`. They cannot be purchased from this site.
4. When a product is genuinely ready, edit its record in `assets/js/products.js`: set `"status": "available"` and add `"checkoutUrl": "https://your-real-checkout-url"`. The product detail page will then show a purchase link. Do not set a product to available until checkout is live and tested.
5. The contact form uses the visitor's email application via `mailto:`. It does not store or transmit form submissions to a server.
6. Google Fonts are loaded externally; system-font fallbacks remain available.

## Local preview

Open `index.html` in a browser. Or run a local server from this folder:

```bash
python3 -m http.server 8000
```

Visit `http://localhost:8000`.

## Deploy free with Cloudflare Pages

1. Create a GitHub repository named `kitspring-website`.
2. Upload the **contents** of this folder to the repository root. `index.html` must be at the root, not inside an extra nested folder.
3. In Cloudflare Dashboard, open **Workers & Pages → Create → Pages → Connect to Git**.
4. Select the GitHub repository.
5. Framework preset: **None**. Build command: leave blank. Build output directory: `/` (or repository root, depending on the current Cloudflare interface).
6. Deploy. Cloudflare will provide a `*.pages.dev` address.
7. Test the live site on mobile and desktop. Add a custom domain only when you own/configure it, then update canonical URLs and sitemap.

## Checkout provider note

Payhip is not connected in this build. Before choosing it, independently verify current Nigerian seller eligibility, supported payout methods and currencies, international card acceptance, fees and payout timing. No payment or checkout capability is implied by this website.
