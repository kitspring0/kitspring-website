/* KitSpring Administration — vanilla JS + Supabase (Auth, Postgres, Storage).
   Security model: this file only uses the public anon key. Every permission is enforced by Postgres RLS
   (see supabase/schema.sql); hiding buttons here is a convenience, not the security boundary. */
(() => {
  'use strict';
  const app = document.getElementById('app'), CFG = window.KITSPRING_CONFIG || {}, BUCKET = 'kitspring-media';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const https = u => { try { return new URL(u).protocol === 'https:' ? u : ''; } catch (e) { return ''; } };
  const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const fmtDT = d => { try { return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };
  const S = { client: null, user: null, profile: null, collections: [] };
  const ROLE = { super_admin: 'Super Admin', admin: 'Admin', editor: 'Editor' };
  const can = a => { const r = S.profile && S.profile.role; if (!r) return false; return ({ delete: ['super_admin', 'admin'], collections: ['super_admin', 'admin'], settings: ['super_admin', 'admin'], activity: ['super_admin', 'admin'], admins: ['super_admin'], write: ['super_admin', 'admin', 'editor'] }[a] || []).includes(r); };
  const IC = { dashboard: 'M3 12 12 3l9 9M5 10v10h14V10', products: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', collections: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', pages: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5', posts: 'M4 5h16M4 10h16M4 15h10M4 20h7', faqs: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01', media: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-.5-2.3h-4L9 7 7 8 5 7 3 11l2 1v2l-2 1 2 4 2-1 2 1 .5 2.3h4L15 19l2-1 2 1 2-4-2-1z', admins: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', activity: 'M3 12h4l3-8 4 16 3-8h4', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', menu: 'M4 7h16M4 12h16M4 17h16', plus: 'M12 5v14M5 12h14' };
  const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;

  /* ---------- UI helpers ---------- */
  function toast(msg, bad) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } const d = document.createElement('div'); if (bad) d.className = 'e'; d.textContent = msg; t.appendChild(d); setTimeout(() => d.remove(), bad ? 7000 : 3800); }
  function dialog(title, bodyHtml, buttons) {
    return new Promise(res => {
      const d = document.createElement('dialog'); d.innerHTML = `<div class="dh"><h2>${esc(title)}</h2></div><div class="db">${bodyHtml}</div><div class="df"></div>`;
      const f = $('.df', d); buttons.forEach(b => { const x = document.createElement('button'); x.className = 'btn ' + (b.cls || ''); x.textContent = b.label; x.onclick = () => { d.close(); res(b.value); }; f.appendChild(x); });
      d.addEventListener('close', () => { d.remove(); res(undefined); }); document.body.appendChild(d); d.showModal(); d._el = d; window.__dlg = d;
    });
  }
  const confirmBox = (title, msg, label = 'Delete') => dialog(title, `<p>${msg}</p>`, [{ label: 'Cancel', cls: 'ghost', value: false }, { label, cls: 'danger', value: true }]).then(v => v === true);
  const busy = (btn, on, txt) => { if (!btn) return; if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + (txt || 'Working…'); } else { btn.disabled = false; btn.innerHTML = btn.dataset.t || btn.innerHTML; } };
  function dbError(e) { const m = (e && e.message) || String(e); if (e && e.code === '23505') return 'That slug (or unique value) is already in use. Choose another.'; if (e && (e.code === '42501' || /row-level security|permission denied/i.test(m))) return 'Your role does not permit this action.'; if (e && e.code === '23514') return 'A value failed validation (for example a checkout URL that is not HTTPS, a negative price or an invalid slug).'; if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach Supabase. Check your connection and the URL in config.js.'; return m; }
  async function logAct(action, entity, id, details) { try { await S.client.from('activity_log').insert({ actor_id: S.user.id, action, entity, entity_id: id ? String(id) : null, details: details || {} }); } catch (e) { /* logging must never block work */ } }

  /* ---------- config gate ---------- */
  function configProblem() {
    const u = CFG.supabaseUrl || '', k = CFG.supabaseAnonKey || '';
    if (!window.supabase || !window.supabase.createClient) return 'lib';
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u) || k.length < 30 || /YOUR_|PLACEHOLDER/i.test(u + k)) return 'placeholder';
    let role = ''; try { role = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch (e) { }
    if (/^sb_secret_/.test(k) || role === 'service_role') return 'secret';
    return '';
  }
  function setupScreen(p) {
    const msg = { lib: ['The Supabase library could not be loaded', 'The admin loads a pinned supabase-js build from cdn.jsdelivr.net. Check your connection or any content blocker, then reload.'], placeholder: ['Supabase is not configured yet', 'config.js still contains placeholder values, so the admin will not attempt to connect.'], secret: ['A secret key was detected', 'config.js appears to contain a service-role / secret key. The admin refuses to use it. Remove it immediately, rotate the key in Supabase, and use only the anon (publishable) key.'] }[p];
    app.innerHTML = `<div class="setup"><img src="../assets/images/logo.png" alt="KitSpring" width="170" height="40" style="margin-bottom:24px"><div class="box"><h1>${msg[0]}</h1><p>${msg[1]}</p>${p === 'lib' ? '' : `<h2 style="margin-top:22px">Set-up checklist</h2><ol><li>Create a project at <strong>supabase.com</strong>.</li><li>In <strong>SQL Editor</strong> run the whole file <span class="code">supabase/schema.sql</span>.</li><li>In <strong>Authentication → Users</strong> add your own user (email + strong password).</li><li>Copy that user’s UUID and run the one-line Super Admin SQL from <span class="code">docs/SUPABASE-SETUP.md</span>.</li><li>Copy <span class="code">config.example.js</span> to <span class="code">config.js</span> in the site root and paste the <strong>Project URL</strong> and <strong>anon / publishable</strong> key.</li><li>Redeploy, then reload this page.</li></ol><p class="muted">Never paste a service-role or secret key into any website file.</p>`}<p style="margin-top:20px"><a href="../index.html">← Back to the website</a></p></div></div>`;
  }

  /* ---------- auth screens ---------- */
  function loginScreen(note) {
    app.innerHTML = `<div class="login"><aside class="login-art"><img src="../assets/images/logo-light.png" alt="KitSpring" width="190" height="45"><div><small>Administration</small><h2>Run the KitSpring storefront with confidence.</h2></div><span>Useful ideas. Beautifully put to work.</span></aside>
<main class="login-form"><div class="login-card"><img class="mark" src="../assets/images/logo.png" alt="KitSpring" width="170" height="40"><h1>Sign in</h1><p class="sub">KitSpring Administration. Authorised staff only.</p><div id="lmsg" role="alert">${note ? `<div class="alert info">${esc(note)}</div>` : ''}</div>
<form id="lf" class="stack" novalidate><div><label class="l" for="em">Email</label><input class="field" id="em" type="email" autocomplete="username" required></div>
<div><label class="l" for="pw">Password</label><div class="pw"><input class="field" id="pw" type="password" autocomplete="current-password" required><button type="button" class="toggle" aria-controls="pw" aria-label="Show password">Show</button></div></div>
<button class="btn" type="submit" style="width:100%">Sign in</button><p style="text-align:center;margin:0"><button type="button" id="fp" class="btn ghost sm" style="border:0;background:none">Forgot password?</button></p></form>
<p class="muted" style="margin-top:28px;font-size:.84rem"><a href="../index.html">← Back to website</a></p></div></main></div>`;
    const msg = (t, c = 'error') => $('#lmsg').innerHTML = `<div class="alert ${c}">${esc(t)}</div>`;
    $('.toggle').onclick = e => { const i = $('#pw'), s = i.type === 'password'; i.type = s ? 'text' : 'password'; e.target.textContent = s ? 'Hide' : 'Show'; e.target.setAttribute('aria-label', s ? 'Hide password' : 'Show password'); };
    $('#lf').onsubmit = async e => {
      e.preventDefault(); const em = $('#em').value.trim(), pw = $('#pw').value, b = $('button[type=submit]');
      if (!em || !pw) return msg('Enter your email address and password.');
      busy(b, true, 'Signing in…');
      try { const { error } = await S.client.auth.signInWithPassword({ email: em, password: pw }); if (error) throw error; await enter(); }
      catch (er) { const m = er.message || ''; msg(/Invalid login/i.test(m) ? 'Incorrect email or password.' : /not confirmed/i.test(m) ? 'This email address has not been confirmed yet. Confirm it in Supabase (Authentication → Users).' : /Failed to fetch|Network/i.test(m) ? 'Could not reach Supabase. Check your connection and config.js.' : m || 'Sign-in failed.'); busy(b, false); }
    };
    $('#fp').onclick = async () => {
      const em = $('#em').value.trim(); if (!em) return msg('Type your email address above first, then choose “Forgot password?”.', 'warn');
      try { const { error } = await S.client.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }); if (error) throw error; msg('If an account exists for that address, a reset link has been sent. Check your inbox.', 'ok'); } catch (er) { msg(er.message || 'Could not send the reset email.'); }
    };
    $('#em').focus();
  }
  function recoveryScreen() {
    app.innerHTML = `<div class="login"><main class="login-form" style="grid-column:1/-1"><div class="login-card"><img class="mark" style="display:block" src="../assets/images/logo.png" alt="KitSpring" width="170" height="40"><h1>Set a new password</h1><div id="rmsg" role="alert"></div><form id="rf" class="stack"><div><label class="l" for="p1">New password</label><input class="field" id="p1" type="password" autocomplete="new-password" minlength="10" required><div class="hint">At least 10 characters.</div></div><div><label class="l" for="p2">Confirm password</label><input class="field" id="p2" type="password" autocomplete="new-password" required></div><button class="btn" type="submit" style="width:100%">Update password</button></form></div></main></div>`;
    $('#rf').onsubmit = async e => { e.preventDefault(); const a = $('#p1').value, b = $('#p2').value, m = t => $('#rmsg').innerHTML = `<div class="alert error">${esc(t)}</div>`; if (a.length < 10) return m('Use at least 10 characters.'); if (a !== b) return m('The passwords do not match.'); const { error } = await S.client.auth.updateUser({ password: a }); if (error) return m(error.message); history.replaceState(null, '', location.pathname); await enter(); toast('Password updated.'); };
  }
  async function enter() {
    const { data: { session } } = await S.client.auth.getSession(); if (!session) return loginScreen();
    S.user = session.user;
    const { data, error } = await S.client.from('admin_profiles').select('*').eq('user_id', S.user.id).maybeSingle();
    if (error || !data || !data.active) {
      app.innerHTML = `<div class="setup"><div class="box"><h1>No administrator access</h1><p>You are signed in as <strong>${esc(S.user.email)}</strong>, but this account has no active administrator role.${error ? ` <span class="muted">(${esc(dbError(error))})</span>` : ''}</p><p class="muted">If you are the site owner, finish the Super Admin step in <span class="code">docs/SUPABASE-SETUP.md</span>. Otherwise ask the Super Admin to assign you a role.</p><button class="btn" id="so">Sign out</button></div></div>`; $('#so').onclick = signOut; return;
    }
    S.profile = data; await loadCollections(); shell(); route();
  }
  async function signOut() { await S.client.auth.signOut(); S.user = S.profile = null; loginScreen('You have been signed out.'); }
  async function loadCollections() { const { data } = await S.client.from('collections').select('slug,name,sort_order').order('sort_order'); S.collections = data || []; }

  /* ---------- shell + routing ---------- */
  const NAV = [['dashboard', 'Dashboard'], ['products', 'Products'], ['collections', 'Collections'], ['pages', 'Website pages'], ['posts', 'Blog & resources'], ['faqs', 'FAQs'], ['media', 'Media library'], ['settings', 'Website settings', 'settings'], ['admins', 'Administrators', 'admins'], ['activity', 'Activity log', 'activity'], ['account', 'My account']];
  function shell() {
    const items = NAV.filter(n => !n[2] || can(n[2])).map(n => `<button type="button" data-v="${n[0]}">${ico(n[0])}<span>${n[1]}</span></button>`).join('');
    app.innerHTML = `<div class="shell"><aside class="side" id="side" aria-label="Administration"><div class="top"><img src="../assets/images/logo-light.png" alt="KitSpring" width="150" height="36"><small>Administration</small></div><nav>${items}</nav><div class="me"><strong>${esc(S.profile.display_name || S.user.email)}</strong><span>${esc(ROLE[S.profile.role])}</span><button class="btn gold sm" id="so" type="button">Sign out</button></div></aside>
<div class="main"><div class="bar"><button class="btn ghost sm menu" id="mt" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="side">${ico('menu')} Menu</button><span class="grow"></span><a class="view-site" href="../index.html" target="_blank" rel="noopener">View website ↗</a></div><div class="content" id="view" tabindex="-1"></div></div></div>`;
    $$('.side nav button').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.v; $('#side').classList.remove('open'); });
    $('#so').onclick = signOut; $('#mt').onclick = () => { const o = $('#side').classList.toggle('open'); $('#mt').setAttribute('aria-expanded', o); };
  }
  const R = { dashboard: vDash, products: v => crud('products', v), collections: v => crud('collections', v), pages: v => crud('pages', v), posts: v => crud('posts', v), faqs: v => crud('faqs', v), media: vMedia, settings: vSettings, admins: vAdmins, activity: vActivity, account: vAccount };
  async function route() {
    if (!S.profile) return; const [, v = 'dashboard', id] = location.hash.split('/'), name = R[v] ? v : 'dashboard';
    const nv = NAV.find(n => n[0] === name); if (nv && nv[2] && !can(nv[2])) { location.hash = '#/dashboard'; return; }
    $$('.side nav button').forEach(b => b.setAttribute('aria-current', b.dataset.v === name ? 'page' : 'false'));
    const el = $('#view'); el.innerHTML = '<p class="muted">Loading…</p>';
    try { await R[name](el, id); } catch (e) { el.innerHTML = `<div class="alert error">${esc(dbError(e))}</div>`; }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- dashboard ---------- */
  async function count(t, f) { let q = S.client.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q); const { count: c, error } = await q; if (error) throw error; return c ?? 0; }
  async function vDash(el) {
    const [pAll, pPub, pSoon, pDraft, col, posts, postsPub, pages, faqs] = await Promise.all([count('products'), count('products', q => q.eq('status', 'published')), count('products', q => q.eq('status', 'coming_soon')), count('products', q => q.eq('status', 'draft')), count('collections'), count('posts'), count('posts', q => q.eq('status', 'published')), count('pages'), count('faqs')]);
    let act = []; if (can('activity')) { const { data } = await S.client.from('activity_log').select('*').order('created_at', { ascending: false }).limit(8); act = data || []; }
    const card = (t, n, s) => `<div class="card"><div class="t">${t}</div><div class="n">${n}</div><div class="s">${s}</div></div>`;
    el.innerHTML = `<div class="head"><div><h1>Welcome, ${esc(S.profile.display_name || 'there')}</h1><p>Here is the state of the KitSpring storefront.</p></div></div>
<div class="cards">${card('Products', pAll, `${pPub} published · ${pSoon} coming soon · ${pDraft} draft`)}${card('Collections', col, 'Shown on the storefront')}${card('Articles', posts, `${postsPub} published`)}${card('Pages', pages, 'CMS-managed')}${card('FAQs', faqs, 'Help centre')}</div>
<div class="two"><div class="panel"><h2>Recent activity</h2>${can('activity') ? (act.length ? `<ul class="act-list">${act.map(a => `<li><span><strong>${esc(a.action)}</strong> ${esc(a.entity)}${a.details && a.details.title ? ' · ' + esc(a.details.title) : ''}</span><time>${esc(fmtDT(a.created_at))}</time></li>`).join('')}</ul>` : '<p class="muted">No activity recorded yet.</p>') : '<p class="muted">The activity log is visible to Admins and Super Admins.</p>'}</div>
<div><div class="panel"><h2>Quick actions</h2><div class="qa"><a class="btn" href="#/products/new">${ico('plus')} New product</a><a class="btn ghost" href="#/posts/new">${ico('plus')} New article</a><a class="btn ghost" href="#/faqs/new">${ico('plus')} New FAQ</a><a class="btn ghost" href="#/media">${ico('media')} Upload media</a></div></div>
<div class="panel"><h2>Your account</h2><p style="margin:0">${esc(S.user.email)}<br><span class="badge">${esc(ROLE[S.profile.role])}</span></p></div></div></div>`;
  }

  /* ---------- entity definitions ---------- */
  const CUR = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'CAD'];
  const collOpts = () => (S.collections.length ? S.collections : [{ slug: 'business', name: 'Business' }, { slug: 'productivity', name: 'Productivity' }, { slug: 'lifestyle', name: 'Lifestyle' }, { slug: 'creative', name: 'Creative' }, { slug: 'guides', name: 'Guides' }]).map(c => [c.slug, c.name]);
  const seoFields = [{ h: 'Search & sharing (SEO)' }, { k: 'seo_title', l: 'SEO title', t: 'text', hint: 'Up to about 60 characters.' }, { k: 'seo_description', l: 'SEO description', t: 'textarea', full: 1, rows: 3, hint: 'Up to about 155 characters.' }];
  const ENT = {
    products: { table: 'products', one: 'product', many: 'Products', title: 'name', order: ['created_at', true], search: ['name', 'slug', 'collection'], newDefaults: () => ({ status: 'draft', currency: 'NGN', visible: true, featured: false, collection: collOpts()[0][0], includes: [] }),
      cols: [['', r => `<img src="${esc(https(r.cover_url) || '../assets/images/placeholder-cover.svg')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`, 'thumb'], ['Name', r => `<strong>${esc(r.name)}</strong><br><span class="muted">/${esc(r.slug)}</span>`], ['Collection', r => esc(r.collection)], ['Status', r => badge(r.status)], ['Price', r => r.price == null ? '<span class="muted">—</span>' : esc(r.currency + ' ' + Number(r.price).toFixed(2))], ['', r => (r.featured ? '<span class="badge">Featured</span> ' : '') + (r.visible ? '' : '<span class="badge draft">Hidden</span>')]],
      fields: [{ h: 'Basics' }, { k: 'name', l: 'Product name', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug', t: 'slug', req: 1, hint: 'Lowercase letters, numbers and hyphens. Used in the product URL.' }, { k: 'collection', l: 'Collection', t: 'select', opts: collOpts, req: 1 }, { k: 'type', l: 'Product type / format', t: 'text', hint: 'e.g. Spreadsheet, Workbook, Template pack.' }, { k: 'short_description', l: 'Short description', t: 'text', full: 1, hint: 'One line shown on product cards.' }, { k: 'description', l: 'Full description', t: 'textarea', full: 1, rows: 7, hint: 'Supports ## headings, **bold**, - lists and [links](https://…).' }, { k: 'details', l: 'Additional details', t: 'textarea', full: 1, rows: 3 }, { k: 'audience', l: 'Who it is for', t: 'text', full: 1 }, { k: 'includes', l: 'What it includes', t: 'lines', full: 1, hint: 'One item per line.' },
        { h: 'Pricing & checkout' }, { k: 'price', l: 'Price', t: 'number', hint: 'Leave empty if the price is not announced.' }, { k: 'currency', l: 'Currency', t: 'select', opts: () => CUR.map(c => [c, c]) }, { k: 'checkout_url', l: 'Checkout URL (HTTPS)', t: 'url', full: 1, hint: 'Payment page on your provider, e.g. Payhip. Must start with https://. Required before a product can show a Buy button.' },
        { h: 'Image' }, { k: 'cover_url', l: 'Cover image', t: 'image', full: 1 }, { h: 'Visibility' }, { k: 'status', l: 'Status', t: 'select', opts: () => [['draft', 'Draft (hidden)'], ['coming_soon', 'Coming soon (visible, not purchasable)'], ['published', 'Published (purchasable when price + checkout set)'], ['archived', 'Archived (hidden)']] }, { k: 'featured', l: 'Featured on the homepage', t: 'check' }, { k: 'visible', l: 'Visible on the storefront', t: 'check' }, ...seoFields],
      check: p => { const w = []; if (p.status === 'published') { if (p.price == null) w.push('Published without a price.'); if (!p.checkout_url) w.push('Published without a checkout URL, so visitors will see “Coming soon” instead of a Buy button.'); } return w; } },
    collections: { table: 'collections', one: 'collection', many: 'Collections', title: 'name', order: ['sort_order', true], perm: 'collections', sortable: true, newDefaults: () => ({ visible: true, sort_order: (S.collections.length + 1) * 10 }),
      cols: [['', r => `<img src="${esc(https(r.cover_url) || '../assets/images/collections/' + r.slug + '.svg')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`, 'thumb'], ['Name', r => `<strong>${esc(r.name)}</strong><br><span class="muted">/${esc(r.slug)}</span>`], ['Order', r => r.sort_order], ['Visible', r => r.visible ? badge('published', 'Yes') : badge('draft', 'No')]],
      fields: [{ k: 'name', l: 'Name', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug', t: 'slug', req: 1, hint: 'The five built-in collection pages use business, productivity, lifestyle, creative and guides.' }, { k: 'description', l: 'Description', t: 'textarea', full: 1, rows: 3 }, { k: 'cover_url', l: 'Cover image', t: 'image', full: 1 }, { k: 'sort_order', l: 'Display order', t: 'number', int: 1 }, { k: 'visible', l: 'Visible on the storefront', t: 'check' }] },
    pages: { table: 'pages', one: 'page', many: 'Website pages', title: 'title', order: ['updated_at', false], search: ['title', 'slug'], newDefaults: () => ({ published: false }),
      cols: [['Title', r => `<strong>${esc(r.title)}</strong><br><span class="muted">${esc(['about', 'privacy', 'terms'].includes(r.slug) ? 'Replaces the built-in /' + r.slug + ' content when published' : 'page.html?slug=' + r.slug)}</span>`], ['Status', r => r.published ? badge('published', 'Published') : badge('draft', 'Draft')], ['Updated', r => esc(fmtDT(r.updated_at))]],
      fields: [{ k: 'title', l: 'Page title', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug', t: 'slug', req: 1, hint: 'Pages with slug about, privacy or terms replace that built-in page body. Others open at page.html?slug=…' }, { k: 'content', l: 'Content', t: 'textarea', full: 1, rows: 14, hint: 'Supports ## headings, **bold**, *italic*, - lists, > quotes, [links](https://…) and ![images](https://…).' }, { k: 'published', l: 'Published', t: 'check' }, ...seoFields] },
    posts: { table: 'posts', one: 'article', many: 'Blog & resources', title: 'title', order: ['created_at', false], search: ['title', 'slug'], newDefaults: () => ({ status: 'draft' }),
      cols: [['', r => `<img src="${esc(https(r.cover_url) || '../assets/images/placeholder-cover.svg')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`, 'thumb'], ['Title', r => `<strong>${esc(r.title)}</strong><br><span class="muted">/${esc(r.slug)}</span>`], ['Status', r => badge(r.status)], ['Published', r => r.published_at ? esc(fmtDT(r.published_at)) : '<span class="muted">—</span>']],
      fields: [{ k: 'title', l: 'Title', t: 'text', req: 1 }, { k: 'slug', l: 'URL slug', t: 'slug', req: 1 }, { k: 'excerpt', l: 'Excerpt', t: 'textarea', full: 1, rows: 3, hint: 'Shown on cards and in search results.' }, { k: 'content', l: 'Article body', t: 'textarea', full: 1, rows: 14, hint: 'Supports ## headings, **bold**, *italic*, - lists, > quotes, [links](https://…) and ![images](https://…).' }, { k: 'cover_url', l: 'Cover image', t: 'image', full: 1 }, { k: 'status', l: 'Status', t: 'select', opts: () => [['draft', 'Draft'], ['published', 'Published'], ['archived', 'Archived']] }, ...seoFields] },
    faqs: { table: 'faqs', one: 'FAQ', many: 'FAQs', title: 'question', order: ['sort_order', true], sortable: true, search: ['question', 'answer'], newDefaults: () => ({ published: true }),
      cols: [['Question', r => `<strong>${esc(r.question)}</strong>`], ['Order', r => r.sort_order], ['Status', r => r.published ? badge('published', 'Published') : badge('draft', 'Draft')]],
      fields: [{ k: 'question', l: 'Question', t: 'text', req: 1, full: 1 }, { k: 'answer', l: 'Answer', t: 'textarea', full: 1, rows: 6, req: 1 }, { k: 'sort_order', l: 'Display order', t: 'number', int: 1 }, { k: 'published', l: 'Published', t: 'check' }] } };
  const badge = (s, label) => { const m = { published: 'pub', coming_soon: 'soon', draft: 'draft', archived: 'arch' }; return `<span class="badge ${m[s] || ''}">${esc(label || String(s).replace('_', ' '))}</span>`; };

  /* ---------- generic CRUD ---------- */
  async function crud(name, el, id) {
    const E = ENT[name]; id = id || (location.hash.split('/')[2]);
    const writable = E.perm ? can(E.perm) : can('write');
    if (id === 'new') return form(E, el, E.newDefaults(), writable, name);
    if (id) { const { data, error } = await S.client.from(E.table).select('*').eq('id', id).maybeSingle(); if (error) throw error; if (!data) { el.innerHTML = '<div class="alert error">That record no longer exists.</div><a class="btn ghost" href="#/' + name + '">Back</a>'; return; } return form(E, el, data, writable, name); }
    await list(E, el, name, writable);
  }
  async function list(E, el, name, writable) {
    const { data, error } = await S.client.from(E.table).select('*').order(E.order[0], { ascending: E.order[1] }).limit(500); if (error) throw error;
    let rows = data || [];
    el.innerHTML = `<div class="head"><div><h1>${E.many}</h1><p>${rows.length} total</p></div>${writable ? `<a class="btn" href="#/${name}/new">${ico('plus')} New ${E.one}</a>` : ''}</div>${!writable ? '<div class="alert info">Your role has read-only access to this section.</div>' : ''}${E.search ? '<div class="toolbar"><input class="field" id="q" type="search" placeholder="Search…" aria-label="Search"></div>' : ''}<div class="tbl-wrap"><table><thead><tr>${E.cols.map(c => `<th>${c[0]}</th>`).join('')}<th>Actions</th></tr></thead><tbody id="tb"></tbody></table></div>`;
    const draw = () => {
      const q = ($('#q') ? $('#q').value.trim().toLowerCase() : ''); const vis = q ? rows.filter(r => E.search.some(k => String(r[k] || '').toLowerCase().includes(q))) : rows;
      $('#tb').innerHTML = vis.length ? vis.map(r => `<tr>${E.cols.map(c => `<td class="${c[2] || ''}">${c[1](r)}</td>`).join('')}<td><div class="acts">${actions(E, r, name, writable, rows)}</div></td></tr>`).join('') : `<tr><td colspan="${E.cols.length + 1}" class="empty">Nothing here yet.${writable ? ` <a href="#/${name}/new">Create the first ${E.one}</a>.` : ''}</td></tr>`;
    };
    draw(); if ($('#q')) $('#q').oninput = draw;
    $('#tb').onclick = async e => { const b = e.target.closest('button[data-a]'); if (!b) return; const r = rows.find(x => x.id === b.dataset.id); await rowAction(E, r, b.dataset.a, name, rows, b); };
  }
  function actions(E, r, name, writable, rows) {
    const a = [`<a class="btn ghost sm" href="#/${name}/${r.id}">${writable ? 'Edit' : 'View'}</a>`]; const bt = (act, l, c = 'ghost') => `<button class="btn ${c} sm" data-a="${act}" data-id="${r.id}">${l}</button>`;
    if (writable) {
      if (name === 'products') { a.push(r.status === 'published' ? bt('unpublish', 'Unpublish') : bt('publish', 'Publish')); if (r.status !== 'archived') a.push(bt('archive', 'Archive')); }
      if (name === 'posts') { a.push(r.status === 'published' ? bt('unpublish', 'Unpublish') : bt('publish', 'Publish')); if (r.status !== 'archived') a.push(bt('archive', 'Archive')); }
      if (name === 'pages' || name === 'faqs') a.push(r.published ? bt('unpublish', 'Unpublish') : bt('publish', 'Publish'));
      if (E.sortable) { const i = rows.indexOf(r); a.push(`<button class="btn ghost sm" data-a="up" data-id="${r.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn ghost sm" data-a="down" data-id="${r.id}" aria-label="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>↓</button>`); }
    }
    if (can('delete') && (!E.perm || can(E.perm))) a.push(bt('delete', 'Delete', 'danger'));
    return a.join('');
  }
  async function rowAction(E, r, act, name, rows, btn) {
    const T = E.table, title = r[E.title];
    try {
      if (act === 'delete') { if (!await confirmBox(`Delete ${E.one}?`, `“${esc(title)}” will be permanently removed. This cannot be undone.`)) return; const { error } = await S.client.from(T).delete().eq('id', r.id); if (error) throw error; await logAct('delete', T, r.id, { title }); toast('Deleted.'); return route(); }
      if (act === 'up' || act === 'down') { const i = rows.indexOf(r), j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= rows.length) return; const o = rows.slice(); [o[i], o[j]] = [o[j], o[i]]; await Promise.all(o.map((x, k) => x.sort_order !== (k + 1) * 10 ? S.client.from(T).update({ sort_order: (k + 1) * 10 }).eq('id', x.id).then(({ error }) => { if (error) throw error; }) : null)); if (T === 'collections') await loadCollections(); await logAct('reorder', T, r.id, { title }); return route(); }
      const patch = { publish: name === 'pages' || name === 'faqs' ? { published: true } : { status: 'published' }, unpublish: name === 'pages' || name === 'faqs' ? { published: false } : { status: name === 'products' ? 'draft' : 'draft' }, archive: { status: 'archived' } }[act];
      if (act === 'publish' && name === 'posts' && !r.published_at) patch.published_at = new Date().toISOString();
      if (act === 'publish' && name === 'products') { const w = E.check({ ...r, ...patch }); if (w.length && !await dialog('Publish anyway?', '<p>' + w.map(esc).join('<br>') + '</p>', [{ label: 'Cancel', cls: 'ghost', value: false }, { label: 'Publish anyway', value: true }])) return; }
      busy(btn, true, '…'); const { error } = await S.client.from(T).update(patch).eq('id', r.id); if (error) throw error; await logAct(act, T, r.id, { title }); toast(act === 'publish' ? 'Published. It is now live on the website.' : act === 'archive' ? 'Archived.' : 'Updated.'); route();
    } catch (e) { busy(btn, false); toast(dbError(e), true); }
  }

  /* ---------- generic form ---------- */
  function field(f, v) {
    if (f.h) return `<h3>${f.h}</h3>`; const id = 'f_' + f.k, full = f.full ? ' full' : '', hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '', lab = `<label class="l" for="${id}">${f.l}${f.req ? ' *' : ''}</label>`, val = v[f.k] ?? '';
    if (f.t === 'check') return `<div class="chk${full}"><input type="checkbox" id="${id}" ${v[f.k] ? 'checked' : ''}><label for="${id}" style="font-weight:600">${f.l}</label></div>`;
    if (f.t === 'select') return `<div class="${full}">${lab}<select class="field" id="${id}">${f.opts().map(o => `<option value="${esc(o[0])}" ${o[0] === val ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>${hint}</div>`;
    if (f.t === 'textarea') return `<div class="${full}">${lab}<textarea class="field" id="${id}" rows="${f.rows || 4}">${esc(val)}</textarea>${hint}<div class="err" id="e_${f.k}"></div></div>`;
    if (f.t === 'lines') return `<div class="${full}">${lab}<textarea class="field" id="${id}" rows="5">${esc(Array.isArray(val) ? val.join('\n') : '')}</textarea>${hint}</div>`;
    if (f.t === 'image') return `<div class="${full}">${lab}<div class="imgfield"><div class="prev" id="pv_${f.k}" style="background-image:${https(val) ? `url('${esc(val)}')` : 'none'}"></div><div class="col"><input class="field" id="${id}" type="url" value="${esc(val)}" placeholder="https://… (paste a URL or choose from the library)"><div><button type="button" class="btn ghost sm" data-pick="${f.k}">Choose from library</button> <button type="button" class="btn ghost sm" data-clear="${f.k}">Clear</button></div></div></div>${hint}<div class="err" id="e_${f.k}"></div></div>`;
    return `<div class="${full}">${lab}<input class="field" id="${id}" type="${f.t === 'number' ? 'number' : f.t === 'url' ? 'url' : 'text'}" ${f.t === 'number' ? `step="${f.int ? 1 : '0.01'}" min="${f.int ? '' : 0}"` : ''} value="${esc(val)}" ${f.req ? 'required' : ''} ${f.t === 'slug' ? 'autocapitalize="off" spellcheck="false"' : ''}>${hint}<div class="err" id="e_${f.k}"></div></div>`;
  }
  function form(E, el, rec, writable, name) {
    const isNew = !rec.id; const ro = writable ? '' : 'disabled';
    el.innerHTML = `<div class="head"><div><a href="#/${name}" class="link">← ${E.many}</a><h1 style="margin-top:6px">${isNew ? 'New ' + E.one : 'Edit ' + E.one}</h1></div></div><div class="panel"><form id="ef" class="form" novalidate><fieldset ${ro} style="display:contents;border:0;padding:0;margin:0">${E.fields.map(f => field(f, rec)).join('')}</fieldset><div class="full" id="fm" role="alert"></div><div class="actions full">${writable ? `<button class="btn" type="submit">${isNew ? 'Create' : 'Save changes'}</button>` : ''}<a class="btn ghost" href="#/${name}">${writable ? 'Cancel' : 'Back'}</a></div></form></div>`;
    const f = $('#ef'), slugEl = $('#f_slug'), srcKey = E.title, srcEl = $('#f_' + srcKey); let slugTouched = !isNew;
    if (slugEl && srcEl) { srcEl.addEventListener('input', () => { if (!slugTouched) slugEl.value = slugify(srcEl.value); }); slugEl.addEventListener('input', () => slugTouched = true); }
    $$('[data-pick]', f).forEach(b => b.onclick = async () => { const u = await pickMedia(); if (u) { $('#f_' + b.dataset.pick).value = u; $('#pv_' + b.dataset.pick).style.backgroundImage = `url('${u}')`; } });
    $$('[data-clear]', f).forEach(b => b.onclick = () => { $('#f_' + b.dataset.clear).value = ''; $('#pv_' + b.dataset.clear).style.backgroundImage = 'none'; });
    $$('input[type=url]', f).forEach(i => i.addEventListener('input', () => { const p = $('#pv_' + i.id.slice(2)); if (p) p.style.backgroundImage = https(i.value) ? `url('${i.value}')` : 'none'; }));
    f.onsubmit = async e => {
      e.preventDefault(); $$('.err', f).forEach(x => x.textContent = ''); const p = {}; let bad = false; const fail = (k, m) => { const x = $('#e_' + k); if (x) x.textContent = m; bad = true; };
      E.fields.forEach(fd => {
        if (fd.h) return; const x = $('#f_' + fd.k); let v;
        if (fd.t === 'check') v = x.checked; else if (fd.t === 'lines') v = x.value.split('\n').map(s => s.trim()).filter(Boolean); else if (fd.t === 'number') { v = x.value === '' ? null : Number(x.value); if (v !== null && (isNaN(v) || (!fd.int && v < 0))) fail(fd.k, 'Enter a valid number (0 or more).'); } else v = x.value.trim();
        if (fd.req && (v === '' || v == null)) fail(fd.k, 'This field is required.');
        if (fd.t === 'slug' && v && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) fail(fd.k, 'Use lowercase letters, numbers and single hyphens only.');
        if ((fd.t === 'url' || fd.t === 'image') && v && !https(v)) fail(fd.k, 'Must be a valid HTTPS URL (https://…).');
        if (fd.t === 'number' && fd.int && v !== null) v = Math.round(v);
        if (['url', 'image', 'text'].includes(fd.t) && fd.t !== 'text' && v === '') v = null; if (fd.k.startsWith('seo_') && v === '') v = null;
        p[fd.k] = v;
      });
      if (bad) { $('#fm').innerHTML = '<div class="alert error">Please correct the highlighted fields.</div>'; $('.err:not(:empty)', f)?.scrollIntoView({ block: 'center' }); return; }
      if (E.table === 'posts' && p.status === 'published' && !(rec.published_at)) p.published_at = new Date().toISOString();
      if (E.check) { const w = E.check(p); if (w.length && !await dialog('Check before saving', '<p>' + w.map(esc).join('<br>') + '</p>', [{ label: 'Go back', cls: 'ghost', value: false }, { label: 'Save anyway', value: true }])) return; }
      const sb = $('button[type=submit]', f); busy(sb, true, 'Saving…');
      try {
        const q = isNew ? S.client.from(E.table).insert(p) : S.client.from(E.table).update(p).eq('id', rec.id);
        const { data, error } = await q.select().single(); if (error) throw error;
        await logAct(isNew ? 'create' : 'update', E.table, data.id, { title: data[E.title] }); if (E.table === 'collections') await loadCollections();
        toast(isNew ? 'Created.' : 'Saved.'); location.hash = '#/' + name;
      } catch (er) { busy(sb, false); $('#fm').innerHTML = `<div class="alert error">${esc(dbError(er))}</div>`; }
    };
  }

  /* ---------- media ---------- */
  async function listMedia() {
    const st = S.client.storage.from(BUCKET), out = []; const own = S.user.id;
    const folders = can('delete') ? ((await st.list('', { limit: 100 })).data || []).filter(x => !x.id).map(x => x.name) : [own];
    for (const fo of folders) { const { data } = await st.list(fo, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }); (data || []).filter(x => x.id).forEach(x => out.push({ path: fo + '/' + x.name, name: x.name, own: fo === own, size: x.metadata && x.metadata.size, created: x.created_at })); }
    out.sort((a, b) => String(b.created).localeCompare(String(a.created))); return out.map(o => ({ ...o, url: st.getPublicUrl(o.path).data.publicUrl }));
  }
  async function vMedia(el) {
    el.innerHTML = `<div class="head"><div><h1>Media library</h1><p>Upload PNG, JPG, WebP or GIF images (max 5 MB each).</p></div></div><div class="drop"><label class="btn" for="up" style="cursor:pointer">${ico('plus')} Upload images</label><input id="up" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple class="sr-only"><p class="muted" style="margin:10px 0 0">Uploaded images get a permanent public URL you can paste into any image field.</p></div><div id="mg"><p class="muted">Loading…</p></div>`;
    const draw = async () => { const items = await listMedia(); $('#mg').innerHTML = items.length ? `<div class="media-grid">${items.map((m, i) => `<div class="mi"><div class="pv" style="background-image:url('${esc(m.url)}')" role="img" aria-label="${esc(m.name)}"></div><div class="b"><span title="${esc(m.name)}">${esc(m.name)}</span><div><button class="btn ghost sm" data-c="${i}">Copy URL</button>${(can('delete') || m.own) ? `<button class="btn danger sm" data-d="${i}">Delete</button>` : ''}</div></div></div>`).join('')}</div>` : '<div class="panel empty">No images uploaded yet.</div>'; $('#mg').onclick = async e => { const c = e.target.closest('[data-c]'), d = e.target.closest('[data-d]'); if (c) { const u = items[c.dataset.c].url; try { await navigator.clipboard.writeText(u); toast('URL copied.'); } catch (x) { await dialog('Image URL', `<input class="field" readonly value="${esc(u)}" onfocus="this.select()">`, [{ label: 'Close', value: true }]); } } if (d) { const m = items[d.dataset.d]; if (!await confirmBox('Delete image?', `“${esc(m.name)}” will be removed. Pages still using its URL will show a broken image.`)) return; const { error } = await S.client.storage.from(BUCKET).remove([m.path]); if (error) return toast(dbError(error), true); await logAct('delete', 'media', m.path, { title: m.name }); toast('Deleted.'); draw(); } }; };
    $('#up').onchange = async e => { const files = Array.from(e.target.files); for (const f of files) { if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast(`${f.name}: only PNG, JPG, WebP or GIF are allowed.`, true); continue; } if (f.size > 5 * 1024 * 1024) { toast(`${f.name}: larger than 5 MB.`, true); continue; } const path = `${S.user.id}/${Date.now()}-${slugify(f.name.replace(/\.[^.]+$/, '')) || 'image'}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`; const { error } = await S.client.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false }); if (error) toast(`${f.name}: ${dbError(error)}`, true); else { await logAct('upload', 'media', path, { title: f.name }); toast(`${f.name} uploaded.`); } } e.target.value = ''; draw(); };
    await draw();
  }
  async function pickMedia() {
    let items = []; try { items = await listMedia(); } catch (e) { toast(dbError(e), true); return null; }
    const html = items.length ? `<div class="media-grid">${items.map((m, i) => `<button type="button" class="mi" data-i="${i}" style="padding:0;cursor:pointer;text-align:left"><div class="pv" style="background-image:url('${esc(m.url)}')"></div><div class="b"><span>${esc(m.name)}</span></div></button>`).join('')}</div>` : '<p class="empty">No images yet. Upload some in the Media library first.</p>';
    return new Promise(res => { dialog('Choose an image', html, [{ label: 'Cancel', cls: 'ghost', value: null }]).then(v => res(v || null)); setTimeout(() => { const d = window.__dlg; d && d.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { res(items[b.dataset.i].url); d.close(); } }); }, 0); });
  }

  /* ---------- settings ---------- */
  const SETS = [
    ['site', 'Site identity', [['title', 'Site title', 'text'], ['description', 'Brand description', 'textarea', 'Shown in the footer and used as the default description.']]],
    ['announcement', 'Announcement bar', [['enabled', 'Show the announcement bar', 'check'], ['text', 'Message', 'text', 'Keep it factual: no fake offers or urgency.'], ['link_text', 'Link text', 'text'], ['link_url', 'Link URL', 'text', 'A site path like shop.html, or a full https:// URL.']]],
    ['contact', 'Contact information', [['email', 'Email', 'email'], ['whatsapp', 'WhatsApp number (digits, with country code)', 'text'], ['phone', 'Phone (optional)', 'text'], ['address', 'Address (optional)', 'text']]],
    ['social', 'Social links', ['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'tiktok', 'pinterest'].map(k => [k, k[0].toUpperCase() + k.slice(1) + ' URL', 'url'])],
    ['seo', 'SEO defaults', [['default_title', 'Default homepage title', 'text'], ['default_description', 'Default meta description', 'textarea'], ['og_image', 'Social sharing image URL (HTTPS)', 'url'], ['site_url', 'Public site URL (for your records)', 'url']]],
    ['newsletter', 'Email updates', [['form_action', 'Email provider form action URL (HTTPS)', 'url', 'Leave empty to show a “notify me by email” link instead. A real signup form appears only when you paste your provider’s form URL. Also add its domain to form-action in _headers.'], ['note', 'Note shown under the form', 'text']]]];
  async function vSettings(el) {
    const { data, error } = await S.client.from('settings').select('key,value'); if (error) throw error; const cur = {}; (data || []).forEach(r => cur[r.key] = r.value || {});
    el.innerHTML = `<div class="head"><div><h1>Website settings</h1><p>Changes appear on the public website after saving.</p></div></div>` + SETS.map(([key, title, fs]) => `<form class="panel form" data-key="${key}" novalidate><h3 style="border:0;padding:0;margin:0">${title}</h3>${fs.map(([k, l, t, h]) => { const v = (cur[key] || {})[k]; return t === 'check' ? `<div class="chk full"><input type="checkbox" id="s_${key}_${k}" ${v ? 'checked' : ''}><label for="s_${key}_${k}" style="font-weight:600">${l}</label></div>` : `<div class="${t === 'textarea' ? 'full' : ''}"><label class="l" for="s_${key}_${k}">${l}</label>${t === 'textarea' ? `<textarea class="field" id="s_${key}_${k}" rows="3">${esc(v ?? '')}</textarea>` : `<input class="field" id="s_${key}_${k}" type="${t === 'text' ? 'text' : t}" value="${esc(v ?? '')}">`}${h ? `<div class="hint">${esc(h)}</div>` : ''}</div>`; }).join('')}<div class="full" data-m></div><div class="actions full" style="position:static;padding:0"><button class="btn" type="submit">Save ${title.toLowerCase()}</button></div></form>`).join('');
    $$('form[data-key]', el).forEach(f => f.onsubmit = async e => {
      e.preventDefault(); const key = f.dataset.key, def = SETS.find(s => s[0] === key)[2], val = {}, m = $('[data-m]', f);
      for (const [k, l, t] of def) { const x = $('#s_' + key + '_' + k); val[k] = t === 'check' ? x.checked : x.value.trim(); if (t === 'url' && val[k] && !https(val[k])) { m.innerHTML = `<div class="alert error">${esc(l)} must be a valid HTTPS URL.</div>`; return; } if (t === 'email' && val[k] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val[k])) { m.innerHTML = `<div class="alert error">Enter a valid email address.</div>`; return; } }
      if (key === 'announcement' && val.link_url && !https(val.link_url) && /^[a-z]+:/i.test(val.link_url)) { m.innerHTML = '<div class="alert error">The link must be a site path or an https:// URL.</div>'; return; }
      const b = $('button', f); busy(b, true, 'Saving…'); const { error: er } = await S.client.from('settings').upsert({ key, value: val }, { onConflict: 'key' }); busy(b, false);
      if (er) { m.innerHTML = `<div class="alert error">${esc(dbError(er))}</div>`; return; } m.innerHTML = ''; await logAct('update', 'settings', key, { title: key }); toast('Settings saved.');
    });
  }

  /* ---------- administrators (Super Admin) ---------- */
  async function vAdmins(el) {
    const { data, error } = await S.client.rpc('admin_directory'); if (error) throw error; const rows = data || [];
    el.innerHTML = `<div class="head"><div><h1>Administrators & roles</h1><p>Only the Super Admin can see and change this page. Roles are enforced by the database.</p></div></div>
<div class="panel"><h2>Assign a role</h2><p class="muted">First create the person in <strong>Supabase → Authentication → Users</strong>. Then enter the same email here. This never creates accounts or passwords.</p><form id="af" class="form" novalidate><div><label class="l" for="ae">Auth user email</label><input class="field" id="ae" type="email" required></div><div><label class="l" for="an">Display name</label><input class="field" id="an" type="text"></div><div><label class="l" for="ar">Role</label><select class="field" id="ar"><option value="editor">Editor: create & edit content</option><option value="admin">Admin: content, settings, deletion, activity log</option><option value="super_admin">Super Admin: everything incl. roles</option></select></div><div style="align-self:end"><button class="btn" type="submit">Assign role</button></div><div class="full" id="am"></div></form></div>
<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>${rows.map(r => { const me = r.user_id === S.user.id; return `<tr><td><strong>${esc(r.display_name)}</strong>${me ? ' <span class="badge">You</span>' : ''}</td><td>${esc(r.email)}</td><td><select class="field" data-role="${r.user_id}" ${me ? 'disabled' : ''} aria-label="Role for ${esc(r.email)}">${Object.keys(ROLE).map(k => `<option value="${k}" ${k === r.role ? 'selected' : ''}>${ROLE[k]}</option>`).join('')}</select></td><td>${r.active ? badge('published', 'Active') : badge('arch', 'Disabled')}</td><td>${r.last_sign_in_at ? esc(fmtDT(r.last_sign_in_at)) : '—'}</td><td><div class="acts">${me ? '' : `<button class="btn ghost sm" data-tog="${r.user_id}" data-act="${r.active}">${r.active ? 'Disable' : 'Enable'}</button><button class="btn danger sm" data-rm="${r.user_id}">Remove role</button>`}</div></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">No administrators.</td></tr>'}</tbody></table></div><p class="muted" style="margin-top:14px">“Remove role” revokes dashboard access. It does not delete the Auth account; do that in Supabase if needed.</p>`;
    $('#af').onsubmit = async e => { e.preventDefault(); const b = $('button', e.target), m = $('#am'); const em = $('#ae').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { m.innerHTML = '<div class="alert error">Enter a valid email.</div>'; return; } busy(b, true, 'Assigning…'); const { error: er } = await S.client.rpc('assign_admin_role', { p_email: em, p_role: $('#ar').value, p_name: $('#an').value.trim() }); busy(b, false); if (er) { m.innerHTML = `<div class="alert error">${esc(dbError(er))}</div>`; return; } await logAct('assign_role', 'admin_profiles', em, { title: em + ' → ' + $('#ar').value }); toast('Role assigned.'); route(); };
    el.onchange = async e => { const s = e.target.closest('[data-role]'); if (!s) return; const { error: er } = await S.client.from('admin_profiles').update({ role: s.value }).eq('user_id', s.dataset.role); if (er) { toast(dbError(er), true); return route(); } await logAct('change_role', 'admin_profiles', s.dataset.role, { title: s.value }); toast('Role updated.'); };
    el.onclick = async e => { const t = e.target.closest('[data-tog]'), r = e.target.closest('[data-rm]'); try { if (t) { const { error: er } = await S.client.from('admin_profiles').update({ active: t.dataset.act !== 'true' }).eq('user_id', t.dataset.tog); if (er) throw er; await logAct('toggle_active', 'admin_profiles', t.dataset.tog, {}); route(); } if (r) { if (!await confirmBox('Remove role?', 'This person will lose access to the administration area.', 'Remove role')) return; const { error: er } = await S.client.from('admin_profiles').delete().eq('user_id', r.dataset.rm); if (er) throw er; await logAct('remove_role', 'admin_profiles', r.dataset.rm, {}); route(); } } catch (er) { toast(dbError(er), true); } };
  }

  /* ---------- activity + account ---------- */
  async function vActivity(el) {
    const { data, error } = await S.client.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200); if (error) throw error; const names = {};
    if (can('admins')) { const d = await S.client.rpc('admin_directory'); (d.data || []).forEach(x => names[x.user_id] = x.display_name || x.email); }
    el.innerHTML = `<div class="head"><div><h1>Activity log</h1><p>Latest 200 recorded actions. Entries cannot be edited or deleted.</p></div></div><div class="tbl-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Item</th></tr></thead><tbody>${(data || []).map(a => `<tr><td>${esc(fmtDT(a.created_at))}</td><td>${a.actor_id === S.user.id ? 'You' : esc(names[a.actor_id] || (a.actor_id || '').slice(0, 8))}</td><td><span class="badge">${esc(a.action)}</span></td><td>${esc(a.entity)}${a.details && a.details.title ? ' · ' + esc(a.details.title) : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No activity yet.</td></tr>'}</tbody></table></div>`;
  }
  function vAccount(el) {
    el.innerHTML = `<div class="head"><div><h1>My account</h1></div></div><div class="two"><div class="panel"><h2>Account</h2><p>Email: <strong>${esc(S.user.email)}</strong></p><p>Name: <strong>${esc(S.profile.display_name || '—')}</strong></p><p>Role: <span class="badge">${esc(ROLE[S.profile.role])}</span></p><p class="muted">Your role and name are managed by the Super Admin.</p><button class="btn ghost" id="sg" type="button">Sign out on all devices</button></div>
<div class="panel"><h2>Change password</h2><div id="pm"></div><form id="pf" class="stack" novalidate><div><label class="l" for="n1">New password</label><input class="field" id="n1" type="password" autocomplete="new-password"><div class="hint">At least 10 characters. Use a unique password.</div></div><div><label class="l" for="n2">Confirm new password</label><input class="field" id="n2" type="password" autocomplete="new-password"></div><button class="btn" type="submit">Update password</button></form></div></div>`;
    $('#pf').onsubmit = async e => { e.preventDefault(); const a = $('#n1').value, b = $('#n2').value, m = (t, c = 'error') => $('#pm').innerHTML = `<div class="alert ${c}">${esc(t)}</div>`; if (a.length < 10) return m('Use at least 10 characters.'); if (a !== b) return m('The passwords do not match.'); const bt = $('button', e.target); busy(bt, true, 'Updating…'); const { error } = await S.client.auth.updateUser({ password: a }); busy(bt, false); if (error) return m(error.message); e.target.reset(); m('Password updated.', 'ok'); await logAct('password_change', 'account', S.user.id, {}); };
    $('#sg').onclick = async () => { await S.client.auth.signOut({ scope: 'global' }); S.user = S.profile = null; loginScreen('Signed out on all devices.'); };
  }

  /* ---------- boot ---------- */
  function boot() {
    const p = configProblem(); if (p) return setupScreen(p);
    S.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    S.client.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') recoveryScreen(); else if (ev === 'SIGNED_OUT' && S.profile) { S.user = S.profile = null; loginScreen('Your session ended. Please sign in again.'); } });
    if (/type=recovery/.test(location.hash + location.search)) return; enter().catch(e => { loginScreen(); console.error(e); });
  }
  boot();
})();
