# KitSpring website

A lightweight, dependency-free static website for KitSpring, ready to deploy on Cloudflare Pages.

## Run locally

Open `index.html` in a browser, or serve this directory with any static file server. There is no build step.

## Deploy to Cloudflare Pages

Create a Pages project connected to this repository. Use the repository root (`/`) as the build output directory and leave the build command empty. The site consists of static HTML, CSS, and JavaScript files.

## Configure the storefront

When the external shop is live, set `STOREFRONT_URL` near the top of `script.js` to its real URL. Shop links are intentionally hidden while this value is blank; the page will show a coming-soon message instead.

## Fonts

Manrope and Inter are loaded from Google Fonts with system fallbacks. If self-hosting is preferred, replace the font link in `index.html` and provide local font files.
