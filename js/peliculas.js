
// ========================================
// CONFIGURACIÓN TMDB
// ========================================

const apiKey = '011e76f650e4be279c8687bb0ad90c27';

const API_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/';

let currentPage = 1;
let currentSearch = '';
let isLoading = false;
let requestController = null;

const movieInfo = document.getElementById('movie-info');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const previousButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');
const spinner = document.getElementById('spinner');

// ========================================
// UTILIDADES
// ========================================

function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function showSpinner() {
    if (spinner) spinner.style.display = 'block';
}

function hideSpinner() {
    if (spinner) spinner.style.display = 'none';
}

function updatePagination(totalPages) {
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
}

function showMessage(message) {
    movieInfo.innerHTML = `
        <div class="message">
            ${escapeHTML(message)}
        </div>
    `;
}

// ========================================
// OBTENER PELÍCULAS
// ========================================

async function fetchMovies(page, searchTerm = '') {

    if (!navigator.onLine) {
        showMessage('No tienes conexión a Internet.');
        return;
    }

    if (isLoading) {
        requestController?.abort();
    }

    requestController = new AbortController();
    const signal = requestController.signal;

    isLoading = true;
    showSpinner();

    movieInfo.innerHTML = '';

    try {

        const endpoint = searchTerm
            ? `${API_URL}/search/movie`
            : `${API_URL}/discover/movie`;

        const params = new URLSearchParams({
            api_key: apiKey,
            language: 'es-ES',
            page: page.toString(),
            include_adult: 'false'
        });

        if (searchTerm) {
            params.set('query', searchTerm);
        } else {
            params.set('sort_by', 'popularity.desc');
        }

        const response = await fetch(
            `${endpoint}?${params.toString()}`,
            { signal }
        );

        if (!response.ok) {
            throw new Error('No se pudieron obtener las películas.');
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            showMessage('No se encontraron películas.');
            updatePagination(data.total_pages || 1);
            return;
        }

        currentPage = page;
        updatePagination(Math.min(data.total_pages || 1, 500));

        // Seleccionar la película principal
        const movie = data.results[0];

        // Obtener el tráiler
        const videoResponse = await fetch(
            `${API_URL}/movie/${movie.id}/videos?${new URLSearchParams({
                api_key: apiKey,
                language: 'es-ES'
            })}`,
            { signal }
        );

        if (!videoResponse.ok) {
            throw new Error('No se pudo cargar el tráiler.');
        }

        const videoData = await videoResponse.json();

        // Priorizar tráiler oficial de YouTube
        const trailer =
            videoData.results.find(video =>
                video.site === 'YouTube' &&
                video.type === 'Trailer' &&
                video.official
            ) ||
            videoData.results.find(video =>
                video.site === 'YouTube' &&
                video.type === 'Trailer'
            ) ||
            videoData.results.find(video =>
                video.site === 'YouTube'
            );

        renderMovie(movie, trailer);

    } catch (error) {

        if (error.name === 'AbortError') return;

        console.error('Error:', error);

        showMessage(
            'Ocurrió un error al cargar la película. Inténtalo nuevamente.'
        );

    } finally {

        isLoading = false;
        hideSpinner();
    }
}

// ========================================
// MOSTRAR PELÍCULA
// ========================================

function renderMovie(movie, trailer) {

    const title = escapeHTML(movie.title || 'Sin título');
    const overview = escapeHTML(
        movie.overview || 'No hay descripción disponible para esta película.'
    );

    const releaseDate = escapeHTML(
        movie.release_date || 'No disponible'
    );

    const rating = Number(movie.vote_average || 0).toFixed(1);

    const popularity = Math.round(movie.popularity || 0);

    const poster = movie.poster_path
        ? `${IMAGE_URL}w500${movie.poster_path}`
        : 'https://placehold.co/500x750/101a35/ffffff?text=Sin+poster';

    const backdrop = movie.backdrop_path
        ? `${IMAGE_URL}original${movie.backdrop_path}`
        : poster;

    const trailerKey = trailer?.key || '';

    const trailerHTML = trailerKey
        ? `
            <div class="youtube">
                <iframe
                    src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}"
                    title="Tráiler de ${title}"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen>
                </iframe>
            </div>
        `
        : `
            <div class="message">
                Tráiler no disponible para esta película.
            </div>
        `;

    const watchURL = trailerKey
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailerKey)}`
        : `https://www.themoviedb.org/movie/${movie.id}`;

    movieInfo.innerHTML = `
        <section class="background">

            <div class="background-fondo"
                style="background-image: url('${backdrop}')">

                <div class="movie">

                    <img
                        src="${poster}"
                        alt="${title}"
                        loading="eager"
                    >

                    <div class="datos-peliculas">

                        <h1>${title}</h1>

                        <div class="meta">
                            <span>⭐ ${rating}/10</span>
                            <span>🔥 ${popularity}</span>
                            <span>📅 ${releaseDate}</span>
                        </div>

                        <a
                            class="btn"
                            href="${watchURL}"
                            target="_blank"
                            rel="noopener noreferrer">

                            <svg xmlns="http://www.w3.org/2000/svg"
                                width="23"
                                height="23"
                                viewBox="0 0 20 20"
                                fill="currentColor">

                                <path fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                                    clip-rule="evenodd">
                                </path>
                            </svg>

                            Ver tráiler
                        </a>

                        <h3>
                            '${title}' Online en Picture<span>Reel</span>
                        </h3>

                        <p>${overview}</p>

                    </div>

                </div>

                ${trailerHTML}

            </div>

        </section>
    `;

}

// ========================================
// BÚSQUEDA
// ========================================

function searchMovies() {

    const searchTerm = searchInput.value.trim();

    currentSearch = searchTerm;
    currentPage = 1;

    fetchMovies(currentPage, currentSearch);
}

searchButton.addEventListener('click', searchMovies);

searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        searchMovies();
    }
});

// ========================================
// PAGINACIÓN
// ========================================

previousButton.addEventListener('click', () => {

    if (currentPage > 1 && !isLoading) {
        currentPage--;
        fetchMovies(currentPage, currentSearch);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

});

nextButton.addEventListener('click', () => {

    if (!isLoading) {
        currentPage++;
        fetchMovies(currentPage, currentSearch);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

});

// ========================================
// CONEXIÓN A INTERNET
// ========================================

window.addEventListener('online', () => {
    hideSpinner();

    if (!movieInfo.innerHTML.trim()) {
        fetchMovies(currentPage, currentSearch);
    }
});

window.addEventListener('offline', () => {
    showSpinner();
    showMessage('Sin conexión a Internet.');
});

// ========================================
// INICIO
// ========================================

fetchMovies(currentPage);
