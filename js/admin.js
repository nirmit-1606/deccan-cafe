document.addEventListener("DOMContentLoaded", () => {
  const { url, anonKey } = window.siteConfig.supabase;
  const db = supabase.createClient(url, anonKey);

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function init() {
    const { data: { session } } = await db.auth.getSession();
    session ? showDashboard() : showLogin();
  }

  function showLogin() {
    document.getElementById("login-screen").hidden = false;
    document.getElementById("dashboard").hidden = true;
  }

  function showDashboard() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("dashboard").hidden = false;
    loadCategories();
    loadItems();
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginError = document.getElementById("login-error");
    const loginBtn = document.getElementById("login-btn");
    loginError.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";

    const { error } = await db.auth.signInWithPassword({
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
    });

    if (error) {
      loginError.textContent = error.message;
      loginError.hidden = false;
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    } else {
      showDashboard();
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await db.auth.signOut();
    showLogin();
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = true; });
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
    });
  });

  // ── Categories ────────────────────────────────────────────────────────────

  let allCategories = [];

  async function loadCategories() {
    const loadingMsg = document.getElementById("cats-loading-msg");
    const table = document.getElementById("cats-table");
    loadingMsg.textContent = "Loading…";
    loadingMsg.hidden = false;
    table.hidden = true;

    const { data, error } = await db
      .from("categories")
      .select("*")
      .order("display_order");

    if (error) { loadingMsg.textContent = "Failed to load categories."; return; }

    allCategories = data;
    loadingMsg.hidden = true;
    renderCategoriesTable(data);
    table.hidden = false;
    populateCategoryDropdown(data);
  }

  function populateCategoryDropdown(categories) {
    const select = document.getElementById("item-category");
    const filter = document.getElementById("items-category-filter");
    const currentSelect = select.value;
    const currentFilter = filter.value;

    select.innerHTML = '<option value="">Select…</option>';
    filter.innerHTML = '<option value="">All Categories</option>';

    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
      filter.appendChild(opt.cloneNode(true));
    });

    if (currentSelect) select.value = currentSelect;
    if (currentFilter) filter.value = currentFilter;
  }

  function renderCategoriesTable(categories) {
    const tbody = document.getElementById("cats-tbody");
    tbody.innerHTML = "";
    categories.forEach((cat) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escHtml(cat.name)}</td>
        <td>${cat.display_order}</td>
        <td>
          <label class="toggle-label">
            <input type="checkbox" class="vis-toggle" data-id="${cat.id}" ${cat.visible ? "checked" : ""}>
            <span class="toggle-text">${cat.visible ? "Yes" : "No"}</span>
          </label>
        </td>
        <td class="actions-cell">
          <button class="btn-edit" data-id="${cat.id}">Edit</button>
          <button class="btn-delete" data-id="${cat.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".vis-toggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const visible = e.target.checked;
        e.target.nextElementSibling.textContent = visible ? "Yes" : "No";
        await db.from("categories").update({ visible }).eq("id", e.target.dataset.id);
      });
    });

    tbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        openCatModal(allCategories.find((c) => c.id === btn.dataset.id));
      });
    });

    tbody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const cat = allCategories.find((c) => c.id === btn.dataset.id);
        if (!confirm(`Delete category "${cat?.name}"? Items in this category will have no category assigned.`)) return;
        const { error } = await db.from("categories").delete().eq("id", btn.dataset.id);
        if (!error) loadCategories();
      });
    });
  }

  document.getElementById("add-cat-btn").addEventListener("click", () => openCatModal(null));
  document.getElementById("cat-cancel-btn").addEventListener("click", closeCatModal);
  document.getElementById("cat-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("cat-modal")) closeCatModal();
  });

  function openCatModal(cat) {
    document.getElementById("cat-form-error").hidden = true;
    document.getElementById("cat-id").value = cat?.id ?? "";
    document.getElementById("cat-name").value = cat?.name ?? "";
    document.getElementById("cat-order").value = cat?.display_order ?? "";
    document.getElementById("cat-visible").checked = cat?.visible ?? true;
    document.getElementById("cat-modal-title").textContent = cat ? "Edit Category" : "Add Category";
    document.getElementById("cat-save-btn").textContent = "Save Category";
    document.getElementById("cat-save-btn").disabled = false;
    document.getElementById("cat-modal").hidden = false;
    document.getElementById("cat-name").focus();
  }

  function closeCatModal() {
    document.getElementById("cat-modal").hidden = true;
    document.getElementById("cat-form").reset();
  }

  document.getElementById("cat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formError = document.getElementById("cat-form-error");
    const saveBtn = document.getElementById("cat-save-btn");
    formError.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const id = document.getElementById("cat-id").value;
    const payload = {
      name: document.getElementById("cat-name").value.trim(),
      display_order: parseInt(document.getElementById("cat-order").value, 10) || 999,
      visible: document.getElementById("cat-visible").checked,
    };

    const { error } = id
      ? await db.from("categories").update(payload).eq("id", id)
      : await db.from("categories").insert(payload);

    if (error) {
      formError.textContent = error.message;
      formError.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Category";
    } else {
      closeCatModal();
      loadCategories();
    }
  });

  // ── Menu Items ────────────────────────────────────────────────────────────

  let allItems = [];

  async function loadItems() {
    const loadingMsg = document.getElementById("items-loading-msg");
    const table = document.getElementById("items-table");
    loadingMsg.textContent = "Loading…";
    loadingMsg.hidden = false;
    table.hidden = true;

    const { data, error } = await db
      .from("menu_items")
      .select("*")
      .order("category")
      .order("item_order");

    if (error) { loadingMsg.textContent = "Failed to load items."; return; }

    allItems = data;
    loadingMsg.hidden = true;
    renderItemsTable(data);
    table.hidden = false;
  }

  function renderItemsTable(items) {
    const tbody = document.getElementById("items-tbody");
    tbody.innerHTML = "";
    items.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escHtml(item.name)}</td>
        <td>${escHtml(item.category)}</td>
        <td>$${Number(item.price).toFixed(2)}</td>
        <td>${item.item_order}</td>
        <td>
          <label class="toggle-label">
            <input type="checkbox" class="avail-toggle" data-id="${item.id}" ${item.available ? "checked" : ""}>
            <span class="toggle-text">${item.available ? "Yes" : "No"}</span>
          </label>
        </td>
        <td class="actions-cell">
          <button class="btn-edit" data-id="${item.id}">Edit</button>
          <button class="btn-delete" data-id="${item.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".avail-toggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const available = e.target.checked;
        e.target.nextElementSibling.textContent = available ? "Yes" : "No";
        await db.from("menu_items").update({ available }).eq("id", e.target.dataset.id);
      });
    });

    tbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        openItemModal(allItems.find((i) => i.id === btn.dataset.id));
      });
    });

    tbody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = allItems.find((i) => i.id === btn.dataset.id);
        if (!confirm(`Delete "${item?.name}"? This cannot be undone.`)) return;
        const { error } = await db.from("menu_items").delete().eq("id", btn.dataset.id);
        if (!error) loadItems();
      });
    });
  }

  document.getElementById("items-category-filter").addEventListener("change", () => {
    const category = document.getElementById("items-category-filter").value;
    const filtered = category ? allItems.filter((i) => i.category === category) : allItems;
    renderItemsTable(filtered);
  });

  document.getElementById("add-item-btn").addEventListener("click", () => openItemModal(null));
  document.getElementById("item-cancel-btn").addEventListener("click", closeItemModal);
  document.getElementById("item-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("item-modal")) closeItemModal();
  });

  function openItemModal(item) {
    document.getElementById("item-form-error").hidden = true;
    document.getElementById("item-id").value = item?.id ?? "";
    document.getElementById("item-name").value = item?.name ?? "";
    document.getElementById("item-category").value = item?.category ?? "";
    document.getElementById("item-price").value = item?.price ?? "";
    document.getElementById("item-order").value = item?.item_order ?? 999;
    document.getElementById("item-available").checked = item?.available ?? true;
    document.getElementById("item-description").value = item?.description ?? "";
    document.getElementById("modal-title").textContent = item ? "Edit Item" : "Add Item";
    document.getElementById("item-save-btn").textContent = "Save Item";
    document.getElementById("item-save-btn").disabled = false;
    document.getElementById("item-modal").hidden = false;
    document.getElementById("item-name").focus();
  }

  function closeItemModal() {
    document.getElementById("item-modal").hidden = true;
    document.getElementById("item-form").reset();
  }

  document.getElementById("item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formError = document.getElementById("item-form-error");
    const saveBtn = document.getElementById("item-save-btn");
    formError.hidden = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const id = document.getElementById("item-id").value;
    const payload = {
      name: document.getElementById("item-name").value.trim(),
      category: document.getElementById("item-category").value,
      price: parseFloat(document.getElementById("item-price").value),
      item_order: parseInt(document.getElementById("item-order").value, 10) || 999,
      available: document.getElementById("item-available").checked,
      description: document.getElementById("item-description").value.trim(),
    };

    const { error } = id
      ? await db.from("menu_items").update(payload).eq("id", id)
      : await db.from("menu_items").insert(payload);

    if (error) {
      formError.textContent = error.message;
      formError.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Item";
    } else {
      closeItemModal();
      loadItems();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeItemModal();
      closeCatModal();
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  init();
});
