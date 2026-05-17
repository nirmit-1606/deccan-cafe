import { state } from "./state.js";
import { escHtml, categoryChip, showFormError } from "./utils.js";
import { trackChange, updateSaveBar } from "./pending.js";

export async function loadItems() {
  const loadingMsg = document.getElementById("items-loading-msg");
  const table      = document.getElementById("items-table");
  loadingMsg.textContent = "Loading…";
  loadingMsg.hidden = false;
  table.hidden = true;

  const { data, error } = await state.db.from(state.tables.menuItems).select("*");
  if (error) { loadingMsg.textContent = "Failed to load items."; return; }

  state.allItems = data;
  sortAllItems();
  loadingMsg.hidden = true;
  renderItemsTable(getFilteredItems());
  table.hidden = false;
}

export function sortAllItems() {
  const catRank = Object.fromEntries(state.allCategories.map((c, i) => [c.name, i]));
  state.allItems.sort((a, b) => {
    const effectiveCat = (id) =>
      state.pending.menu_items[id]?.category ??
      state.allItems.find((i) => i.id === id)?.category;
    const rankA  = catRank[effectiveCat(a.id)] ?? 9999;
    const rankB  = catRank[effectiveCat(b.id)] ?? 9999;
    const orderA = state.pending.menu_items[a.id]?.item_order ?? a.item_order;
    const orderB = state.pending.menu_items[b.id]?.item_order ?? b.item_order;
    return rankA !== rankB ? rankA - rankB : orderA - orderB;
  });
}

export function getFilteredItems() {
  const category = document.getElementById("items-category-filter").value;
  if (!category) return state.allItems;
  return state.allItems.filter((i) => {
    const effective = state.pending.menu_items[i.id]?.category ?? i.category;
    return effective === category;
  });
}

export function renderItemsTable(items) {
  const tbody = document.getElementById("items-tbody");
  tbody.innerHTML = "";

  items.forEach((item) => {
    const isDeleted = state.pending.deletes.menu_items.has(item.id);
    const isNew     = item.id.startsWith("temp_");
    const isPending = !isDeleted && !isNew && item.id in state.pending.menu_items;
    const display   = { ...item, ...(state.pending.menu_items[item.id] || {}) };

    const tr = document.createElement("tr");
    if (isDeleted)      tr.classList.add("row--deleted");
    else if (isNew)     tr.classList.add("row--new");
    else if (isPending) tr.classList.add("row--pending");

    tr.innerHTML = `
      <td>${escHtml(display.name)}</td>
      <td>${categoryChip(display.category)}</td>
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
      const original  = state.allItems.find((i) => i.id === id);
      const tr        = e.target.closest("tr");
      e.target.nextElementSibling.textContent = available ? "Yes" : "No";

      if (available === original.available) {
        if (state.pending.menu_items[id]) {
          delete state.pending.menu_items[id].available;
          if (Object.keys(state.pending.menu_items[id]).length === 0)
            delete state.pending.menu_items[id];
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
      const item = state.allItems.find((i) => i.id === btn.dataset.id);
      openItemModal(item);
    });
  });

  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.id.startsWith("temp_")) {
        state.allItems = state.allItems.filter((i) => i.id !== btn.dataset.id);
        delete state.pending.menu_items[btn.dataset.id];
        updateSaveBar();
      } else {
        state.pending.deletes.menu_items.add(btn.dataset.id);
        updateSaveBar();
      }
      renderItemsTable(getFilteredItems());
    });
  });

  tbody.querySelectorAll(".btn-undo").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pending.deletes.menu_items.delete(btn.dataset.id);
      updateSaveBar();
      renderItemsTable(getFilteredItems());
    });
  });
}

export function initItems() {
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

  document.getElementById("item-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formError = document.getElementById("item-form-error");
    const saveBtn   = document.getElementById("item-save-btn");
    formError.hidden = true;

    const name     = document.getElementById("item-name").value.trim();
    const category = document.getElementById("item-category").value;
    const price    = document.getElementById("item-price").value;

    if (!name)
      return showFormError(formError, "Please enter a name.", "item-name");
    if (!category)
      return showFormError(formError, "Please select a category.", "item-category");
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
      trackChange("menu_items", id, payload);
      sortAllItems();
    } else {
      const tempId = `temp_${Date.now()}`;
      state.allItems.push({ ...payload, id: tempId });
      trackChange("menu_items", tempId, { ...payload, id: tempId });
      sortAllItems();
    }

    closeItemModal();
    renderItemsTable(getFilteredItems());
    saveBtn.disabled = false;
    saveBtn.textContent = id ? "Save Edit" : "Add";
  });
}

export function closeItemModal() {
  document.getElementById("item-modal").hidden = true;
  document.getElementById("item-form").reset();
}

function openItemModal(item, prefillCategory = "") {
  const merged = item ? { ...item, ...(state.pending.menu_items[item.id] || {}) } : null;
  document.getElementById("item-form-error").hidden = true;
  document.getElementById("item-id").value          = merged?.id ?? "";
  document.getElementById("item-name").value        = merged?.name ?? "";
  document.getElementById("item-category").value    = merged?.category ?? prefillCategory;
  document.getElementById("item-price").value       = merged?.price ?? "";
  document.getElementById("item-order").value       = merged?.item_order ?? 999;
  document.getElementById("item-available").checked = merged?.available ?? true;
  document.getElementById("item-description").value = merged?.description ?? "";
  document.getElementById("modal-title").textContent    = item ? "Edit Item" : "Add Item";
  document.getElementById("item-save-btn").textContent  = item ? "Save Edit" : "Add";
  document.getElementById("item-save-btn").disabled     = false;
  document.getElementById("item-modal").hidden = false;
  document.getElementById("item-name").focus();
}
