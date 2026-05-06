let movies = [];

function addMovie() {
  const title = document.getElementById("title").value;
  const tag = document.getElementById("tag").value;
  const age = document.getElementById("age").value;
  const imageInput = document.getElementById("image");
  const file = imageInput.files[0];

  if (!title || !file) {
    alert("Please add a title and image.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    movies.push({
      title,
      tag,
      age,
      image: reader.result
    });

    displayMovies();
  };

  reader.readAsDataURL(file);
}

function displayMovies() {
  const grid = document.getElementById("movieGrid");
  grid.innerHTML = "";

  movies.forEach((movie, index) => {
    grid.innerHTML += `
      <div class="card">
        <img src="${movie.image}">
        <div class="card-content">
          <h3>${movie.title}</h3>
          <p>Tag: ${movie.tag}</p>
          <p>Age Rating: ${movie.age}</p>
          <button onclick="removeMovie(${index})">Remove</button>
        </div>
      </div>
    `;
  });
}

function removeMovie(index) {
  movies.splice(index, 1);
  displayMovies();
}