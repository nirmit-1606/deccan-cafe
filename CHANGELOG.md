## [1.4.0] - 2026-05-17

### Added
- Success toast notification after bulk save, with green checkmark, slides in from bottom-right and auto-dismisses.

### Fixed
- `loadCategories` was querying hardcoded `categories` table instead of the configured `state.tables.categories`.
- Save bar buttons renamed: "Discard" → "Discard changes", "Save Changes" → "Save".

## [1.3.0] - 2026-05-17

### Changed
- Supabase tables renamed to `deccan_cafe_menu_items` and `deccan_cafe_categories` to support a shared Supabase project across multiple restaurant sites.
- Table names are now configured per-site via `window.siteConfig.tables` in layout templates — no hardcoding in JS modules.

## [1.2.0] - 2026-05-17

### Added
- Admin panel at `/admin/` with Supabase-backed menu and category management.
- Bulk save/discard — all edits accumulate in a pending state and are committed in one batch operation.
- Pending row states: yellow (edited), blue (new), red (queued for deletion), each with per-row Undo.
- Delete confirmation modal before any destructive bulk save.
- Category filter on the menu items table, pre-filled when a filter is active on Add.
- Coloured category chips with hash-based colour assignment across 10 variants.
- Table body scrolls within the viewport; header row stays pinned.
- Mobile-responsive admin toolbar and save bar.

### Changed
- Menu data moved from build-time Notion fetch to runtime Supabase REST API — no rebuild needed for menu updates.
- `js/admin.js` split into ES modules: `state`, `utils`, `pending`, `auth`, `categories`, `items`.
- Save bar label distinguishes additions, edits, and deletions separately.
- Table CSS: row-level properties moved from `td` to `tbody tr`; removed all `!important` from row state rules.

### Fixed
- Sticky table header border now uses `box-shadow` instead of `border-bottom` to avoid the border-collapse scroll bug.
- Toggling a field back to its original value no longer keeps the row in pending state.
- Favicon links added to the admin layout.

## [1.1.0] - 2026-01-04

### Added
- Redesigned mobile menu: custom dropdown with animated chevron and keyboard accessibility.
- Sticky category control so users can switch categories while scrolling.

### Changed
- Reduced image resolutions to improve bandwidth and loading performance.
- UI and style tweaks for better mobile usability.

### Fixed
- Notion menu data pagination; new Notion items are now fetched during build.
