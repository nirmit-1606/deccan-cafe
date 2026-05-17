export function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function showFormError(el, msg, focusId) {
  el.textContent = msg;
  el.hidden = false;
  if (focusId) document.getElementById(focusId).focus();
}

export function categoryChip(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return `<span class="cat-chip cat-chip--${hash % 10}">${escHtml(name)}</span>`;
}
