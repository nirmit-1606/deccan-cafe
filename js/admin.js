import { state } from "./admin/state.js";
import { initPending } from "./admin/pending.js";
import { initAuth, checkSession } from "./admin/auth.js";
import { initCategories, closeCatModal, loadCategories } from "./admin/categories.js";
import { initItems, closeItemModal, loadItems } from "./admin/items.js";

const { url, anonKey } = window.siteConfig.supabase;
state.db = supabase.createClient(url, anonKey);
state.tables.menuItems  = window.siteConfig.tables.menuItems;
state.tables.categories = window.siteConfig.tables.categories;

initPending(loadItems, loadCategories);
initAuth(loadCategories, loadItems);
initCategories();
initItems();

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = true; });
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).hidden = false;
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeItemModal();
    closeCatModal();
    document.getElementById("confirm-delete-modal").hidden = true;
  }
});

checkSession();
