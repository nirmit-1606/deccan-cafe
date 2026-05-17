export const state = {
  db: null,
  tables: { menuItems: "", categories: "" },
  allItems: [],
  allCategories: [],
  pending: {
    menu_items: {},
    categories: {},
    deletes: { menu_items: new Set(), categories: new Set() },
  },
};
