document.addEventListener("DOMContentLoaded", async () => {
  const tabsEl     = document.getElementById("menu-tabs");
  const tabsWrapEl = document.getElementById("menu-tabs-wrap");
  const sectionsEl = document.getElementById("menu-sections");
  const loadingEl  = document.getElementById("menu-loading");
  const headerEl   = document.querySelector("header");

  // ── Fetch data ─────────────────────────────────────────

  const { url, anonKey } = window.siteConfig.supabase;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  let categories = [];
  let items = [];

  try {
    const { menuItems: miTable, categories: catTable } = window.siteConfig.tables;
    const [catRes, itemsRes] = await Promise.all([
      fetch(`${url}/rest/v1/${catTable}?select=name,display_order&visible=eq.true&order=display_order`, { headers }),
      fetch(`${url}/rest/v1/${miTable}?select=id,name,price,category,item_order,description&available=eq.true`, { headers }),
    ]);

    if (!catRes.ok || !itemsRes.ok) throw new Error("fetch failed");

    const catsData = await catRes.json();
    items      = await itemsRes.json();
    categories = catsData.map((c) => c.name).filter((cat) => items.some((i) => i.category === cat));
  } catch {
    loadingEl.textContent = "Unable to load menu. Please try again later.";
    return;
  }

  loadingEl.remove();

  // ── Build tabs ─────────────────────────────────────────

  categories.forEach((cat, idx) => {
    const btn = document.createElement("button");
    btn.className   = "menu-tab" + (idx === 0 ? " menu-tab--active" : "");
    btn.textContent = cat;
    btn.dataset.category = cat;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", idx === 0 ? "true" : "false");
    btn.addEventListener("click", () => scrollToSection(cat));
    tabsEl.appendChild(btn);
  });

  // ── Build sections ─────────────────────────────────────

  categories.forEach((cat) => {
    const section = document.createElement("section");
    section.className       = "menu-section";
    section.id              = `cat-${slugify(cat)}`;
    section.dataset.category = cat;

    const heading = document.createElement("h3");
    heading.className   = "menu-section-heading";
    heading.textContent = cat;
    section.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "menu-item-list";

    items
      .filter((i) => i.category === cat)
      .sort((a, b) => a.item_order - b.item_order)
      .forEach((item) => {
        const li = document.createElement("li");
        li.className = "menu-item";
        li.innerHTML = `
          <div class="item-main">
            <span class="item-name">${escHtml(item.name)}</span>
            ${item.description ? `<p class="item-desc">${escHtml(item.description)}</p>` : ""}
          </div>
          <span class="item-price">$${Number(item.price).toFixed(2)}</span>
        `;
        list.appendChild(li);
      });

    section.appendChild(list);
    sectionsEl.appendChild(section);
  });

  // ── Sticky tab-strip offset ────────────────────────────

  function getHeaderHeight() { return headerEl?.offsetHeight ?? 0; }

  function updateTabsTop() {
    tabsWrapEl.style.top = getHeaderHeight() + "px";
  }

  updateTabsTop();

  // ── scroll-margin-top for sections ────────────────────

  function updateScrollMargins() {
    const offset = getHeaderHeight() + (tabsWrapEl?.offsetHeight ?? 0) + 8;
    document.querySelectorAll(".menu-section").forEach((s) => {
      s.style.scrollMarginTop = offset + "px";
    });
  }

  updateScrollMargins();

  // ── IntersectionObserver — active tab sync ─────────────

  function buildObserver() {
    const topGutter = getHeaderHeight() + (tabsWrapEl?.offsetHeight ?? 0);
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveTab(entry.target.dataset.category);
        });
      },
      {
        rootMargin: `-${topGutter}px 0px -55% 0px`,
        threshold: 0,
      }
    );
  }

  let observer = buildObserver();
  document.querySelectorAll(".menu-section").forEach((s) => observer.observe(s));

  // ResizeObserver on header — fires on both scroll-shrink and viewport resize,
  // keeping the tab strip top and scroll margins in sync at all times.
  if (headerEl) {
    const headerRO = new ResizeObserver(() => {
      updateTabsTop();
      updateScrollMargins();
    });
    headerRO.observe(headerEl);
  }

  // Rebuild IntersectionObserver on viewport resize so rootMargin stays accurate
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      observer.disconnect();
      observer = buildObserver();
      document.querySelectorAll(".menu-section").forEach((s) => observer.observe(s));
    }, 200);
  });

  // ── Helpers ────────────────────────────────────────────

  function setActiveTab(cat) {
    tabsEl.querySelectorAll(".menu-tab").forEach((btn) => {
      const active = btn.dataset.category === cat;
      btn.classList.toggle("menu-tab--active", active);
      btn.setAttribute("aria-selected", String(active));
      if (active) {
        btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });
  }

  function scrollToSection(cat) {
    const section = document.getElementById(`cat-${slugify(cat)}`);
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});
