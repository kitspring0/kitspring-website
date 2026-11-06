(() => {
  'use strict';

  const appRoot = document.getElementById('app');
  if (!appRoot) return;

  const state = {
    client: null,
    user: null,
    profile: null,
    authReady: false,
    view: 'overview',
    records: {},
    message: '',
    error: '',
    lastLoaded: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function getConfig() {
    const config = window.KITSPRING_CONFIG || window.KITSPRING_PUBLIC_CONFIG || {};
    return {
      supabaseUrl: config.supabaseUrl || '',
      supabaseAnonKey: config.supabaseAnonKey || '',
      valid: !!(config.supabaseUrl && config.supabaseAnonKey && !isPlaceholder(config.supabaseUrl) && !isPlaceholder(config.supabaseAnonKey))
    };
  }

  function isPlaceholder(value) {
    return !value || /YOUR_PROJECT|YOUR_SUPABASE|placeholder|replace-me|example/i.test(String(value));
  }

  function setMessage(type, text) {
    state.error = type === 'error' ? text : '';
    state.message = type === 'success' ? text : '';
    render();
  }

  function renderEmptyState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function safeText(value) {
    return String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function buildLoginView() {
    return `
      <div class="login-panel">
        <div class="admin-brand">
          <div class="admin-brand-mark">K</div>
          <div class="admin-brand-copy">
            <strong>KitSpring</strong>
            <span>Administration</span>
          </div>
        </div>

        <div class="auth-card">
          <h2 style="margin:0 0 18px; font-size:1.7rem;">Sign in</h2>
          <form id="loginForm">
            <div class="field-group">
              <label class="field-label" for="email">Email address</label>
              <input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="password">Password</label>
              <div class="password-wrap">
                <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                <button type="button" class="password-toggle" id="togglePassword">Show</button>
              </div>
            </div>
            <button class="primary-btn" id="signInButton" type="submit">Sign in</button>
            <div class="inline-actions">
              <span class="inline-link" id="resetPasswordLink">Forgot password?</span>
              <span class="notice" style="padding:8px 10px; font-size:0.75rem;">Secure staff access</span>
            </div>
          </form>
          <div id="loginMessage"></div>
        </div>
      </div>
    `;
  }

  function renderPlaceholderState() {
    appRoot.innerHTML = `
      <div class="login-panel">
        <div class="admin-brand">
          <div class="admin-brand-mark">K</div>
          <div class="admin-brand-copy">
            <strong>KitSpring</strong>
            <span>Administration</span>
          </div>
        </div>

        <div class="auth-card">
          <h2 style="margin:0 0 12px; font-size:1.7rem;">Configuration required</h2>
          <p class="notice">The admin area is active, but it cannot connect to Supabase until the project URL and anon key are configured in both <strong>config.js</strong> files.</p>
          <div class="form-error" style="margin-top:14px;">Supabase is still using placeholder values. Update the project URL and public anon key before signing in.</div>
          <div class="status-box" style="margin-top:14px;">Open the project root config.js and admin/config.js, replace the placeholders, then reload this page.</div>
        </div>
      </div>
    `;
  }

  function renderSupabaseError(message) {
    appRoot.innerHTML = `
      <div class="login-panel">
        <div class="admin-brand">
          <div class="admin-brand-mark">K</div>
          <div class="admin-brand-copy">
            <strong>KitSpring</strong>
            <span>Administration</span>
          </div>
        </div>

        <div class="auth-card">
          <h2 style="margin:0 0 12px; font-size:1.7rem;">Connection issue</h2>
          <p class="notice">The Supabase JavaScript library did not load correctly or the configured project is unreachable.</p>
          <div class="form-error" style="margin-top:14px;">${safeText(message)}</div>
        </div>
      </div>
    `;
  }

  function badgeClass(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '_');
  }

  function renderOverview() {
    const cards = [
      { label: 'Products', value: state.records.products?.length || 0 },
      { label: 'Collections', value: state.records.collections?.length || 0 },
      { label: 'Pages', value: state.records.pages?.length || 0 },
      { label: 'Posts', value: state.records.posts?.length || 0 }
    ];

    return `
      <div class="section-grid">
        ${cards.map(card => `
          <div class="metric-card">
            <small>${card.label}</small>
            <strong>${card.value}</strong>
            <span>Live records</span>
          </div>
        `).join('')}
      </div>

      <div class="workspace">
        <div class="toolbar">
          <h3 style="margin:0;">Overview</h3>
        </div>
        <div class="form-card">
          <h4 style="margin:0 0 10px;">Account status</h4>
          <p style="margin:0; color:var(--muted);">Signed in as <strong>${safeText(state.user?.email || 'Staff member')}</strong>.</p>
          <p style="margin:10px 0 0; color:var(--muted);">Role: <span class="badge ${badgeClass(state.profile?.role || 'editor')}">${safeText(state.profile?.role || 'editor')}</span></p>
        </div>
      </div>
    `;
  }

  function renderTable(tableName, columns, rows, emptyText) {
    if (!rows || rows.length === 0) {
      return renderEmptyState(emptyText);
    }

    const header = columns.map(column => `<th>${safeText(column.label)}</th>`).join('');
    const body = rows.map((row) => {
      const cells = columns.map((column) => {
        const value = row[column.key];
        if (column.key === 'role') {
          return `<td><span class="badge ${badgeClass(value)}">${safeText(value)}</span></td>`;
        }
        if (column.key === 'status') {
          return `<td><span class="badge ${badgeClass(value)}">${safeText(value)}</span></td>`;
        }
        if (column.key === 'published' || column.key === 'visible' || column.key === 'active') {
          return `<td>${value ? 'Yes' : 'No'}</td>`;
        }
        return `<td>${safeText(value ?? '')}</td>`;
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function renderProducts() {
    const rows = state.records.products || [];
    const table = renderTable('products', [
      { key: 'name', label: 'Name' },
      { key: 'collection', label: 'Collection' },
      { key: 'status', label: 'Status' },
      { key: 'price', label: 'Price' },
      { key: 'visible', label: 'Visible' }
    ], rows, 'No products yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Products</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderCollections() {
    const rows = state.records.collections || [];
    const table = renderTable('collections', [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'visible', label: 'Visible' },
      { key: 'sort_order', label: 'Sort' }
    ], rows, 'No collections yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Collections</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderPages() {
    const rows = state.records.pages || [];
    const table = renderTable('pages', [
      { key: 'title', label: 'Title' },
      { key: 'slug', label: 'Slug' },
      { key: 'published', label: 'Published' },
      { key: 'updated_at', label: 'Updated' }
    ], rows, 'No pages yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Pages</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderPosts() {
    const rows = state.records.posts || [];
    const table = renderTable('posts', [
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status' },
      { key: 'published_at', label: 'Published' },
      { key: 'created_at', label: 'Created' }
    ], rows, 'No blog posts yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Blog & resources</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderFaqs() {
    const rows = state.records.faqs || [];
    const table = renderTable('faqs', [
      { key: 'question', label: 'Question' },
      { key: 'published', label: 'Published' },
      { key: 'sort_order', label: 'Order' }
    ], rows, 'No FAQs yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">FAQs</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderMedia() {
    return `
      <div class="toolbar">
        <h3 style="margin:0;">Media library</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      <div class="notice">The media bucket is private. Uploaded files should be stored in a user-specific folder and copied through signed URLs when used in the CMS.</div>
    `;
  }

  function renderSettings() {
    return `
      <div class="toolbar">
        <h3 style="margin:0;">Website settings</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      <div class="notice">Settings are read from the public.settings table and can be managed by a Super Admin or Admin role.</div>
    `;
  }

  function renderAdmins() {
    const rows = state.records.admin_profiles || [];
    const table = renderTable('admin_profiles', [
      { key: 'display_name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'active', label: 'Active' }
    ], rows, 'No administrators assigned yet.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Administrators</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderActivity() {
    const rows = state.records.activity_log || [];
    const table = renderTable('activity_log', [
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'created_at', label: 'When' }
    ], rows, 'No recent activity.');

    return `
      <div class="toolbar">
        <h3 style="margin:0;">Activity log</h3>
        <div class="toolbar-actions">
          <button class="secondary-btn" type="button" data-action="reload">Refresh</button>
        </div>
      </div>
      ${table}
    `;
  }

  function renderAccount() {
    return `
      <div class="toolbar">
        <h3 style="margin:0;">Account</h3>
      </div>
      <div class="workspace">
        <div class="form-card">
          <p><strong>Email:</strong> ${safeText(state.user?.email || '')}</p>
          <p><strong>Role:</strong> ${safeText(state.profile?.role || 'editor')}</p>
          <button class="danger-btn" type="button" id="signOutBtn">Sign out</button>
        </div>
      </div>
    `;
  }

  function renderDashboardContent() {
    switch (state.view) {
      case 'products': return renderProducts();
      case 'collections': return renderCollections();
      case 'pages': return renderPages();
      case 'posts': return renderPosts();
      case 'faqs': return renderFaqs();
      case 'media': return renderMedia();
      case 'settings': return renderSettings();
      case 'admins': return renderAdmins();
      case 'activity': return renderActivity();
      case 'account': return renderAccount();
      case 'overview':
      default: return renderOverview();
    }
  }

  function renderDashboardShell() {
    const navItems = [
      ['overview', 'Overview'],
      ['products', 'Products'],
      ['collections', 'Collections'],
      ['pages', 'Pages'],
      ['posts', 'Posts'],
      ['faqs', 'FAQs'],
      ['media', 'Media'],
      ['settings', 'Settings'],
      ['admins', 'Administrators'],
      ['activity', 'Activity'],
      ['account', 'Account']
    ];

    appRoot.innerHTML = `
      <div class="admin-app dashboard-shell">
        <aside class="sidebar">
          <div class="sidebar-brand">
            <div class="sidebar-brand-mark">K</div>
            <div>
              <strong>KitSpring</strong><br>
              <small style="opacity:0.8;">CMS</small>
            </div>
          </div>
          <nav class="sidebar-nav">
            ${navItems.map(([key, label]) => `
              <button type="button" class="nav-btn ${state.view === key ? 'active' : ''}" data-view="${key}">
                <span>${label}</span>
                <span class="nav-meta">${key === 'overview' ? 'Home' : 'Open'}</span>
              </button>
            `).join('')}
          </nav>
          <div class="sidebar-footer">
            <button type="button" class="ghost-btn" id="signOutBtn" style="width:100%;">Sign out</button>
          </div>
        </aside>

        <main class="main-panel">
          <div class="topbar">
            <h1>Dashboard</h1>
            <div class="user-pill">
              <span class="avatar">${safeText((state.user?.email || 'A').slice(0, 1).toUpperCase())}</span>
              <span>${safeText(state.user?.email || 'Staff')}</span>
            </div>
          </div>
          ${state.error ? `<div class="form-error">${safeText(state.error)}</div>` : ''}
          ${state.message ? `<div class="status-box">${safeText(state.message)}</div>` : ''}
          ${renderDashboardContent()}
        </main>
      </div>
    `;

    bindDashboardEvents();
  }

  function bindDashboardEvents() {
    $$('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.getAttribute('data-view');
        if (!view) return;
        state.view = view;
        renderDashboardShell();
      });
    });

    const reloadBtn = $('#signOutBtn');
    if (reloadBtn) reloadBtn.addEventListener('click', handleSignOut);

    $$('[data-action="reload"]').forEach((button) => {
      button.addEventListener('click', async () => {
        await loadDashboardRecords();
        renderDashboardShell();
      });
    });
  }

  async function loadDashboardRecords() {
    if (!state.client) return;

    try {
      const queries = [
        ['products', 'products'],
        ['collections', 'collections'],
        ['pages', 'pages'],
        ['posts', 'posts'],
        ['faqs', 'faqs'],
        ['admin_profiles', 'admin_profiles'],
        ['activity_log', 'activity_log']
      ];

      const results = {};
      for (const [key, table] of queries) {
        const { data, error } = await state.client.from(table).select('*').order('created_at', { ascending: false });
        if (error) {
          results[key] = [];
        } else {
          results[key] = data || [];
        }
      }
      state.records = results;
    } catch (error) {
      state.error = 'Failed to load admin records: ' + (error?.message || 'Unknown error');
    }
  }

  async function startSession() {
    const cfg = getConfig();

    if (!cfg.valid) {
      renderPlaceholderState();
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      renderSupabaseError('The Supabase SDK failed to load. Check your internet connection and the CDN script included in admin/index.html.');
      return;
    }

    state.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    try {
      const { data: { session }, error } = await state.client.auth.getSession();
      if (error) throw error;
      if (session?.user) {
        state.user = session.user;
        await loadProfile();
        await loadDashboardRecords();
        renderDashboardShell();
      } else {
        appRoot.innerHTML = buildLoginView();
        bindLoginEvents();
      }
    } catch (error) {
      renderSupabaseError(error?.message || 'Unable to read the current session.');
    }
  }

  async function loadProfile() {
    if (!state.client || !state.user) return;
    try {
      const { data, error } = await state.client.from('admin_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
      if (error) throw error;
      state.profile = data || { role: 'editor', display_name: 'Staff member' };
    } catch (error) {
      state.profile = { role: 'editor', display_name: 'Staff member' };
    }
  }

  function bindLoginEvents() {
    const form = $('#loginForm');
    const toggle = $('#togglePassword');
    const resetLink = $('#resetPasswordLink');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const passwordField = $('#password');
        if (!passwordField) return;
        const isHidden = passwordField.type === 'password';
        passwordField.type = isHidden ? 'text' : 'password';
        toggle.textContent = isHidden ? 'Hide' : 'Show';
      });
    }

    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = $('#email')?.value.trim();
        const password = $('#password')?.value;
        const messageBox = $('#loginMessage');

        if (!email || !password) {
          if (messageBox) {
            messageBox.innerHTML = '<div class="form-error">Email and password are required.</div>';
          }
          return;
        }

        const signInButton = $('#signInButton');
        if (signInButton) {
          signInButton.disabled = true;
          signInButton.innerHTML = '<span class="loader"></span> Signing in';
        }

        try {
          const { data, error } = await state.client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (!data?.user) throw new Error('No authenticated session returned.');
          state.user = data.user;
          await loadProfile();
          await loadDashboardRecords();
          renderDashboardShell();
        } catch (error) {
          if (messageBox) {
            messageBox.innerHTML = `<div class="form-error">${safeText(error?.message || 'Authentication failed.')}</div>`;
          }
        } finally {
          if (signInButton) {
            signInButton.disabled = false;
            signInButton.innerHTML = 'Sign in';
          }
        }
      });
    }

    if (resetLink) {
      resetLink.addEventListener('click', async () => {
        const email = $('#email')?.value.trim();
        const messageBox = $('#loginMessage');
        if (!email) {
          if (messageBox) {
            messageBox.innerHTML = '<div class="form-error">Enter your email first so a reset link can be sent.</div>';
          }
          return;
        }

        try {
          const { error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/` });
          if (error) throw error;
          if (messageBox) {
            messageBox.innerHTML = '<div class="status-box">Password reset email sent. Check your inbox and spam folder.</div>';
          }
        } catch (error) {
          if (messageBox) {
            messageBox.innerHTML = `<div class="form-error">${safeText(error?.message || 'Password reset failed.')}</div>`;
          }
        }
      });
    }
  }

  async function handleSignOut() {
    try {
      if (state.client) {
        await state.client.auth.signOut();
      }
      state.user = null;
      state.profile = null;
      state.records = {};
      appRoot.innerHTML = buildLoginView();
      bindLoginEvents();
      const cfg = getConfig();
      if (cfg.valid && window.supabase && window.supabase.createClient) {
        state.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      }
    } catch (error) {
      state.error = error?.message || 'Sign out failed.';
      renderDashboardShell();
    }
  }

  const cfg = getConfig();
  if (!cfg.valid) {
    renderPlaceholderState();
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      startSession();
    };
    script.onerror = () => {
      renderSupabaseError('The Supabase CDN could not be loaded. Check the network connection and confirm the script URL is allowed.');
    };
    document.head.appendChild(script);
    return;
  }

  startSession();
})();
