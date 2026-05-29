import { state } from "./state.js";
import { escHtml, showFormError, ICON_EDIT, ICON_DELETE, ICON_UNDO } from "./utils.js";
import { trackChange, updateSaveBar } from "./pending.js";
import { renderItemsTable, getFilteredItems } from "./items.js";

let _pendingDeleteCatId = null;

export async function loadCategories() {
  const loadingMsg = document.getElementById("cats-loading-msg");
  const table      = document.getElementById("cats-table");
  loadingMsg.textContent = "Loading…";
  loadingMsg.hidden = false;
  table.hidden = true;

  const { data, error } = await state.db
    .from(state.tables.categories)
    .select("*")
    .order("display_order");

  if (error) { loadingMsg.textContent = "Failed to load categories."; return; }

  state.allCategories = data;
  loadingMsg.hidden = true;
  renderCategoriesTable(data);
  table.hidden = false;
  populateCategoryDropdown(data);
}

export function populateCategoryDropdown(categories) {
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

export function renderCategoriesTable(categories) {
  const tbody = document.getElementById("cats-tbody");
  tbody.innerHTML = "";

  categories.forEach((cat) => {
    const isDeleted = state.pending.deletes.categories.has(cat.id);
    const isPending = !isDeleted && cat.id in state.pending.categories;
    const display   = { ...cat, ...(state.pending.categories[cat.id] || {}) };

    const tr = document.createElement("tr");
    if (isDeleted)      tr.classList.add("row--deleted");
    else if (isPending) tr.classList.add("row--pending");

    tr.innerHTML = `
      <td class="col-cat-name">${escHtml(display.name)}</td>
      <td class="col-cat-order">${display.display_order}</td>
      <td class="col-cat-visible">
        <label class="toggle-label">
          <input type="checkbox" class="vis-toggle" data-id="${cat.id}"
            ${display.visible ? "checked" : ""} ${isDeleted ? "disabled" : ""}>
          <span class="toggle-text">${display.visible ? "Yes" : "No"}</span>
        </label>
      </td>
      <td class="col-cat-actions actions-cell">
        ${isDeleted
          ? `<button class="btn-icon btn-icon--undo" data-id="${cat.id}" title="Undo" aria-label="Undo delete">${ICON_UNDO}</button>`
          : `<button class="btn-icon btn-icon--edit" data-id="${cat.id}" title="Edit" aria-label="Edit">${ICON_EDIT}</button>
             <button class="btn-icon btn-icon--delete" data-id="${cat.id}" title="Delete" aria-label="Delete">${ICON_DELETE}</button>`}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".vis-toggle").forEach((toggle) => {
    toggle.addEventListener("change", (e) => {
      const id       = e.target.dataset.id;
      const visible  = e.target.checked;
      const original = state.allCategories.find((c) => c.id === id);
      const tr       = e.target.closest("tr");
      e.target.nextElementSibling.textContent = visible ? "Yes" : "No";

      if (visible === original.visible) {
        if (state.pending.categories[id]) {
          delete state.pending.categories[id].visible;
          if (Object.keys(state.pending.categories[id]).length === 0)
            delete state.pending.categories[id];
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

  tbody.querySelectorAll(".btn-icon--edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = state.allCategories.find((c) => c.id === btn.dataset.id);
      openCatModal(cat);
    });
  });

  tbody.querySelectorAll(".btn-icon--delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const catId   = btn.dataset.id;
      const catName = (state.allCategories.find((c) => c.id === catId) || {}).name;
      const linked  = state.allItems.filter((item) => {
        if (state.pending.deletes.menu_items.has(item.id)) return false;
        const effectiveCat = state.pending.menu_items[item.id]?.category ?? item.category;
        return effectiveCat === catName;
      });

      if (linked.length === 0) {
        state.pending.deletes.categories.add(catId);
        updateSaveBar();
        renderCategoriesTable(state.allCategories);
      } else {
        openCatDeleteModal(catId, catName, linked);
      }
    });
  });

  tbody.querySelectorAll(".btn-icon--undo").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pending.deletes.categories.delete(btn.dataset.id);
      updateSaveBar();
      renderCategoriesTable(state.allCategories);
    });
  });
}

export function initCategories() {
  document.getElementById("add-cat-btn").addEventListener("click", () => openCatModal(null));
  document.getElementById("cat-cancel-btn").addEventListener("click", closeCatModal);
  document.getElementById("cat-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("cat-modal")) closeCatModal();
  });
  initCatDeleteModal();

  document.getElementById("cat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formError = document.getElementById("cat-form-error");
    const saveBtn   = document.getElementById("cat-save-btn");
    formError.hidden = true;

    const name  = document.getElementById("cat-name").value.trim();
    const order = document.getElementById("cat-order").value;

    if (!name)
      return showFormError(formError, "Please enter a category name.", "cat-name");
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
      trackChange("categories", id, payload);
      closeCatModal();
      renderCategoriesTable(state.allCategories);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Category";
    } else {
      const { error } = await state.db.from(state.tables.categories).insert(payload);
      if (error) {
        showFormError(
          formError,
          error.code === "23505"
            ? "A category with this name already exists."
            : "Something went wrong. Please try again."
        );
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Category";
      } else {
        closeCatModal();
        loadCategories();
      }
    }
  });
}

export function closeCatModal() {
  document.getElementById("cat-modal").hidden = true;
  document.getElementById("cat-form").reset();
}

function openCatDeleteModal(catId, catName, linkedItems) {
  _pendingDeleteCatId = catId;

  const count = linkedItems.length;
  document.getElementById("cat-delete-msg").textContent =
    `"${catName}" has ${count} linked item${count !== 1 ? "s" : ""}. What would you like to do?`;

  const select = document.getElementById("cat-delete-reassign-select");
  select.innerHTML = "";
  state.allCategories
    .filter((c) => c.id !== catId && !state.pending.deletes.categories.has(c.id))
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });

  // Hide reassign group if no other categories exist
  document.getElementById("cat-delete-reassign-group").hidden = select.options.length === 0;
  document.getElementById("cat-delete-reassign-btn").disabled = select.options.length === 0;

  document.getElementById("cat-delete-modal").hidden = false;
}

function closeCatDeleteModal() {
  _pendingDeleteCatId = null;
  document.getElementById("cat-delete-modal").hidden = true;
}

function initCatDeleteModal() {
  document.getElementById("cat-delete-cancel-btn").addEventListener("click", closeCatDeleteModal);
  document.getElementById("cat-delete-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("cat-delete-modal")) closeCatDeleteModal();
  });

  document.getElementById("cat-delete-reassign-btn").addEventListener("click", () => {
    const catId      = _pendingDeleteCatId;
    const catName    = (state.allCategories.find((c) => c.id === catId) || {}).name;
    const targetCat  = document.getElementById("cat-delete-reassign-select").value;
    if (!targetCat) return;

    // Reassign all linked items to the target category
    state.allItems.forEach((item) => {
      if (state.pending.deletes.menu_items.has(item.id)) return;
      const effectiveCat = state.pending.menu_items[item.id]?.category ?? item.category;
      if (effectiveCat === catName) {
        trackChange("menu_items", item.id, { category: targetCat });
      }
    });

    state.pending.deletes.categories.add(catId);
    closeCatDeleteModal();
    updateSaveBar();
    renderCategoriesTable(state.allCategories);
    renderItemsTable(getFilteredItems());
  });

  document.getElementById("cat-delete-cascade-btn").addEventListener("click", () => {
    const catId   = _pendingDeleteCatId;
    const catName = (state.allCategories.find((c) => c.id === catId) || {}).name;

    // Queue all linked items for deletion
    state.allItems.forEach((item) => {
      if (state.pending.deletes.menu_items.has(item.id)) return;
      const effectiveCat = state.pending.menu_items[item.id]?.category ?? item.category;
      if (effectiveCat === catName) {
        if (item.id.startsWith("temp_")) {
          // Unsaved items: remove from local state entirely
          state.allItems = state.allItems.filter((i) => i.id !== item.id);
          delete state.pending.menu_items[item.id];
        } else {
          state.pending.deletes.menu_items.add(item.id);
        }
      }
    });

    state.pending.deletes.categories.add(catId);
    closeCatDeleteModal();
    updateSaveBar();
    renderCategoriesTable(state.allCategories);
    renderItemsTable(getFilteredItems());
  });
}

function openCatModal(cat) {
  const merged = cat ? { ...cat, ...(state.pending.categories[cat.id] || {}) } : null;
  document.getElementById("cat-form-error").hidden = true;
  document.getElementById("cat-id").value        = merged?.id ?? "";
  document.getElementById("cat-name").value      = merged?.name ?? "";
  document.getElementById("cat-order").value     = merged?.display_order ?? "";
  document.getElementById("cat-visible").checked = merged?.visible ?? true;
  document.getElementById("cat-modal-title").textContent = cat ? "Edit Category" : "Add Category";
  document.getElementById("cat-save-btn").textContent = "Save Category";
  document.getElementById("cat-save-btn").disabled = false;
  document.getElementById("cat-modal").hidden = false;
  document.getElementById("cat-name").focus();
}
