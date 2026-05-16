document.addEventListener("DOMContentLoaded", () => {
  const { url, anonKey } = window.siteConfig.supabase;
  const db = supabase.createClient(url, anonKey);

  const loginScreen = document.getElementById("login-screen");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const addItemBtn = document.getElementById("add-item-btn");
  const loadingMsg = document.getElementById("loading-msg");
  const itemsTable = document.getElementById("items-table");
  const itemsTbody = document.getElementById("items-tbody");
  const itemModal = document.getElementById("item-modal");
  const itemForm = document.getElementById("item-form");
  const formError = document.getElementById("form-error");
  const modalTitle = document.getElementById("modal-title");
  const cancelBtn = document.getElementById("cancel-btn");

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function init() {
    const { data: { session } } = await db.auth.getSession();
    session ? showDashboard() : showLogin();
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadItems();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
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

  logoutBtn.addEventListener("click", async () => {
    await db.auth.signOut();
    showLogin();
  });

  // ── Table ─────────────────────────────────────────────────────────────────

  let allItems = [];

  async function loadItems() {
    loadingMsg.textContent = "Loading…";
    loadingMsg.hidden = false;
    itemsTable.hidden = true;

    const { data, error } = await db
      .from("menu_items")
      .select("*")
      .order("category")
      .order("item_order");

    if (error) {
      loadingMsg.textContent = "Failed to load items.";
      return;
    }

    allItems = data;
    loadingMsg.hidden = true;
    renderTable(data);
    itemsTable.hidden = false;
  }

  function renderTable(items) {
    itemsTbody.innerHTML = "";
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
      itemsTbody.appendChild(tr);
    });

    itemsTbody.querySelectorAll(".avail-toggle").forEach((toggle) => {
      toggle.addEventListener("change", async (e) => {
        const available = e.target.checked;
        e.target.nextElementSibling.textContent = available ? "Yes" : "No";
        await db.from("menu_items").update({ available }).eq("id", e.target.dataset.id);
      });
    });

    itemsTbody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = allItems.find((i) => i.id === btn.dataset.id);
        openModal(item);
      });
    });

    itemsTbody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = allItems.find((i) => i.id === btn.dataset.id);
        if (!confirm(`Delete "${item?.name}"? This cannot be undone.`)) return;
        const { error } = await db.from("menu_items").delete().eq("id", btn.dataset.id);
        if (!error) loadItems();
      });
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  addItemBtn.addEventListener("click", () => openModal(null));
  cancelBtn.addEventListener("click", closeModal);
  itemModal.addEventListener("click", (e) => { if (e.target === itemModal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function openModal(item) {
    formError.hidden = true;
    document.getElementById("item-id").value = item?.id ?? "";
    document.getElementById("item-name").value = item?.name ?? "";
    document.getElementById("item-category").value = item?.category ?? "";
    document.getElementById("item-price").value = item?.price ?? "";
    document.getElementById("item-order").value = item?.item_order ?? 999;
    document.getElementById("item-available").checked = item?.available ?? true;
    document.getElementById("item-description").value = item?.description ?? "";
    modalTitle.textContent = item ? "Edit Item" : "Add Item";
    document.getElementById("save-btn").textContent = "Save Item";
    document.getElementById("save-btn").disabled = false;
    itemModal.hidden = false;
    document.getElementById("item-name").focus();
  }

  function closeModal() {
    itemModal.hidden = true;
    itemForm.reset();
  }

  itemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;
    const saveBtn = document.getElementById("save-btn");
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
      closeModal();
      loadItems();
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
