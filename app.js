/* ─── Movie Cloud — app.js ─────────────────────────────────────────── */

let movies = [];
let filteredMovies = null;

/* ─── Add Movie ──────────────────────────────────────────────────────── */
function addMovie() {
  const title = document.getElementById('title').value.trim();
  const tag   = document.getElementById('tag').value.trim();
  const age   = document.getElementById('age').value.trim();
  const imageInput = document.getElementById('image');
  const file  = imageInput.files[0];

  if (!title || !file) {
    // Shake the add button instead of alert
    const btn = document.querySelector('.btn-add');
    btn.style.transition = 'none';
    btn.style.transform = 'translateX(-6px)';
    setTimeout(() => { btn.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(() => { btn.style.transform = 'translateX(-4px)'; }, 160);
    setTimeout(() => { btn.style.transform = 'translateX(0)'; btn.style.transition = ''; }, 240);
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    movies.push({ title, tag, age, image: reader.result });
    clearForm();
    displayMovies();
  };

  reader.readAsDataURL(file);
}

/* ─── Remove Movie ───────────────────────────────────────────────────── */
function removeMovie(index) {
  movies.splice(index, 1);
  filteredMovies = null;
  displayMovies();
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
    // Map back to original index for removal
    const originalIndex = movies.indexOf(movie);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
      <div class="card-poster">
        <img src="${movie.image}" alt="${escHtml(movie.title)}" />
        <div class="card-overlay">
          <button class="card-play" aria-label="Play ${escHtml(movie.title)}">
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
        <button class="btn-remove" onclick="removeMovie(${originalIndex})">Remove</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ─── Preview file name ──────────────────────────────────────────────── */
function previewFile(input) {
  const label = document.getElementById('file-label');
  if (input.files && input.files[0]) {
    label.textContent = input.files[0].name;
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function clearForm() {
  ['title', 'tag', 'age'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('image').value = '';
  document.getElementById('file-label').textContent = 'Drop poster or click to browse';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Init ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  displayMovies();

  // Keyboard shortcut: Enter in any input field triggers addMovie
  document.querySelectorAll('.field-input').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addMovie(); });
  });

  // File drop zone drag-over style
  const dropZone = document.getElementById('file-drop');
  if (dropZone) {
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
      const fileInput = document.getElementById('image');
      fileInput.files = e.dataTransfer.files;
      previewFile(fileInput);
    });
  }
});