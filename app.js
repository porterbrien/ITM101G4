/* ─── Movie Cloud — app.js (home.html / home page) ──────────────────── */

let movies = [];
let filteredMovies = null;
let currentUser = null;

/* ─── Auth: this page requires a signed-in user ──────────────────────── */
async function requireAuthOrRedirect() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();

    if (!data.user) {
      window.location.href = 'signin.html';
      return false;
    }

    currentUser = data.user;
    renderAuthUI();
    return true;
  } catch (err) {
    window.location.href = 'signin.html';
    return false;
  }
}

function renderAuthUI() {
  const authWrap = document.getElementById('auth-wrap');
  authWrap.innerHTML = `
    <span class="auth-user">${escHtml(currentUser.email)}</span>
    <button class="auth-btn" onclick="handleLogout()">Sign Out</button>
  `;
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch (err) {
    // proceed to redirect regardless
  }
  window.location.href = 'signin.html';
}

/* ─── Load library from the server ───────────────────────────────────── */
async function loadMovies() {
  try {
    const res = await fetch('/api/movies', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'signin.html';
      return;
    }
    const data = await res.json();
    movies = data.movies || [];
    filteredMovies = null;
    displayMovies();
  } catch (err) {
    console.error('Failed to load movies:', err);
  }
}

/* ─── Upload Movie ────────────────────────────────────────────────────── */
let dodgeCount = 0;
const MAX_DODGES = 2;

function dodgeButton() {
  if (dodgeCount >= MAX_DODGES) return; // let them finally click it

  const btn = document.getElementById('paywall-close-btn');
  const zone = btn.parentElement;
  const zoneRect = zone.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();

  const maxLeft = zoneRect.width - btnRect.width;
  const maxTop = zoneRect.height - btnRect.height;

  const newLeft = Math.random() * maxLeft;
  const newTop = Math.random() * maxTop;

  btn.style.left = `${newLeft}px`;
  btn.style.top = `${newTop}px`;

  dodgeCount++;
}

function closePaywall() {
  document.getElementById('paywall-overlay').style.display = 'none';
  // reset for next time
  dodgeCount = 0;
  const btn = document.getElementById('paywall-close-btn');
  btn.style.left = '';
  btn.style.top = '';
}

async function uploadMovie() {
  if (movies.length >= 1) {
    document.getElementById('paywall-overlay').style.display = 'flex';
    return;
  }
  const title = document.getElementById('title').value.trim();
  const tag   = document.getElementById('tag').value.trim();
  const age   = document.getElementById('age').value.trim();
  const posterFile = document.getElementById('image').files[0];
  const videoFile   = document.getElementById('video').files[0];

  if (!title || !posterFile || !videoFile) {
    const btn = document.querySelector('#upload-card .btn-add');
    btn.style.transition = 'none';
    btn.style.transform = 'translateX(-6px)';
    setTimeout(() => { btn.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(() => { btn.style.transform = 'translateX(-4px)'; }, 160);
    setTimeout(() => { btn.style.transform = 'translateX(0)'; btn.style.transition = ''; }, 240);
    return;
  }

  const uploadBtn = document.getElementById('upload-btn');
  const uploadBtnLabel = document.getElementById('upload-btn-label');
  uploadBtn.disabled = true;
  uploadBtnLabel.textContent = 'Uploading…';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('tag', tag);
  formData.append('age', age);
  formData.append('poster', posterFile);
  formData.append('video', videoFile);

  try {
    const res = await fetch('/api/movies', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (res.status === 401) {
      window.location.href = 'signin.html';
      return;
    }

    const data = await res.json();

    if (!res.ok) {
      uploadBtnLabel.textContent = data.error || 'Upload failed — try again';
      setTimeout(() => { uploadBtnLabel.textContent = 'Add to Library'; }, 2500);
      return;
    }

    clearForm();
    await loadMovies();
    uploadBtnLabel.textContent = 'Add to Library';
  } catch (err) {
    uploadBtnLabel.textContent = 'Upload failed — try again';
    setTimeout(() => { uploadBtnLabel.textContent = 'Add to Library'; }, 2500);
  } finally {
    uploadBtn.disabled = false;
  }
}

/* ─── Remove Movie ───────────────────────────────────────────────────── */
async function removeMovie(id) {
  try {
    const res = await fetch(`/api/movies/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'signin.html';
      return;
    }
    if (res.ok) {
      await loadMovies();
    }
  } catch (err) {
    console.error('Failed to remove movie:', err);
  }
}

/* ─── Play a movie ───────────────────────────────────────────────────── */
function playMovie(id) {
  const movie = movies.find(m => m.id === id);
  if (!movie) return;

  const video = document.getElementById('videoPlayer');
  const empty = document.getElementById('player-empty');
  const title = document.getElementById('now-playing-title');

  video.src = movie.videoUrl;
  video.style.display = 'block';
  empty.style.display = 'none';
  title.textContent = `Now Playing — ${movie.title}`;

  document.getElementById('player').scrollIntoView({ behavior: 'smooth', block: 'start' });
  video.play().catch(() => { /* autoplay may be blocked; controls are visible */ });
}

/* ─── Filter (search) ────────────────────────────────────────────────── */
function filterMovies() {
  const query = document.getElementById('search').value.trim().toLowerCase();
  filteredMovies = query
    ? movies.filter(m =>
        m.title.toLowerCase().includes(query) ||
        m.tag.toLowerCase().includes(query) ||
        m.age.toLowerCase().includes(query)
      )
    : null;
  displayMovies();
}

/* ─── Display ────────────────────────────────────────────────────────── */
function displayMovies() {
  const grid  = document.getElementById('movieGrid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('movie-count');
  const list  = filteredMovies !== null ? filteredMovies : movies;

  count.textContent = `${movies.length} film${movies.length !== 1 ? 's' : ''}`;
  grid.innerHTML = '';

  if (list.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  list.forEach((movie, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
      <div class="card-poster">
        <img src="${movie.posterUrl}" alt="${escHtml(movie.title)}" />
        <div class="card-overlay">
          <button class="card-play" aria-label="Play ${escHtml(movie.title)}" onclick="playMovie('${movie.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21"/></svg>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${escHtml(movie.title)}</div>
        <div class="card-meta">
          ${movie.tag  ? `<span class="card-tag">${escHtml(movie.tag)}</span>`  : ''}
          ${movie.age  ? `<span class="card-age">${escHtml(movie.age)}</span>`  : ''}
        </div>
      </div>
      <div class="card-footer">
        <button class="btn-remove" onclick="removeMovie('${movie.id}')">Remove</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ─── Preview file name ──────────────────────────────────────────────── */
function previewFile(input, labelId) {
  const label = document.getElementById(labelId);
  if (input.files && input.files[0]) {
    label.textContent = input.files[0].name;
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function clearForm() {
  ['title', 'tag', 'age'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('image').value = '';
  document.getElementById('video').value = '';
  document.getElementById('file-label').textContent = 'Drop poster or click to browse';
  document.getElementById('video-label').textContent = 'Drop video or click to browse';
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupDropZone(zoneId, inputId, labelId) {
  const dropZone = document.getElementById(zoneId);
  if (!dropZone) return;

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--purple)';
    dropZone.style.background  = 'var(--purple-soft)';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
    const fileInput = document.getElementById(inputId);
    fileInput.files = e.dataTransfer.files;
    previewFile(fileInput, labelId);
  });
}

/* ─── Init ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const authed = await requireAuthOrRedirect();
  if (!authed) return;

  await loadMovies();

  document.querySelectorAll('#upload-card .field-input').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') uploadMovie(); });
  });

  setupDropZone('file-drop', 'image', 'file-label');
  setupDropZone('video-drop', 'video', 'video-label');
});