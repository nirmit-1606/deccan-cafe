document.addEventListener("DOMContentLoaded", async () => {
  const CATEGORY_ORDER = [
    "Breakfast",
    "Snacks",
    "Salad",
    "Soups",
    "Appetizers",
    "Tandoori Entries",
    "Curries",
    "Biryani",
    "Rice",
    "Breads",
    "Dessert",
    "Drinks",
  ];

  const categoriesContainer = document.getElementById("menu-categories");
  const itemsContainer = document.getElementById("menu-items");

  // Show loading state while fetching
  itemsContainer.innerHTML = '<p class="menu-loading">Loading menu…</p>';

  let data = [];
  try {
    const { url, anonKey } = window.siteConfig.supabase;
    const res = await fetch(
      `${url}/rest/v1/menu_items?select=id,name,price,category,item_order,description&available=eq.true`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    itemsContainer.innerHTML = '<p class="menu-loading">Unable to load menu. Please try again later.</p>';
    return;
  }

  itemsContainer.innerHTML = "";

  const categories = CATEGORY_ORDER.filter((cat) =>
    data.some((item) => item.category === cat)
  );

  // Create a custom dropdown for mobile devices
  const mobileDropdownWrapper = document.createElement("div");
  mobileDropdownWrapper.className = "category-dropdown-wrapper";
  const mobileToggle = document.createElement("button");
  mobileToggle.className = "category-dropdown-toggle";
  mobileToggle.setAttribute("aria-haspopup", "listbox");
  mobileToggle.setAttribute("aria-expanded", "false");

  mobileToggle.innerHTML = `
    <span class="category-dropdown-label">Categories</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  `;

  const mobileList = document.createElement("ul");
  mobileList.className = "category-dropdown-list";
  mobileList.setAttribute("role", "listbox");

  mobileDropdownWrapper.appendChild(mobileToggle);
  mobileDropdownWrapper.appendChild(mobileList);
  categoriesContainer.parentNode.insertBefore(mobileDropdownWrapper, categoriesContainer);

  // Create category buttons
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.innerText = cat;
    btn.dataset.category = cat;
    btn.addEventListener("click", () => selectCategory(cat, true));
    categoriesContainer.appendChild(btn);

    const li = document.createElement("li");
    li.className = "category-dropdown-item";
    li.setAttribute("role", "option");
    li.tabIndex = 0;
    li.innerText = cat;
    li.dataset.category = cat;
    li.setAttribute("aria-selected", "false");
    li.addEventListener("click", () => { selectCategory(cat, true); closeDropdown(); });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectCategory(cat, true);
        closeDropdown();
      }
    });
    mobileList.appendChild(li);
  });

  function selectCategory(category, scrollToTop) {
    const labelEl = mobileToggle.querySelector(".category-dropdown-label");
    if (labelEl && labelEl.innerText !== category) labelEl.innerText = category;

    document.querySelectorAll(".category-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.category === category);
    });

    mobileList.querySelectorAll(".category-dropdown-item").forEach((li) => {
      const match = li.dataset.category === category;
      li.classList.toggle("active", match);
      li.setAttribute("aria-selected", String(match));
    });

    displayItems(category, scrollToTop);
  }

  if (categories.length) {
    selectCategory(categories[0], false);
  }

  function displayItems(category, scrollToTop) {
    itemsContainer.innerHTML = "";

    const filtered = data
      .filter((item) => item.category === category)
      .sort((a, b) => a.item_order - b.item_order);

    filtered.forEach((item) => {
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <div class="item-row">
          <span class="item-name">${item.name}</span>
          <span class="dots"></span>
          <span class="item-price">$${Number(item.price).toFixed(2)}</span>
        </div>
        ${item.description ? `<p class="item-desc">${item.description}</p>` : ""}
      `;
      itemsContainer.appendChild(div);
    });

    if (scrollToTop) {
      try {
        const menuSection = document.querySelector(".menu");
        const header = document.querySelector("header");
        const offset = header ? header.offsetHeight : 0;
        if (menuSection) {
          const target = menuSection.getBoundingClientRect().top + window.scrollY - offset - 8;
          window.scrollTo({ top: target, behavior: "smooth" });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  function openDropdown() {
    mobileDropdownWrapper.classList.add("open");
    mobileToggle.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    mobileDropdownWrapper.classList.remove("open");
    mobileToggle.setAttribute("aria-expanded", "false");
  }

  mobileToggle.addEventListener("click", () => {
    mobileDropdownWrapper.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  document.addEventListener("click", (e) => {
    if (!mobileDropdownWrapper.contains(e.target)) closeDropdown();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdown();
  });

  (function setStickyOffset() {
    try {
      const header = document.querySelector("header");
      const offset = header ? header.offsetHeight : 0;
      mobileDropdownWrapper.style.position = "sticky";
      mobileDropdownWrapper.style.top = offset + "px";
      mobileDropdownWrapper.style.zIndex = 10;
    } catch (e) {
      // noop
    }
  })();

  window.addEventListener("scroll", () => {
    const header = document.querySelector("header");
    const offset = header ? header.offsetHeight : 0;
    mobileDropdownWrapper.style.top = offset + "px";
  });
});
