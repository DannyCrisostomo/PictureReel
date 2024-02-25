// Clave de API para acceder a la API de The Movie Database (TMDb)
const apiKey = '011e76f650e4be279c8687bb0ad90c27';

// Número de la página inicial
let currentPage = 1;

function fetchMovies(page, searchTerm = '') {
    // Construir la URL de la API según la página y el término de búsqueda
    let apiURL = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&page=${page}`;

    // Agregar el término de búsqueda si se proporciona
    if (searchTerm) {
        apiURL = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&page=${page}&query=${searchTerm}`;
    }

    // Realizar la solicitud a la API
    fetch(apiURL)
        .then(response => response.json())
        .then(data => {
            // Obtener la lista de películas desde la respuesta de la API
            const movies = data.results.slice(0, 1); //cantidad de datos que se va recuperar

            // Crear una variable para almacenar todo el contenido
            let content = '';

            // Iterar sobre cada película y construir el contenido
            movies.forEach(movie => {
                // Obtener el video de la película
                fetch(`https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${apiKey}`)
                    .then(response => response.json())
                    .then(videoData => {
                        // Tomar el primer video (puedes ajustar según tus necesidades)
                        const videoKey = videoData.results[0].key;

                        // Construir el contenido del div con la información de la película y el video
                        content += `
<div class="background">
    <div class="background-fondo" style="background-image: linear-gradient(180deg, rgba(8, 15, 40, 0) 0, #080f28), linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)),url('https://image.tmdb.org/t/p/w500${movie.backdrop_path}');">
        <div class="movie">
            <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="Descripción de la imagen">
            <div class="datos-peliculas">
                <h1>${movie.original_title}</h1>
                <p>Puntuación: ${movie.vote_average}</p>
                <p>Popularidad: ${movie.popularity}</p>
                <p>Fecha de lanzamiento: ${movie.release_date}</p>
                <a class="btn" href="https://image.tmdb.org/t/p/w500${movie.poster_path}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" class="icon icon-play">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>
                    </svg>Ver ahora
                </a>
                <h3>'${movie.original_title}' Online en Picture<span>Reel</span></h3>
                <p>${movie.overview}</p>
            </div>
        </div>
        <div class="youtube">
            <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoKey}" frameborder="0" allowfullscreen></iframe>
        </div>
    </div>
</div>

                        `;

                        // Asignar el contenido al contenedor HTML
                        document.getElementById('movie-info').innerHTML = content;
                    })
                    .catch(error => {
                        // Manejar errores al obtener videos desde la API
                        console.error('Error al obtener videos:', error);
                    });
            });

            // Mostrar la información completa de la respuesta de la API en la consola
            console.log(data);
        })
        .catch(error => {
            // Manejar errores de la solicitud a la API
            console.error('Ocurrió un error:', error);
        });
}


// Llamada inicial para cargar la primera página de películas
fetchMovies(currentPage);

// Eventos de paginación y búsqueda

// Evento para el botón "Página anterior"
document.getElementById('previous-page').addEventListener('click', () => {
    if (currentPage > 1) {
        // Decrementar el número de página y cargar las películas de la nueva página
        currentPage--;
        fetchMovies(currentPage);
    }
});

// Evento para el botón "Página siguiente"
document.getElementById('next-page').addEventListener('click', () => {
    // Incrementar el número de página y cargar las películas de la nueva página
    currentPage++;
    fetchMovies(currentPage);
});

// Evento para el botón de búsqueda
document.getElementById('search-button').addEventListener('click', () => {
    // Obtener el término de búsqueda del campo de entrada
    const searchTerm = document.getElementById('search-input').value;

    // Restablecer a la primera página al realizar una nueva búsqueda
    currentPage = 1;

    // Realizar la búsqueda de películas con el término proporcionado
    fetchMovies(currentPage, searchTerm);
});
