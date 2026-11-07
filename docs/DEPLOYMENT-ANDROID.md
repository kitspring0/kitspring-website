# Deploy KitSpring from an Android phone

1. Extract the website ZIP on your phone or use GitHub's web upload interface with the extracted project contents. The currently supplied archive has a top-level `kitspring-website-main/` folder.
2. Create a GitHub repository (private is recommended while configuring). Upload the **contents inside `kitspring-website-main/`**, not the enclosing folder, so `index.html`, `_headers`, `config.js`, `supabase/` and `admin/` are at repository root. Alternatively, set Cloudflare Pages' output directory to `kitspring-website-main`.
3. Create a Cloudflare account. In Workers & Pages choose Create → Pages → Connect to Git and select the repository.
4. Use Framework preset **None**, leave build command blank, and set the build output directory to `/` (repository root). Deploy.
5. Complete the full first-admin and Supabase configuration in `SUPABASE-SETUP.md`; the single root `config.js` (shared by the website and `/admin/`) must contain real project values. The Admin login will not accept credentials until the first Super Admin profile has been created.
6. Visit the `pages.dev` address and `/admin/`. Test on mobile, including login, logout, a draft product, a coming-soon product, media upload and public product visibility.
7. Add a custom domain only after you own it and have configured its DNS. Replace `https://kitspring.example/` canonical URLs in HTML and `sitemap.xml` with the final HTTPS domain.

Cloudflare Pages has a free tier with quotas and terms that can change. Supabase's free tier also has project pause, storage, database and bandwidth limits. A zero-upfront launch is possible, but neither service promises unlimited production capacity. Check provider dashboards and current terms.
