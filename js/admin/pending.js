import { state } from "./state.js";

let _reloadItems;
let _reloadCategories;

export function initPending(reloadItems, reloadCategories) {
  _reloadItems = reloadItems;
  _reloadCategories = reloadCategories;

  document.getElementById("save-changes-btn").addEventListener("click", () => {
    const deleteCount =
      state.pending.deletes.menu_items.size +
      state.pending.deletes.categories.size;

    if (deleteCount > 0) {
      const parts = [];
      if (state.pending.deletes.menu_items.size)
        parts.push(
          `${state.pending.deletes.menu_items.size} menu item${
            state.pending.deletes.menu_items.size !== 1 ? "s" : ""
          }`
        );
      if (state.pending.deletes.categories.size)
        parts.push(
          `${state.pending.deletes.categories.size} categor${
            state.pending.deletes.categories.size !== 1 ? "ies" : "y"
          }`
        );
      document.getElementById("confirm-delete-msg").textContent =
        `You are about to permanently delete ${parts.join(
          " and "
        )}. This cannot be undone. Any other pending edits will also be saved.`;
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
}

export function trackChange(table, id, changes) {
  state.pending[table][id] = { ...state.pending[table][id], ...changes };
  updateSaveBar();
}

export function updateSaveBar() {
  const additions = Object.keys(state.pending.menu_items).filter((id) =>
    id.startsWith("temp_")
  ).length;
  const edits =
    Object.keys(state.pending.menu_items).filter((id) => !id.startsWith("temp_")).length +
    Object.keys(state.pending.categories).length;
  const deletes =
    state.pending.deletes.menu_items.size +
    state.pending.deletes.categories.size;
  const total = additions + edits + deletes;

  document.getElementById("save-bar").hidden = total === 0;

  const parts = [];
  if (additions) parts.push(`${additions} addition${additions !== 1 ? "s" : ""}`);
  if (edits)     parts.push(`${edits} edit${edits !== 1 ? "s" : ""}`);
  if (deletes)   parts.push(`${deletes} deletion${deletes !== 1 ? "s" : ""}`);
  document.getElementById("save-bar-count").textContent =
    parts.join(", ") + " pending";
}

async function saveAllChanges() {
  const saveBtn = document.getElementById("save-changes-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const { db, allItems, allCategories, pending, tables } = state;
  const itemDeletes = [...pending.deletes.menu_items];
  const catDeletes  = [...pending.deletes.categories];

  const itemInserts = Object.entries(pending.menu_items)
    .filter(([id]) => id.startsWith("temp_"))
    .map(([, c]) => { const { id: _id, ...rest } = c; return rest; });

  const itemUpdates = Object.entries(pending.menu_items)
    .filter(([id]) => !id.startsWith("temp_") && !pending.deletes.menu_items.has(id))
    .map(([id, c]) => ({ ...allItems.find((i) => i.id === id), ...c }));

  const catUpdates = Object.entries(pending.categories)
    .filter(([id]) => !pending.deletes.categories.has(id))
    .map(([id, c]) => ({ ...allCategories.find((cat) => cat.id === id), ...c }));

  const ops = [];
  if (itemDeletes.length) ops.push(db.from(tables.menuItems).delete().in("id", itemDeletes));
  if (catDeletes.length)  ops.push(db.from(tables.categories).delete().in("id", catDeletes));
  if (itemInserts.length) ops.push(db.from(tables.menuItems).insert(itemInserts));
  if (itemUpdates.length) ops.push(db.from(tables.menuItems).upsert(itemUpdates));
  if (catUpdates.length)  ops.push(db.from(tables.categories).upsert(catUpdates));

  const results = await Promise.all(ops);
  const failed  = results.find((r) => r.error);

  if (failed) {
    alert(`Save failed: ${failed.error.message}`);
  } else {
    state.pending.menu_items = {};
    state.pending.categories = {};
    state.pending.deletes.menu_items.clear();
    state.pending.deletes.categories.clear();
    updateSaveBar();
    _reloadItems();
    _reloadCategories();
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Save Changes";
}

function discardChanges() {
  state.allItems = state.allItems.filter((i) => !i.id.startsWith("temp_"));
  state.pending.menu_items = {};
  state.pending.categories = {};
  state.pending.deletes.menu_items.clear();
  state.pending.deletes.categories.clear();
  updateSaveBar();
  _reloadItems();
  _reloadCategories();
}
