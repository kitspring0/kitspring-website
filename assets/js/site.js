/* KitSpring public site runtime. Reads published CMS content from Supabase (public REST, anon key + RLS)
   and falls back to the bundled catalogue when Supabase is not configured or unreachable. */
(() => {
  'use strict';
  const D = document, BASE = D.documentElement.dataset.base || '', PAGE = D.body.dataset.page || '';
  const $ = (s, r = D) => r.querySelector(s), $$ = (s, r = D) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- configuration ---------- */
  const CFG = window.KITSPRING_CONFIG || {};
  const jwtRole = k => { try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch (e) { return ''; } };
  const keyIsSecret = k => /^sb_secret_/.test(k) || jwtRole(k) === 'service_role';
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(CFG.supabaseUrl || '') && (CFG.supabaseAnonKey || '').length > 30 && !/YOUR_|PLACEHOLDER/i.test((CFG.supabaseUrl || '') + (CFG.supabaseAnonKey || ''));
  const usable = configured && !keyIsSecret(CFG.supabaseAnonKey);
  if (configured && !usable) console.error('KitSpring: a secret/service-role key was found in config.js. It has been ignored. Use only the anon/publishable key.');
  const API = usable ? CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' : '';
  async function rest(table, query) {
    if (!usable) throw new Error('not-configured');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch(API + table + '?' + query, { headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey }, signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const memo = {}; const once = (k, fn) => memo[k] || (memo[k] = fn());

  /* ---------- helpers ---------- */
  const https = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
  const asset = u => { if (!u) return ''; if (/^https:\/\//i.test(u)) return u; if (/^(javascript|data|http):/i.test(u)) return ''; return BASE + u.replace(/^\//, ''); };
  const fmtPrice = p => { if (p.price == null || p.price === '') return null; try { return new Intl.NumberFormat('en', { style: 'currency', currency: p.currency || 'USD', maximumFractionDigits: 2 }).format(p.price); } catch (e) { return p.currency + ' ' + p.price; } };
  const COLL_DEFAULT = [
    { slug: 'business', name: 'Business', description: 'Practical systems and documents for independent work.', cover: 'assets/images/collections/business.svg', sort: 1 },
    { slug: 'productivity', name: 'Productivity', description: 'Planning tools for focused, manageable work.', cover: 'assets/images/collections/productivity.svg', sort: 2 },
    { slug: 'lifestyle', name: 'Lifestyle', description: 'Thoughtful resources for everyday routines.', cover: 'assets/images/collections/lifestyle.svg', sort: 3 },
    { slug: 'creative', name: 'Creative', description: 'Clear structures for creative projects.', cover: 'assets/images/collections/creative.svg', sort: 4 },
    { slug: 'guides', name: 'Guides', description: 'Useful learning resources with practical next steps.', cover: 'assets/images/collections/guides.svg', sort: 5 }];
  const FAQ_DEFAULT = [
    ['What is KitSpring?', 'KitSpring is an independent digital-products brand creating practical resources for work and everyday life.'],
    ['What kinds of products will you offer?', 'The catalogue is planned to include spreadsheets, templates, workbooks, PDFs, guides and toolkits across five collections.'],
    ['Can I purchase every item shown?', 'Not yet. Items labelled Coming Soon are in development and cannot currently be purchased. A purchase link will appear only when a product is genuinely available.'],
    ['How will I receive a digital product?', 'Delivery details will be shown on the product page and at the external checkout when a product is released.'],
    ['What payment methods do you accept?', 'Payment methods will depend on the checkout provider configured for each released product. We will publish accurate details before accepting orders.'],
    ['Can I request a custom resource?', 'You can contact us with your idea. We cannot guarantee that every request will become a product.'],
    ['How can I contact KitSpring?', 'Email kitspring@gmail.com or message us on WhatsApp at +234 912 873 2396.']].map((q, i) => ({ id: 'f' + i, question: q[0], answer: q[1], sort: i }));
  const POST_DEFAULT = [
    { tag: 'Business foundations', title: 'Build a business that is easier to run', excerpt: 'A practical look at the simple systems that help independent service providers keep track of clients, work and money.' },
    { tag: 'Productivity', title: 'Planning for progress, not perfection', excerpt: 'Why a useful plan starts with realistic priorities and a clear next action.' },
    { tag: 'Digital products', title: 'Make the useful thing first', excerpt: 'Start with a real problem, understand who experiences it and shape a resource around a practical outcome.' }];
  const SET_DEFAULT = {
    site: { title: 'KitSpring', description: 'Practical digital resources, templates, workbooks and guides for work and everyday life.' },
    contact: { email: 'kitspring@gmail.com', whatsapp: '2349128732396', phone: '', address: '' },
    social: { instagram: '', facebook: '', x: '', linkedin: '', youtube: '', tiktok: '', pinterest: '' },
    announcement: { enabled: true, text: 'The first KitSpring resources are in development. See what is coming.', link_text: 'Explore the shop', link_url: 'shop.html' },
    seo: { default_title: 'KitSpring | Useful ideas. Beautifully put to work.', default_description: 'Practical digital resources, templates, workbooks and guides for work and everyday life.', og_image: '', site_url: '' },
    newsletter: { form_action: '', note: '' } };

  /* ---------- data layer ---------- */
  const normProduct = r => {
    const slug = r.slug || r.id, local = (window.KITSPRING_PRODUCTS || []).find(x => x.id === slug);
    const st = String(r.status || 'coming_soon').replace('-', '_');
    return { slug, name: r.name, collection: r.collection, type: r.type || 'Digital resource', short: r.short_description ?? r.shortDescription ?? '', description: r.description || '', details: r.details || '', audience: r.audience || '',
      includes: Array.isArray(r.includes) ? r.includes : [], price: r.price == null ? null : Number(r.price), currency: r.currency || 'USD', checkout: https(r.checkout_url || r.checkoutUrl || ''),
      cover: r.cover_url || r.coverUrl || (local && local.coverUrl) || 'assets/images/placeholder-cover.svg', status: st, featured: !!r.featured, seoTitle: r.seo_title || '', seoDesc: r.seo_description || '' };
  };
  const buyable = p => p.status === 'published' && p.price != null && !!p.checkout;
  const getProducts = () => once('products', async () => {
    if (usable) { try { const rows = await rest('products', 'select=*&status=in.(published,coming_soon)&visible=eq.true&order=featured.desc,created_at.asc'); return { list: rows.map(normProduct), live: true }; } catch (e) { console.warn('KitSpring: using local catalogue (' + e.message + ')'); } }
    return { list: (window.KITSPRING_PRODUCTS || []).map(normProduct), live: false };
  });
  const getCollections = () => once('colls', async () => {
    let rows = null; if (usable) { try { rows = await rest('collections', 'select=*&visible=eq.true&order=sort_order.asc'); } catch (e) { } }
    if (!rows) return COLL_DEFAULT;
    return rows.map(c => { const d = COLL_DEFAULT.find(x => x.slug === c.slug) || {}; return { slug: c.slug, name: c.name, description: c.description || d.description || '', cover: c.cover_url || d.cover || 'assets/images/placeholder-cover.svg', sort: c.sort_order }; });
  });
  const getSettings = () => once('settings', async () => {
    const s = JSON.parse(JSON.stringify(SET_DEFAULT));
    if (usable) { try { (await rest('settings', 'select=key,value')).forEach(r => { if (s[r.key] && r.value && typeof r.value === 'object') Object.assign(s[r.key], r.value); }); } catch (e) { } }
    return s;
  });
  const getPosts = (limit = 50) => once('posts' + limit, async () => { if (!usable) return null; try { return await rest('posts', 'select=id,title,slug,excerpt,cover_url,published_at,created_at&status=eq.published&order=published_at.desc.nullslast&limit=' + limit); } catch (e) { return null; } });
  const getFaqs = () => once('faqs', async () => { if (usable) { try { const r = await rest('faqs', 'select=*&published=eq.true&order=sort_order.asc'); return r.map(x => ({ id: x.id, question: x.question, answer: x.answer })); } catch (e) { } } return FAQ_DEFAULT; });
  const getOne = async (table, slug, extra) => { if (!usable) return null; try { const r = await rest(table, 'select=*&slug=eq.' + encodeURIComponent(slug) + (extra || '') + '&limit=1'); return r[0] || null; } catch (e) { return undefined; } };

  /* ---------- markdown-lite (escaped first, so safe) ---------- */
  function md(src) {
    const inline = t => t.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/|#)[^\s)]*)\)/g, (m, a, u) => '<a href="' + u + '"' + (/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + a + '</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    const out = []; let list = null, para = [];
    const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const close = () => { if (list) { out.push('</' + list + '>'); list = null; } };
    esc(src || '').split(/\r?\n/).forEach(l => {
      let m;
      if (!l.trim()) { flush(); close(); }
      else if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flush(); close(); const n = m[1].length === 1 ? 2 : m[1].length; out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); }
      else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { flush(); if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { flush(); if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if ((m = l.match(/^&gt;\s?(.*)/))) { flush(); close(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); }
      else { close(); para.push(l.trim()); }
    });
    flush(); close(); return out.join('\n');
  }
  window.KitSpringMd = md;

  /* ---------- meta ---------- */
  function setMeta(title, desc, img, canonicalPath) {
    if (title) { D.title = title; $('meta[property="og:title"]')?.setAttribute('content', title); }
    if (desc) { $('meta[name=description]')?.setAttribute('content', desc); $('meta[property="og:description"]')?.setAttribute('content', desc); }
    if (img) $('meta[property="og:image"]')?.setAttribute('content', img);
    if (canonicalPath) { const l = $('link[rel=canonical]'); if (l) { try { l.href = new URL(canonicalPath, l.href).href; } catch (e) { } } }
  }

  /* ---------- components ---------- */
  const collName = (slug, colls) => (colls.find(c => c.slug === slug) || {}).name || slug;
  function card(p, colls) {
    const price = fmtPrice(p), ok = buyable(p), href = BASE + 'product.html?slug=' + encodeURIComponent(p.slug);
    return `<article class="pcard"><a class="cover" href="${href}" aria-label="View ${esc(p.name)}"><img src="${esc(asset(p.cover))}" alt="${esc(p.name)} cover" loading="lazy" width="720" height="480"><span class="badge ${ok ? 'ok' : 'gold'}">${ok ? 'Available' : 'Coming soon'}</span></a>
<div class="body"><div class="meta"><span>${esc(collName(p.collection, colls))}</span><span>${esc(p.type)}</span></div><h3><a href="${href}">${esc(p.name)}</a></h3><p>${esc(p.short || p.description)}</p>
<div class="foot">${price ? `<span class="price">${esc(price)}</span>` : '<span class="price none">Price to follow</span>'}<a class="btn btn-sm btn-outline" href="${href}">View details</a></div></div></article>`;
  }
  const state = (t, m) => `<div class="state"><strong>${esc(t)}</strong>${esc(m)}</div>`;
  const skeletons = n => Array.from({ length: n }, () => '<div class="skeleton"></div>').join('');
  const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  function postCard(p) {
    const href = BASE + 'post.html?slug=' + encodeURIComponent(p.slug);
    const img = p.cover_url ? `<img src="${esc(asset(p.cover_url))}" alt="" loading="lazy">` : `<div class="ph"><img src="${BASE}assets/images/logo-mark-light.png" alt=""></div>`;
    return `<article class="post"><a href="${href}" tabindex="-1" aria-hidden="true">${img}</a><div class="body"><time datetime="${esc(p.published_at || p.created_at || '')}">${esc(fmtDate(p.published_at || p.created_at))}</time><h3><a href="${href}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p><a class="link-arrow" href="${href}">Read article</a></div></article>`;
  }
  const postSoon = p => `<article class="post"><div class="ph"><img src="${BASE}assets/images/logo-mark-light.png" alt=""></div><div class="body"><span class="tag">${esc(p.tag)} · Coming soon</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p></div></article>`;
  const faqHtml = list => '<div class="faq">' + list.map(f => `<details><summary>${esc(f.question)}</summary><div class="ans">${md(f.answer)}</div></details>`).join('') + '</div>';

  /* ---------- global: nav, search, settings ---------- */
  let panel, lastFocus;
  function closeSearch() { if (panel && panel.classList.contains('open')) { panel.classList.remove('open'); lastFocus && lastFocus.focus(); } }
  function initNav() {
    const t = $('#menuToggle'), n = $('#primaryNav'); if (!t || !n) return;
    const set = o => { n.classList.toggle('open', o); t.setAttribute('aria-expanded', o); t.setAttribute('aria-label', o ? 'Close navigation menu' : 'Open navigation menu'); };
    t.addEventListener('click', () => set(!n.classList.contains('open')));
    D.addEventListener('keydown', e => { if (e.key === 'Escape') { set(false); closeSearch(); } });
    n.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  }
  function initSearch() {
    $$('[data-open-search]').forEach(b => b.addEventListener('click', async () => {
      lastFocus = b;
      if (!panel) {
        panel = D.createElement('div'); panel.className = 'search-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Search KitSpring');
        panel.innerHTML = `<div class="search-box"><form role="search" action="${BASE}shop.html"><input type="search" name="q" placeholder="Search resources, collections, types…" aria-label="Search" autocomplete="off"><button type="button" data-close>Close</button></form><div class="search-results" aria-live="polite"></div></div>`;
        D.body.appendChild(panel);
        const inp = $('input', panel), res = $('.search-results', panel);
        panel.addEventListener('click', e => { if (e.target === panel || e.target.dataset.close !== undefined) closeSearch(); });
        inp.addEventListener('input', async () => {
          const q = inp.value.trim().toLowerCase(); if (!q) { res.innerHTML = ''; return; }
          const { list } = await getProducts(), colls = await getCollections();
          const hits = list.filter(p => [p.name, p.short, p.type, p.collection, p.description].join(' ').toLowerCase().includes(q)).slice(0, 6);
          res.innerHTML = hits.length ? hits.map(p => `<a href="${BASE}product.html?slug=${encodeURIComponent(p.slug)}"><img src="${esc(asset(p.cover))}" alt=""><span><strong>${esc(p.name)}</strong><small>${esc(collName(p.collection, colls))} · ${esc(p.type)}</small></span></a>`).join('') : `<div class="search-empty">No resources match “${esc(inp.value)}”. Press Enter to search the shop.</div>`;
        });
      }
      panel.classList.add('open'); $('input', panel).focus();
    }));
  }
  async function applySettings() {
    const s = await getSettings(), a = s.announcement, bar = $('#announce');
    if (bar) { if (a.enabled && a.text) { const lu = a.link_url && (https(a.link_url) || (!/^[a-z]+:/i.test(a.link_url) && a.link_url)); bar.innerHTML = esc(a.text) + (lu && a.link_text ? ` <a href="${esc(/^https:/.test(lu) ? lu : BASE + lu.replace(/^\//, ''))}">${esc(a.link_text)}</a>` : ''); bar.hidden = false; } else bar.hidden = true; }
    const c = s.contact;
    $$('.js-email').forEach(e => { e.textContent = c.email; e.href = 'mailto:' + c.email; });
    $$('.js-wa').forEach(e => { if (c.whatsapp) e.href = 'https://wa.me/' + String(c.whatsapp).replace(/\D/g, ''); });
    $$('.js-phone').forEach(e => { if (c.phone) { e.textContent = c.phone; e.hidden = false; e.href = 'tel:' + c.phone.replace(/[^\d+]/g, ''); } });
    $$('.js-address').forEach(e => { if (c.address) { e.textContent = c.address; e.hidden = false; } });
    $$('.js-brand-desc').forEach(e => { if (s.site.description) e.textContent = s.site.description; });
    const names = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest' };
    $$('.js-socials').forEach(e => { e.innerHTML = Object.keys(names).filter(k => https(s.social[k])).map(k => `<a href="${esc(https(s.social[k]))}" target="_blank" rel="noopener noreferrer">${names[k]}</a>`).join(''); });
    if (PAGE === 'home' && s.seo.default_title) setMeta(s.seo.default_title, s.seo.default_description, https(s.seo.og_image));
    return s;
  }

  /* ---------- pages ---------- */
  async function loadGrid(el, { filter, limit, sort } = {}) {
    el.innerHTML = skeletons(Math.min(limit || 3, 3)); el.setAttribute('aria-busy', 'true');
    const [{ list }, colls] = await Promise.all([getProducts(), getCollections()]);
    let items = filter ? list.filter(filter) : list.slice(); if (sort) items.sort(sort); if (limit) items = items.slice(0, limit);
    el.innerHTML = items.length ? items.map(p => card(p, colls)).join('') : state('Nothing here yet', 'New resources will appear as soon as they are published.'); el.removeAttribute('aria-busy');
    return items;
  }
  const featFirst = (a, b) => (b.featured - a.featured);

  async function pHome() {
    loadGrid($('#featuredProducts'), { limit: 3, sort: featFirst });
    const colls = await getCollections(), row = $('#collRow');
    if (row) row.innerHTML = colls.slice(0, 5).map(c => `<a class="coll-tile" href="${BASE}collections/${esc(c.slug)}.html"><img src="${esc(asset(c.cover))}" alt="" loading="lazy" width="640" height="480"><div><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><span>Browse ${esc(c.name)} →</span></div></a>`).join('');
    const { list } = await getProducts(), fl = $('#flagship'), f = list.find(p => p.featured) || list[0];
    if (fl && f) {
      const price = fmtPrice(f), ok = buyable(f), other = list.find(p => p.slug !== f.slug);
      $('[data-f-art]', fl).innerHTML = `<img src="${esc(asset(f.cover))}" alt="${esc(f.name)} cover" loading="lazy" width="720" height="480">` + (other ? `<img class="mini" src="${esc(asset(other.cover))}" alt="" loading="lazy">` : '');
      $('[data-f-body]', fl).innerHTML = `<div class="eyebrow">${ok ? 'Flagship resource' : 'Flagship resource · Coming soon'}</div><h2>${esc(f.name)}</h2><p class="lead">${esc(f.description || f.short)}</p>${f.includes.length ? `<ul class="checks">${f.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}${f.audience ? `<p class="muted"><strong>Designed for:</strong> ${esc(f.audience)}</p>` : ''}<div class="hero-actions"><a class="btn" href="${BASE}product.html?slug=${encodeURIComponent(f.slug)}">View resource details</a>${price ? `<span class="price" style="align-self:center">${esc(price)}</span>` : ''}</div>`;
    } else if (fl) fl.hidden = true;
    const pe = $('#homePosts'); if (pe) { const posts = await getPosts(3); pe.innerHTML = posts && posts.length ? posts.map(postCard).join('') : POST_DEFAULT.map(postSoon).join(''); }
    const fe = $('#homeFaqs'); if (fe) fe.innerHTML = faqHtml((await getFaqs()).slice(0, 5));
    const s = await getSettings(), nl = $('#updatesBody');
    if (nl) { const fa = https(s.newsletter.form_action); nl.innerHTML = fa ? `<form action="${esc(fa)}" method="post" target="_blank" rel="noopener"><label class="sr-only" for="nlEmail">Email address</label><input class="field" id="nlEmail" name="email" type="email" required placeholder="Your email address"><button class="btn" type="submit">Subscribe</button></form><p class="muted" style="font-size:.85rem;margin-top:12px">${esc(s.newsletter.note || 'You will be taken to our email provider to confirm your subscription.')}</p>` : `<p>Our email list is not open yet. To hear first when a resource is released, send us a short note and we will keep you informed.</p><a class="btn" href="mailto:${esc(s.contact.email)}?subject=${encodeURIComponent('Please notify me about new KitSpring resources')}">Ask to be notified</a>`; }
  }

  async function pShop() {
    const grid = $('#productGrid'), q = $('#productSearch'), cf = $('#collectionFilter'), so = $('#sortProducts'), note = $('#resultsNote');
    const params = new URLSearchParams(location.search);
    grid.innerHTML = skeletons(3);
    const [{ list, live }, colls] = await Promise.all([getProducts(), getCollections()]);
    cf.innerHTML = '<option value="all">All collections</option>' + colls.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
    q.value = params.get('q') || ''; if (colls.some(c => c.slug === params.get('collection'))) cf.value = params.get('collection');
    const render = () => {
      const term = q.value.trim().toLowerCase(); let items = list.filter(p => (cf.value === 'all' || p.collection === cf.value) && (!term || [p.name, p.short, p.description, p.type, p.audience, collName(p.collection, colls)].join(' ').toLowerCase().includes(term)));
      const m = so.value; items.sort(m === 'az' ? (a, b) => a.name.localeCompare(b.name) : m === 'za' ? (a, b) => b.name.localeCompare(a.name) : m === 'low' ? (a, b) => (a.price ?? 1e12) - (b.price ?? 1e12) : m === 'avail' ? (a, b) => buyable(b) - buyable(a) : featFirst);
      note.textContent = items.length ? `Showing ${items.length} of ${list.length} resource${list.length === 1 ? '' : 's'}` + (live ? '' : ' · bundled catalogue') : '';
      grid.innerHTML = items.length ? items.map(p => card(p, colls)).join('') : state('No resources found', term ? 'Try a different search term or choose another collection.' : 'There are no published resources in this collection yet.');
      const u = new URL(location.href); term ? u.searchParams.set('q', q.value.trim()) : u.searchParams.delete('q'); cf.value !== 'all' ? u.searchParams.set('collection', cf.value) : u.searchParams.delete('collection'); history.replaceState(null, '', u);
    };
    [q, cf, so].forEach(e => e.addEventListener('input', render)); render();
  }
  async function pCollection() {
    const slug = D.body.dataset.collection;
    loadGrid($('#productGrid'), { filter: p => p.collection === slug, sort: featFirst });
    const c = (await getCollections()).find(x => x.slug === slug), d = $('[data-coll-desc]');
    if (c && d && c.description) d.textContent = c.description;
  }
  async function pProduct() {
    const root = $('#productDetail'), params = new URLSearchParams(location.search), slug = params.get('slug') || params.get('id');
    root.innerHTML = skeletons(1);
    const [{ list }, colls, st] = await Promise.all([getProducts(), getCollections(), getSettings()]);
    const p = list.find(x => x.slug === slug);
    if (!p) { root.innerHTML = state('Resource not found', 'This resource may have moved or is no longer available.') + '<p style="text-align:center"><a class="btn" href="shop.html">Browse the shop</a></p>'; setMeta('Resource not found | KitSpring'); return; }
    const price = fmtPrice(p), ok = buyable(p), cn = collName(p.collection, colls);
    setMeta((p.seoTitle || p.name) + ' | KitSpring', p.seoDesc || p.short || p.description, https(asset(p.cover)), 'product.html?slug=' + encodeURIComponent(p.slug));
    $('#crumbName').textContent = p.name;
    const cta = ok ? `<a class="btn btn-gold" href="${esc(p.checkout)}" target="_blank" rel="noopener noreferrer">Buy securely <span aria-hidden="true">↗</span></a>` : `<span class="btn" aria-disabled="true">Not yet available</span>`;
    root.innerHTML = `<div class="pd"><div class="pd-cover"><img src="${esc(asset(p.cover))}" alt="${esc(p.name)} cover" width="720" height="480"></div><div>
<span class="badge ${ok ? 'ok' : 'gold'}">${ok ? 'Available' : 'Coming soon'}</span><h1 style="margin-top:16px">${esc(p.name)}</h1><p class="lead">${esc(p.short)}</p>
<div class="priceline">${price ? `<span class="price">${esc(price)}</span>` : '<span class="price none">Price to follow</span>'}${cta}</div>
${ok ? '<p class="muted" style="font-size:.88rem">You will complete payment on the checkout provider’s secure page. Delivery follows the arrangement shown at checkout.</p>' : '<p class="muted" style="font-size:.88rem">This resource is not currently available to buy. A purchase option will appear here only when it is ready.</p>'}
<div class="prose">${md(p.description)}${p.details ? `<p>${esc(p.details)}</p>` : ''}</div>
<dl><dt>Collection</dt><dd><a class="link-arrow" href="collections/${esc(p.collection)}.html">${esc(cn)}</a></dd><dt>Format</dt><dd>${esc(p.type)}</dd>${p.audience ? `<dt>For</dt><dd>${esc(p.audience)}</dd>` : ''}</dl>
${p.includes.length ? `<h3>What it includes</h3><ul class="checks">${p.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
<p class="muted">Questions about this resource? <a class="link-arrow js-email" href="mailto:${esc(st.contact.email)}">${esc(st.contact.email)}</a></p></div></div>
<section style="margin-top:80px"><h2>More from ${esc(cn)}</h2><div class="product-grid" id="related"></div></section>`;
    const rel = list.filter(x => x.collection === p.collection && x.slug !== p.slug).slice(0, 3);
    $('#related').innerHTML = rel.length ? rel.map(x => card(x, colls)).join('') : state('More to come', 'Explore the rest of the catalogue in the shop.');
  }
  async function pResources() {
    const g = $('#postGrid'); g.innerHTML = skeletons(3); const posts = await getPosts(50);
    g.innerHTML = posts && posts.length ? posts.map(postCard).join('') : POST_DEFAULT.map(postSoon).join('');
  }
  async function pPost() {
    const root = $('#postBody'), slug = new URLSearchParams(location.search).get('slug'); root.innerHTML = skeletons(1);
    const p = slug && await getOne('posts', slug, '&status=eq.published');
    if (!p) { root.innerHTML = state('Article not found', 'It may have been unpublished or moved.') + '<p style="text-align:center"><a class="btn" href="resources.html">Back to resources</a></p>'; setMeta('Article not found | KitSpring'); return; }
    setMeta((p.seo_title || p.title) + ' | KitSpring', p.seo_description || p.excerpt, https(asset(p.cover_url)), 'post.html?slug=' + encodeURIComponent(p.slug));
    $('#postTitle').textContent = p.title; $('#postExcerpt').textContent = p.excerpt; $('#postDate').textContent = fmtDate(p.published_at || p.created_at);
    root.innerHTML = (p.cover_url ? `<img src="${esc(asset(p.cover_url))}" alt="" style="border-radius:6px;margin-bottom:32px;width:100%">` : '') + `<div class="prose">${md(p.content)}</div>`;
  }
  async function pFaq() { $('#faqList').innerHTML = faqHtml(await getFaqs()); }
  async function pCmsPage() {
    const root = $('#pageBody'), slug = new URLSearchParams(location.search).get('slug'); root.innerHTML = skeletons(1);
    const p = slug && await getOne('pages', slug, '&published=eq.true');
    if (!p) { root.innerHTML = state('Page not found', 'It may have been unpublished or moved.') + '<p style="text-align:center"><a class="btn" href="index.html">Back to home</a></p>'; setMeta('Page not found | KitSpring'); return; }
    setMeta((p.seo_title || p.title) + ' | KitSpring', p.seo_description, null, 'page.html?slug=' + encodeURIComponent(p.slug)); $('#pageTitle').textContent = p.title;
    root.innerHTML = `<div class="prose">${md(p.content)}</div>`;
  }
  async function cmsOverride() { // a published CMS page with a matching slug replaces the static copy
    const box = $('[data-cms-slug]'); if (!box || !usable) return;
    const p = await getOne('pages', box.dataset.cmsSlug, '&published=eq.true'); if (!p) return;
    box.innerHTML = md(p.content); const h = $('[data-cms-title]'); if (h) h.textContent = p.title; setMeta(p.seo_title ? p.seo_title + ' | KitSpring' : null, p.seo_description);
  }
  function pContact() {
    const f = $('#contactForm'); if (!f) return;
    f.addEventListener('submit', async e => {
      e.preventDefault(); const d = new FormData(f), s = await getSettings();
      location.href = 'mailto:' + s.contact.email + '?subject=' + encodeURIComponent('KitSpring enquiry: ' + d.get('topic')) + '&body=' + encodeURIComponent('Name: ' + d.get('name') + '\nEmail: ' + d.get('email') + '\n\n' + d.get('message'));
    });
  }

  /* ---------- boot ---------- */
  const routes = { home: pHome, shop: pShop, collection: pCollection, product: pProduct, resources: pResources, post: pPost, faq: pFaq, cmspage: pCmsPage, contact: pContact };
  initNav(); initSearch();
  $$('[data-year]').forEach(e => e.textContent = new Date().getFullYear());
  applySettings().catch(() => { });
  Promise.resolve().then(() => routes[PAGE] && routes[PAGE]()).catch(err => { console.error(err); const g = $('#productGrid,#featuredProducts'); if (g) g.innerHTML = state('Something went wrong', 'Please refresh the page or try again shortly.'); });
  cmsOverride().catch(() => { });
})();
