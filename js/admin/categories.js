import { state } from "./state.js";
import { escHtml, showFormError } from "./utils.js";
import { trackChange, updateSaveBar } from "./pending.js";

export async function loadCategories() {
  const loadingMsg = document.getElementById("cats-loading-msg");
  const table      = document.getElementById("cats-table");
  loadingMsg.textContent = "Loading…";
  loadingMsg.hidden = false;
  table.hidden = true;

  const { data, error } = await state.db
    .from("categories")
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

  tbody.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = state.allCategories.find((c) => c.id === btn.dataset.id);
      openCatModal(cat);
    });
  });

  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pending.deletes.categories.add(btn.dataset.id);
      updateSaveBar();
      renderCategoriesTable(state.allCategories);
    });
  });

  tbody.querySelectorAll(".btn-undo").forEach((btn) => {
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
