# Deploy KitSpring from an Android phone

1. Extract `KitSpring-Complete-Website.zip` on your phone or use GitHub's web upload interface with the ZIP's extracted project contents.
2. Create a GitHub repository (private is recommended while configuring). Upload the **contents** of the `KitSpring-Website` folder so `index.html`, `_headers` and `admin/` are at repository root.
3. Create a Cloudflare account. In Workers & Pages choose Create → Pages → Connect to Git and select the repository.
4. Use Framework preset **None**, leave build command blank, and set the build output directory to `/` (repository root). Deploy.
5. Add the two `config.js` files described in `SUPABASE-SETUP.md` before testing the connected CMS.
6. Visit the `pages.dev` address and `/admin/`. Test on mobile, including login, logout, a draft product, a coming-soon product, media upload and public product visibility.
7. Add a custom domain only after you own it and have configured its DNS. Replace `https://kitspring.example/` canonical URLs in HTML and `sitemap.xml` with the final HTTPS domain.

Cloudflare Pages has a free tier with quotas and terms that can change. Supabase's free tier also has project pause, storage, database and bandwidth limits. A zero-upfront launch is possible, but neither service promises unlimited production capacity. Check provider dashboards and current terms.
