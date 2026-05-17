document.addEventListener("DOMContentLoaded", () => {
  const { url, anonKey } = window.siteConfig.supabase;
  const db = supabase.createClient(url, anonKey);

  // ── Pending changes ───────────────────────────────────────────────────────
  // pending.menu_items / pending.categories hold field-level changes keyed by id.
  // pending.deletes holds ids queued for deletion.

  const pending = {
    menu_items: {},
    categories: {},
    deletes: {
      menu_items: new Set(),
      categories: new Set(),
    },
  };

  function trackChange(table, id, changes) {
    pending[table][id] = { ...pending[table][id], ...changes };
    updateSaveBar();
  }

  function updateSaveBar() {
    const edits   = Object.keys(pending.menu_items).length + Object.keys(pending.categories).length;
    const deletes = pending.deletes.menu_items.size + pending.deletes.categories.size;
    const total   = edits + deletes;

    document.getElementById("save-bar").hidden = total === 0;

    const parts = [];
    if (edits)   parts.push(`${edits} edit${edits !== 1 ? "s" : ""}`);
    if (deletes) parts.push(`${deletes} deletion${deletes !== 1 ? "s" : ""}`);
    document.getElementById("save-bar-count").textContent = parts.join(", ") + " pending";
  }

  async function saveAllChanges() {
    const saveBtn = document.getElementById("save-changes-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const itemDeletes = [...pending.deletes.menu_items];
    const catDeletes  = [...pending.deletes.categories];

    // Separate new items (temp IDs) from edits to existing rows
    const itemInserts = Object.entries(pending.menu_items)
      .filter(([id]) => id.startsWith("temp_"))
      .map(([, c]) => { const { id: _id, ...rest } = c; return rest; }); // strip temp ID

    const itemUpdates = Object.entries(pending.menu_items)
      .filter(([id]) => !id.startsWith("temp_") && !pending.deletes.menu_items.has(id))
      .map(([id, c]) => ({ ...allItems.find((i) => i.id === id), ...c }));

    const catUpdates = Object.entries(pending.categories)
      .filter(([id]) => !pending.deletes.categories.has(id))
      .map(([id, c]) => ({ ...allCategories.find((cat) => cat.id === id), ...c }));

    const ops = [];
    if (itemDeletes.length) ops.push(db.from("menu_items").delete().in("id", itemDeletes));
    if (catDeletes.length)  ops.push(db.from("categories").delete().in("id", catDeletes));
    if (itemInserts.length) ops.push(db.from("menu_items").insert(itemInserts));
    if (itemUpdates.length) ops.push(db.from("menu_items").upsert(itemUpdates));
    if (catUpdates.length)  ops.push(db.from("categories").upsert(catUpdates));

    const results = await Promise.all(ops);
    const failed  = results.find((r) => r.error);

    if (failed) {
      alert(`Save failed: ${failed.error.message}`);
    } else {
      pending.menu_items = {};
      pending.categories = {};
      pending.deletes.menu_items.clear();
      pending.deletes.categories.clear();
      updateSaveBar();
      loadItems();
      loadCategories();
    }

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }

  function discardChanges() {
    allItems = allItems.filter((i) => !i.id.startsWith("temp_"));
    pending.menu_items = {};
    pending.categories = {};
    pending.deletes.menu_items.clear();
    pending.deletes.categories.clear();
    updateSaveBar();
    loadItems();
    loadCategories();
  }

  document.getElementById("save-changes-btn").addEventListener("click", () => {
    const deleteCount = pending.deletes.menu_items.size + pending.deletes.categories.size;
    if (deleteCount > 0) {
      const parts = [];
      if (pending.deletes.menu_items.size)
        parts.push(`${pending.deletes.menu_items.size} menu item${pending.deletes.menu_items.size !== 1 ? "s" : ""}`);
      if (pending.deletes.categories.size)
        parts.push(`${pending.deletes.categories.size} categor${pending.deletes.categories.size !== 1 ? "ies" : "y"}`);
      document.getElementById("confirm-delete-msg").textContent =
        `You are about to permanently delete ${parts.join(" and ")}. This cannot be undone. Any other pending edits will also be saved.`;
      document.getElementById("confirm-delete-modal").hidden = false;
    } else {
      saveAllChanges();
    }
  });

  document.getElementById("confirm-cancel-btn").addEventListener("click", () => {
    document.getElementById("confirm-delete-modal").hidden = true;
  });

  document.getElementById("confirm-save-btn").addEventListener("click", () => {
    document.getElementById("confirm-delete-modal").hidden = true;
    saveAllChanges();
  });

  document.getElementById("discard-btn").addEventListener("click", discardChanges);

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
    const loginBtn   = document.getElementById("login-btn");
    loginError.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";

    const { error } = await db.auth.signInWithPassword({
      email:    document.getElementById("email").value,
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
    const table      = document.getElementById("cats-table");
    loadingMsg.textContent = "Loading…";
    loadingMsg.hidden = false;
    table.hidden = true;

    const { data, error } = await db.from("categories").select("*").order("display_order");
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
      const isDeleted = pending.deletes.categories.has(cat.id);
      const isPending = !isDeleted && cat.id in pending.categories;
      const display   = { ...cat, ...(pending.categories[cat.id] || {}) };

      const tr = document.createElement("tr");
      if (isDeleted) tr.classList.add("row--deleted");
      else if (isPending) tr.classList.add("row--pending");

      tr.innerHTML = `
        <td>${escHtml(display.name)}</td>
        <td>${display.display_order}</td>
        <td>
          <label class="toggle-label">
            <input type="checkbox" class="vis-toggle" data-id="${cat.id}"
              ${display.visible ? "checked" : ""} ${isDeleted ? "disabled" : ""}>
            <span class="toggle-text">${display.visible ? "Yes" : "No"}</span>
          </label>
        </td>
        <td class="actions-cell">
          ${isDeleted
            ? `<button class="btn-undo" data-id="${cat.id}">Undo</button>`
            : `<button class="btn-edit" data-id="${cat.id}">Edit</button>
               <button class="btn-delete" data-id="${cat.id}">Delete</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".vis-toggle").forEach((toggle) => {
      toggle.addEventListener("change", (e) => {
        const id      = e.target.dataset.id;
        const visible = e.target.checked;
        const original = allCategories.find((c) => c.id === id);
        const tr       = e.target.closest("tr");
        e.target.nextElementSibling.textContent = visible ? "Yes" : "No";

        if (visible === original.visible) {
          // Reverted to original — remove field from pending
          if (pending.categories[id]) {
            delete pending.categories[id].visible;
            if (Object.keys(pending.categories[id]).length === 0) {
              delete pending.categories[id];
            }
          }
          tr.classList.remove("row--pending");
          updateSaveBar();
        } else {
          tr.classList.remove("row--deleted");
          tr.classList.add("row--pending");
          trackChange("categories", id, { visible });
        }
      });
    });

    tbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = allCategories.find((c) => c.id === btn.dataset.id);
        openCatModal(cat);
      });
    });

    tbody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        pending.deletes.categories.add(btn.dataset.id);
        updateSaveBar();
        renderCategoriesTable(allCategories);
      });
    });

    tbody.querySelectorAll(".btn-undo").forEach((btn) => {
      btn.addEventListener("click", () => {
        pending.deletes.categories.delete(btn.dataset.id);
        updateSaveBar();
        renderCategoriesTable(allCategories);
      });
    });
  }

  document.getElementById("add-cat-btn").addEventListener("click", () => openCatModal(null));
  document.getElementById("cat-cancel-btn").addEventListener("click", closeCatModal);
  document.getElementById("cat-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("cat-modal")) closeCatModal();
  });

  function openCatModal(cat) {
    // Merge DB values with any pending edits so form shows latest state
    const merged = cat ? { ...cat, ...(pending.categories[cat.id] || {}) } : null;
    document.getElementById("cat-form-error").hidden = true;
    document.getElementById("cat-id").value       = merged?.id ?? "";
    document.getElementById("cat-name").value     = merged?.name ?? "";
    document.getElementById("cat-order").value    = merged?.display_order ?? "";
    document.getElementById("cat-visible").checked = merged?.visible ?? true;
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
    const saveBtn   = document.getElementById("cat-save-btn");
    formError.hidden = true;

    const name  = document.getElementById("cat-name").value.trim();
    const order = document.getElementById("cat-order").value;

    if (!name)                        return showFormError(formError, "Please enter a category name.", "cat-name");
    if (!order || isNaN(parseInt(order, 10)))
                                      return showFormError(formError, "Please enter a valid display order.", "cat-order");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const id = document.getElementById("cat-id").value;
    const payload = {
      name,
      display_order: parseInt(order, 10),
      visible:       document.getElementById("cat-visible").checked,
    };

    if (id) {
      // Existing category — track as pending
      trackChange("categories", id, payload);
      closeCatModal();
      renderCategoriesTable(allCategories);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Category";
    } else {
      // New category — save immediately
      const { error } = await db.from("categories").insert(payload);
      if (error) {
        showFormError(formError, error.code === "23505"
          ? "A category with this name already exists."
          : "Something went wrong. Please try again.");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Category";
      } else {
        closeCatModal();
        loadCategories();
      }
    }
  });

  // ── Menu Items ────────────────────────────────────────────────────────────

  let allItems = [];

  async function loadItems() {
    const loadingMsg = document.getElementById("items-loading-msg");
    const table      = document.getElementById("items-table");
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

    renderItemsTable(getFilteredItems());
    table.hidden = false;
  }

  function renderItemsTable(items) {
    const tbody = document.getElementById("items-tbody");
    tbody.innerHTML = "";

    items.forEach((item) => {
      const isDeleted = pending.deletes.menu_items.has(item.id);
      const isNew     = item.id.startsWith("temp_");
      const isPending = !isDeleted && !isNew && item.id in pending.menu_items;
      const display   = { ...item, ...(pending.menu_items[item.id] || {}) };

      const tr = document.createElement("tr");
      if (isDeleted)      tr.classList.add("row--deleted");
      else if (isNew)     tr.classList.add("row--new");
      else if (isPending) tr.classList.add("row--pending");

      tr.innerHTML = `
        <td>${escHtml(display.name)}</td>
        <td>${escHtml(display.category)}</td>
        <td>$${Number(display.price).toFixed(2)}</td>
        <td>${display.item_order}</td>
        <td>
          <label class="toggle-label">
            <input type="checkbox" class="avail-toggle" data-id="${item.id}"
              ${display.available ? "checked" : ""} ${isDeleted ? "disabled" : ""}>
            <span class="toggle-text">${display.available ? "Yes" : "No"}</span>
          </label>
        </td>
        <td class="actions-cell">
          ${isDeleted
            ? `<button class="btn-undo" data-id="${item.id}">Undo</button>`
            : `<button class="btn-edit" data-id="${item.id}">Edit</button>
               <button class="btn-delete" data-id="${item.id}">Delete</button>`}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".avail-toggle").forEach((toggle) => {
      toggle.addEventListener("change", (e) => {
        const id        = e.target.dataset.id;
        const available = e.target.checked;
        const original  = allItems.find((i) => i.id === id);
        const tr        = e.target.closest("tr");
        e.target.nextElementSibling.textContent = available ? "Yes" : "No";

        if (available === original.available) {
          // Reverted to original — remove field from pending
          if (pending.menu_items[id]) {
            delete pending.menu_items[id].available;
            if (Object.keys(pending.menu_items[id]).length === 0) {
              delete pending.menu_items[id];
            }
          }
          tr.classList.remove("row--pending");
          updateSaveBar();
        } else {
          tr.classList.remove("row--deleted");
          tr.classList.add("row--pending");
          trackChange("menu_items", id, { available });
        }
      });
    });

    tbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = allItems.find((i) => i.id === btn.dataset.id);
        openItemModal(item);
      });
    });

    tbody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.id.startsWith("temp_")) {
          // Never saved — remove from allItems and pending entirely
          allItems = allItems.filter((i) => i.id !== btn.dataset.id);
          delete pending.menu_items[btn.dataset.id];
          updateSaveBar();
        } else {
          pending.deletes.menu_items.add(btn.dataset.id);
          updateSaveBar();
        }
        renderItemsTable(getFilteredItems());
      });
    });

    tbody.querySelectorAll(".btn-undo").forEach((btn) => {
      btn.addEventListener("click", () => {
        pending.deletes.menu_items.delete(btn.dataset.id);
        updateSaveBar();
        renderItemsTable(getFilteredItems());
      });
    });
  }

  document.getElementById("items-category-filter").addEventListener("change", () => {
    renderItemsTable(getFilteredItems());
  });

  document.getElementById("add-item-btn").addEventListener("click", () => {
    const activeFilter = document.getElementById("items-category-filter").value;
    openItemModal(null, activeFilter);
  });
  document.getElementById("item-cancel-btn").addEventListener("click", closeItemModal);
  document.getElementById("item-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("item-modal")) closeItemModal();
  });

  function openItemModal(item, prefillCategory = "") {
    // Merge DB values with any pending edits so form shows latest state
    const merged = item ? { ...item, ...(pending.menu_items[item.id] || {}) } : null;
    document.getElementById("item-form-error").hidden = true;
    document.getElementById("item-id").value          = merged?.id ?? "";
    document.getElementById("item-name").value        = merged?.name ?? "";
    document.getElementById("item-category").value    = merged?.category ?? prefillCategory;
    document.getElementById("item-price").value       = merged?.price ?? "";
    document.getElementById("item-order").value       = merged?.item_order ?? 999;
    document.getElementById("item-available").checked = merged?.available ?? true;
    document.getElementById("item-description").value = merged?.description ?? "";
    document.getElementById("modal-title").textContent = item ? "Edit Item" : "Add Item";
    document.getElementById("item-save-btn").textContent = item ? "Save Edit" : "Add";
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
    const saveBtn   = document.getElementById("item-save-btn");
    formError.hidden = true;

    const name     = document.getElementById("item-name").value.trim();
    const category = document.getElementById("item-category").value;
    const price    = document.getElementById("item-price").value;

    if (!name)            return showFormError(formError, "Please enter a name.", "item-name");
    if (!category)        return showFormError(formError, "Please select a category.", "item-category");
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0)
                          return showFormError(formError, "Please enter a valid price.", "item-price");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const id = document.getElementById("item-id").value;
    const payload = {
      name,
      category,
      price:       parseFloat(price),
      item_order:  parseInt(document.getElementById("item-order").value, 10) || 999,
      available:   document.getElementById("item-available").checked,
      description: document.getElementById("item-description").value.trim(),
    };

    if (id) {
      // Existing item — track as pending edit
      trackChange("menu_items", id, payload);
    } else {
      // New item — add to allItems with a temp ID, track as pending insert
      const tempId = `temp_${Date.now()}`;
      allItems.push({ ...payload, id: tempId });
      trackChange("menu_items", tempId, { ...payload, id: tempId });
    }

    closeItemModal();
    renderItemsTable(getFilteredItems());
    saveBtn.disabled = false;
    saveBtn.textContent = id ? "Save Edit" : "Add";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeItemModal();
      closeCatModal();
      document.getElementById("confirm-delete-modal").hidden = true;
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getFilteredItems() {
    const category = document.getElementById("items-category-filter").value;
    if (!category) return allItems;
    return allItems.filter((i) => {
      const effective = pending.menu_items[i.id]?.category ?? i.category;
      return effective === category;
    });
  }

  function showFormError(el, msg, focusId) {
    el.textContent = msg;
    el.hidden = false;
    if (focusId) document.getElementById(focusId).focus();
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  init();
});
