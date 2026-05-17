import { state } from "./state.js";

let _loadCategories;
let _loadItems;

export function initAuth(loadCategories, loadItems) {
  _loadCategories = loadCategories;
  _loadItems = loadItems;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const loginError = document.getElementById("login-error");
    const loginBtn   = document.getElementById("login-btn");
    loginError.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";

    const { error } = await state.db.auth.signInWithPassword({
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
    await state.db.auth.signOut();
    showLogin();
  });
}

export async function checkSession() {
  const { data: { session } } = await state.db.auth.getSession();
  session ? showDashboard() : showLogin();
}

function showLogin() {
  document.getElementById("login-screen").hidden = false;
  document.getElementById("dashboard").hidden = true;
}

async function showDashboard() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("dashboard").hidden = false;
  await _loadCategories();
  _loadItems();
}
