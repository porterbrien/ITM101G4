/* ─── Movie Cloud — auth.js (signin.html) ─────────────────────────────
   Handles the standalone sign-in / sign-up page. If the person is
   already signed in, bounce them straight to the home page.
------------------------------------------------------------------- */

let authMode = 'login'; // 'login' | 'signup'

async function redirectIfSignedIn() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();
    if (data.user) {
      window.location.href = 'home.html';
    }
  } catch (err) {
    // If the check fails, just let them sign in manually.
  }
}

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('auth-error').textContent = '';
  updateAuthTabUI();
}

function updateAuthTabUI() {
  document.getElementById('tab-login').classList.toggle('active', authMode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', authMode === 'signup');
  document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('auth-password').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit');

  errorEl.textContent = '';
  submitBtn.disabled = true;

  try {
    const endpoint = authMode === 'login' ? '/api/login' : '/api/signup';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Something went wrong. Please try again.';
      submitBtn.disabled = false;
      return;
    }

    window.location.href = 'home.html';
  } catch (err) {
    errorEl.textContent = 'Could not reach the server. Please try again.';
    submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  redirectIfSignedIn();
});