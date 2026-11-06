(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const menuButton = $("#menuToggle");
  const nav = $("#primaryNav");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    });
    $$("#primaryNav a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("is-open"); menuButton.setAttribute("aria-expanded","false");
    }));
  }
  $$("[data-year]").forEach(el => el.textContent = new Date().getFullYear());
  const products = window.KITSPRING_PRODUCTS || [];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const collectionNames = {business:"Business",productivity:"Productivity",lifestyle:"Lifestyle",creative:"Creative",guides:"Guides"};
  function card(p) {
    const status = p.status === "available" ? "Available" : "Coming Soon";
    return `<article class="product-card">
      <div class="product-top"><span class="product-type">${esc(p.type)}</span><span class="status">${status}</span></div>
      <h3>${esc(p.name)}</h3><p>${esc(p.shortDescription)}</p>
      <a class="card-link" href="${location.pathname.includes("/collections/") ? "../" : ""}product.html?id=${encodeURIComponent(p.id)}">Explore resource <span aria-hidden="true">→</span></a>
    </article>`;
  }
  const grid = $("#productGrid");
  if (grid) {
    const search = $("#productSearch"), collection = $("#collectionFilter"), sort = $("#sortProducts"), note = $("#resultsNote");
    const initialCollection = new URLSearchParams(location.search).get("collection") || grid.dataset.collection || "all";
    if (collection && [...collection.options].some(o=>o.value===initialCollection)) collection.value = initialCollection;
    function render() {
      const q = (search?.value || "").trim().toLowerCase();
      let list = products.filter(p => (collection?.value === "all" || !collection?.value || p.collection === collection.value)
        && (!q || [p.name,p.description,p.type,p.collection,p.audience].join(" ").toLowerCase().includes(q)));
      if (sort?.value === "az") list.sort((a,b)=>a.name.localeCompare(b.name));
      if (sort?.value === "za") list.sort((a,b)=>b.name.localeCompare(a.name));
      if (sort?.value === "featured") list.sort((a,b)=>Number(b.featured)-Number(a.featured));
      grid.innerHTML = list.length ? list.map(card).join("") : `<div class="empty-state"><strong>No matching resources yet.</strong><br>Try another search or collection.</div>`;
      if(note) note.textContent = `${list.length} ${list.length===1?"resource":"resources"} shown`;
    }
    [search,collection,sort].filter(Boolean).forEach(el=>el.addEventListener(el===search?"input":"change",render));
    render();
  }
  const detail = $("#productDetail");
  if (detail) {
    const id = new URLSearchParams(location.search).get("id");
    const p = products.find(x=>x.id===id);
    if (!p) {
      detail.innerHTML = `<div class="notice">We couldn't find that resource. Browse the <a href="shop.html">full catalogue</a> instead.</div>`;
    } else {
      document.title = `${p.name} | KitSpring`;
      const available = p.status === "available" && p.checkoutUrl;
      detail.innerHTML = `
        <div class="detail-layout">
          <div>
            <div class="eyebrow">${esc(collectionNames[p.collection] || "KitSpring")} · ${esc(p.type)}</div>
            <h1 style="font-family:Manrope,sans-serif;color:var(--green);font-size:clamp(2.3rem,5vw,4rem);line-height:1.08;letter-spacing:-.055em">${esc(p.name)}</h1>
            <p style="font-size:1.12rem;color:var(--muted)">${esc(p.description)}</p>
            <h2>What it is</h2><p>${esc(p.details)}</p>
            <h2>What's included</h2><ul>${p.includes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
            <h2>Who it's for</h2><p>${esc(p.audience)}.</p>
          </div>
          <aside class="detail-panel">
            <span class="status">${p.status==="available"?"Available":"Coming Soon"}</span>
            <h2 style="margin-top:18px">A useful resource, thoughtfully made.</h2>
            <p class="muted">${p.status==="available"?"This resource is available through our secure external checkout.":"This resource is still in development. It is not currently available to purchase."}</p>
            ${available ? `<a class="btn" href="${esc(p.checkoutUrl)}" target="_blank" rel="noopener noreferrer">Get this resource</a>` : `<span class="btn btn-outline" aria-disabled="true">Coming Soon</span>`}
            <p class="muted" style="font-size:.82rem;margin-top:18px">Questions? <a href="contact.html">Contact KitSpring</a>.</p>
          </aside>
        </div>`;
    }
  }
  const contactForm = $("#contactForm");
  if(contactForm) contactForm.addEventListener("submit", e=>{
    e.preventDefault();
    const data = new FormData(contactForm);
    const subject = encodeURIComponent(`KitSpring enquiry: ${data.get("topic") || "General"}`);
    const body = encodeURIComponent(`Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`);
    location.href = `mailto:kitspring@gmail.com?subject=${subject}&body=${body}`;
  });
})();
