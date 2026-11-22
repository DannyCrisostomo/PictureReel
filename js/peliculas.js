// ========================================
// CONFIGURACIÓN TMDB
// ========================================
const apiKey = '011e76f650e4be279c8687bb0ad90c27';
const API_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/';
const REGION = 'PE';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const state = { view: 'all', genre: '', genreName: '', query: '', page: 1, total: 1, token: 0, ctl: null };

const GENRES = {
    movie: [[28, 'Acción'], [35, 'Comedia'], [27, 'Terror'], [878, 'Ciencia ficción'], [16, 'Animación'], [18, 'Drama'], [10749, 'Romance']],
    tv: [[10759, 'Acción y aventura'], [35, 'Comedia'], [18, 'Drama'], [16, 'Animación'], [10765, 'Fantasía y ciencia ficción'], [80, 'Crimen']]
};

// [título, endpoint, parámetros, tipo forzado]
const ROWS = {
    all: [
        ['Tendencias ahora', 'trending/all/week', {}, null],
        ['Películas populares', 'movie/popular', {}, 'movie'],
        ['Series populares', 'tv/popular', {}, 'tv'],
        ['Mejor valoradas', 'movie/top_rated', {}, 'movie'],
        ['Próximos estrenos', 'movie/upcoming', { region: REGION }, 'movie'],
        ['Acción', 'discover/movie', { with_genres: 28 }, 'movie'],
        ['Comedia', 'discover/movie', { with_genres: 35 }, 'movie'],
        ['Terror', 'discover/movie', { with_genres: 27 }, 'movie']
    ],
    movie: [
        ['En cartelera', 'movie/now_playing', { region: REGION }, 'movie'],
        ['Populares', 'movie/popular', {}, 'movie'],
        ['Mejor valoradas', 'movie/top_rated', {}, 'movie'],
        ['Próximos estrenos', 'movie/upcoming', { region: REGION }, 'movie'],
        ['Ciencia ficción', 'discover/movie', { with_genres: 878 }, 'movie'],
        ['Animación', 'discover/movie', { with_genres: 16 }, 'movie']
    ],
    tv: [
        ['Series populares', 'tv/popular', {}, 'tv'],
        ['Mejor valoradas', 'tv/top_rated', {}, 'tv'],
        ['Al aire ahora', 'tv/on_the_air', {}, 'tv'],
        ['Drama', 'discover/tv', { with_genres: 18 }, 'tv'],
        ['Animación', 'discover/tv', { with_genres: 16 }, 'tv']
    ]
};

// ========================================
// UTILIDADES
// ========================================
function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const spinner = on => $('#spinner').classList.toggle('active', on);
const showMessage = text => { $('#content').innerHTML = `<p class="message">${escapeHTML(text)}</p>`; $('#more').hidden = true; };
const norm = (m, forced) => ({ ...m, type: forced || m.media_type || (m.title ? 'movie' : 'tv') });
const yearOf = m => (m.release_date || m.first_air_date || '').slice(0, 4);

async function api(path, params = {}, signal) {
    if (!navigator.onLine) throw new Error('No tienes conexión a Internet.');
    const url = new URL(`${API_URL}/${path}`);
    url.search = new URLSearchParams({ api_key: apiKey, language: 'es-ES', include_adult: 'false', ...params });
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(res.status === 401 ? 'La API key no es válida.' : 'No se pudo conectar con TMDB.');
    return res.json();
}

// ========================================
// MI LISTA (se guarda en el navegador)
// ========================================
const getList = () => { try { return JSON.parse(localStorage.getItem('picturereel-list')) || []; } catch { return []; } };
const inList = (id, type) => getList().some(x => x.id === id && x.type === type);
function toggleList(m, type) {
    const list = getList();
    const i = list.findIndex(x => x.id === m.id && x.type === type);
    if (i >= 0) list.splice(i, 1);
    else list.push({ id: m.id, type, title: m.title || m.name, poster_path: m.poster_path, release_date: m.release_date || m.first_air_date });
    try { localStorage.setItem('picturereel-list', JSON.stringify(list)); } catch { }
}

// ========================================
// TARJETAS Y FILAS
// ========================================
function cardHTML(m) {
    const title = escapeHTML(m.title || m.name || 'Sin título');
    const img = m.poster_path
        ? `<img loading="lazy" src="${IMAGE_URL}w342${m.poster_path}" alt="Póster de ${title}">`
        : `<div class="ph">${title}</div>`;
    const rate = m.vote_average ? `<span class="rating">★ ${m.vote_average.toFixed(1)}</span> · ` : '';
    return `<button class="movie-card" data-id="${m.id}" data-type="${m.type}" aria-label="${title}">
        ${img}${m.type === 'tv' ? '<span class="type-tag">SERIE</span>' : ''}
        <div class="card-info"><h3>${title}</h3><p>${rate}${yearOf(m)}</p></div></button>`;
}

function rowHTML(title, list) {
    return `<section class="movie-section"><div class="section-header"><h2>${escapeHTML(title)}</h2>
        <div class="carousel-controls">
            <button class="arrow" data-dir="-1" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="arrow" data-dir="1" aria-label="Siguiente"><i class="fa-solid fa-chevron-right"></i></button>
        </div></div><div class="movie-row">${list.map(cardHTML).join('')}</div></section>`;
}

// ========================================
// HERO
// ========================================
function setHero(m) {
    if (!m) return;
    const title = escapeHTML(m.title || m.name);
    const bg = m.backdrop_path ? `${IMAGE_URL}w1280${m.backdrop_path}` : '';
    $('#hero').innerHTML = `
        <div class="hero-background" style="background-image:url('${bg}')"></div>
        <div class="hero-info">
            <h1>${title}</h1>
            <div class="hero-meta"><span class="rating">★ ${(m.vote_average || 0).toFixed(1)}</span><span>${yearOf(m)}</span><span>${m.type === 'tv' ? 'Serie' : 'Película'}</span></div>
            <p>${escapeHTML(m.overview)}</p>
            <div class="hero-buttons">
                <button class="hbtn play" id="hero-play"><i class="fa-solid fa-play"></i> Reproducir tráiler</button>
                <button class="hbtn info" id="hero-info"><i class="fa-solid fa-circle-info"></i> Más información</button>
            </div>
        </div>`;
    $('#hero-play').onclick = () => openModal(m.id, m.type, true);
    $('#hero-info').onclick = () => openModal(m.id, m.type, false);
}

// ========================================
// CARGA DE CONTENIDO
// ========================================
async function renderHome(my) {
    const rows = ROWS[state.view];
    const results = await Promise.all(rows.map(([, path, params, type]) =>
        api(path, params, state.ctl.signal).then(d => d.results.filter(x => x.poster_path).map(x => norm(x, type)))));
    if (my !== state.token) return;
    const mine = getList();
    $('#content').innerHTML = (mine.length ? rowHTML('Mi lista', mine) : '') + rows.map((r, i) => rowHTML(r[0], results[i])).join('');
    $('#more').hidden = true;
    const candidates = results[0].filter(x => x.backdrop_path && x.overview);
    setHero(candidates[Math.floor(Math.random() * candidates.length)] || results[0][0]);
}

async function renderGrid(my, append) {
    if (state.view === 'list') {
        const list = getList();
        $('#content').innerHTML = list.length
            ? `<section class="movie-section"><div class="section-header"><h2>Mi lista</h2></div><div class="movie-grid">${list.map(m => cardHTML(norm(m, m.type))).join('')}</div></section>`
            : '<p class="message">Tu lista está vacía. Abre un título y pulsa «Mi lista».</p>';
        $('#more').hidden = true;
        return;
    }
    const t = state.view === 'tv' ? 'tv' : 'movie';
    const data = state.query
        ? await api(state.view === 'all' ? 'search/multi' : `search/${t}`, { query: state.query, page: state.page }, state.ctl.signal)
        : await api(`discover/${t}`, { with_genres: state.genre, sort_by: 'popularity.desc', page: state.page }, state.ctl.signal);
    if (my !== state.token) return;
    const list = data.results
        .filter(x => x.poster_path && (!state.query || state.view !== 'all' || ['movie', 'tv'].includes(x.media_type)))
        .map(x => norm(x, state.query && state.view === 'all' ? null : t));
    state.total = Math.min(data.total_pages || 1, 500);
    if (append) {
        $('.movie-grid').insertAdjacentHTML('beforeend', list.map(cardHTML).join(''));
    } else if (list.length) {
        const title = state.query ? `Resultados para «${state.query}»` : state.genreName;
        $('#content').innerHTML = `<section class="movie-section"><div class="section-header"><h2>${escapeHTML(title)}</h2></div><div class="movie-grid">${list.map(cardHTML).join('')}</div></section>`;
    } else {
        showMessage('No encontramos resultados. Prueba con otro título o género.');
    }
    $('#more').hidden = state.page >= state.total || !list.length;
}

async function load(append = false) {
    state.ctl?.abort();
    state.ctl = new AbortController();
    const my = ++state.token;
    const home = !state.genre && !state.query && state.view !== 'list';
    $('#hero').hidden = !home;
    document.body.classList.toggle('no-hero', !home);
    spinner(true);
    try {
        if (home) await renderHome(my); else await renderGrid(my, append);
    } catch (e) {
        if (e.name !== 'AbortError') { $('#hero').hidden = true; document.body.classList.add('no-hero'); showMessage(e.message); }
    } finally {
        if (my === state.token) spinner(false);
    }
}

// ========================================
// NAVEGACIÓN, GÉNEROS Y BÚSQUEDA
// ========================================
function renderChips() {
    const genres = GENRES[state.view === 'tv' ? 'tv' : 'movie'];
    $('#chips').hidden = state.view === 'list';
    $('#chips').innerHTML = `<button class="chip ${state.genre ? '' : 'active'}" data-genre="">Todo</button>` +
        genres.map(([id, name]) => `<button class="chip ${String(id) === String(state.genre) ? 'active' : ''}" data-genre="${id}">${name}</button>`).join('');
}

function setView(view) {
    Object.assign(state, { view, genre: '', genreName: '', query: '', page: 1 });
    $('#q').value = '';
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view && b.tagName === 'BUTTON'));
    renderChips();
    window.scrollTo({ top: 0 });
    load();
}

document.addEventListener('click', e => {
    const view = e.target.closest('[data-view]');
    if (view) { e.preventDefault(); return setView(view.dataset.view); }

    const chip = e.target.closest('.chip');
    if (chip) {
        Object.assign(state, { genre: chip.dataset.genre, genreName: chip.textContent, query: '', page: 1 });
        $('#q').value = '';
        renderChips();
        window.scrollTo({ top: 0 });
        return load();
    }

    const arrow = e.target.closest('.arrow');
    if (arrow) {
        const row = arrow.closest('.movie-section').querySelector('.movie-row');
        return row.scrollBy({ left: Number(arrow.dataset.dir) * row.clientWidth * .85, behavior: 'smooth' });
    }

    const card = e.target.closest('.movie-card');
    if (card) openModal(Number(card.dataset.id), card.dataset.type, false);
});

$('#more').addEventListener('click', () => { state.page++; load(true); });

$('#search-toggle').addEventListener('click', () => {
    const box = $('#search-box');
    box.classList.toggle('active');
    if (box.classList.contains('active')) $('#q').focus();
});

let searchTimer;
$('#q').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        Object.assign(state, { query: e.target.value.trim(), genre: '', genreName: '', page: 1 });
        if (state.view === 'list') state.view = 'all';
        renderChips();
        load();
    }, 400);
});

window.addEventListener('scroll', () => $('#navbar').classList.toggle('scrolled', window.scrollY > 40), { passive: true });

// ========================================
// MODAL DE DETALLE + TRÁILER
// ========================================
const modal = $('#modal');
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
let listChanged = false;
modal.addEventListener('close', () => {
    modal.innerHTML = '';
    if (listChanged) {
        listChanged = false;
        if (state.view === 'list' || (!state.genre && !state.query)) load();
    }
});

async function openModal(id, type, autoplay) {
    modal.innerHTML = '<div class="sheet-head"><span class="grip"></span></div><p class="loading">Cargando…</p>';
    modal.showModal();
    try {
        const m = await api(`${type}/${id}`, { append_to_response: 'credits,videos,watch/providers' });
        const title = escapeHTML(m.title || m.name);
        const trailer = m.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
            || m.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer')
            || m.videos.results.find(v => v.site === 'YouTube');
        const bg = m.backdrop_path ? `${IMAGE_URL}w780${m.backdrop_path}` : '';
        const date = m.release_date || m.first_air_date || '';
        const upcoming = date && new Date(date) > new Date();
        const duration = type === 'movie' ? (m.runtime ? `${m.runtime} min` : '') : `${m.number_of_seasons} temporada${m.number_of_seasons === 1 ? '' : 's'}`;
        const pills = [
            m.vote_count > 0 ? `<span class="pill rating">★ ${m.vote_average.toFixed(1)}</span>` : '<span class="pill">Sin valoraciones</span>',
            yearOf(m) ? `<span class="pill">${yearOf(m)}</span>` : '',
            duration ? `<span class="pill">${duration}</span>` : '',
            upcoming ? '<span class="pill soon">Próximo estreno</span>' : ''
        ].join('');
        const cast = m.credits.cast.slice(0, 12).map(c => `
            <li><div class="avatar">${c.profile_path ? `<img loading="lazy" src="${IMAGE_URL}w185${c.profile_path}" alt="">` : '<i class="fa-solid fa-user"></i>'}</div>
            <b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.character || '')}</small></li>`).join('');
        const prov = m['watch/providers'].results[REGION];
        const all = prov ? [...(prov.flatrate || []), ...(prov.rent || []), ...(prov.buy || [])] : [];
        const unique = [...new Map(all.map(p => [p.provider_id, p])).values()];
        const logos = unique.map(p => `<img src="${IMAGE_URL}w92${p.logo_path}" alt="${escapeHTML(p.provider_name)}" title="${escapeHTML(p.provider_name)}">`).join('');

        modal.innerHTML = `
            <div class="sheet-head"><span class="grip"></span><button class="close-modal" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="modal-backdrop" id="mb" style="background-image:url('${bg}')">
                ${trailer ? '<button class="big-play" id="m-big" aria-label="Reproducir tráiler"><i class="fa-solid fa-play"></i></button>' : ''}
            </div>
            <div class="modal-details">
                <h2>${title}</h2>
                <div class="pills">${pills}</div>
                <div class="genres">${m.genres.map(g => `<span>${escapeHTML(g.name)}</span>`).join('')}</div>
                <div class="mbtns">
                    ${trailer ? '<button class="hbtn play" id="m-play"><i class="fa-solid fa-play"></i> Ver tráiler</button>' : ''}
                    <button class="hbtn info" id="m-list"></button>
                </div>
                <h3>Sinopsis</h3>
                <p class="overview">${escapeHTML(m.overview) || 'Sin sinopsis disponible en español.'}</p>
                ${cast ? `<h3>Reparto</h3><ul class="cast">${cast}</ul>` : ''}
                <h3>Dónde verla en ${REGION}</h3>
                ${logos ? `<div class="logos">${logos}</div>` : '<p class="muted">Sin datos de plataformas para tu región.</p>'}
            </div>`;

        modal.querySelector('.close-modal').onclick = () => modal.close();
        const play = () => {
            const box = $('#mb');
            box.classList.add('playing');
            box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&playsinline=1&rel=0" title="Tráiler de ${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
            box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
        if (trailer) { $('#m-play').onclick = play; $('#m-big').onclick = play; }
        const btn = $('#m-list');
        const label = () => { btn.innerHTML = inList(m.id, type) ? '<i class="fa-solid fa-check"></i> En mi lista' : '<i class="fa-solid fa-plus"></i> Mi lista'; };
        label();
        btn.onclick = () => { toggleList(m, type); label(); listChanged = true; };
        if (autoplay && trailer) play();
    } catch (e) {
        modal.innerHTML = `<div class="sheet-head"><button class="close-modal" aria-label="Cerrar" onclick="this.closest('dialog').close()"><i class="fa-solid fa-xmark"></i></button></div><p class="loading">${escapeHTML(e.message)}</p>`;
    }
}

// ========================================
// INICIO
// ========================================
renderChips();
load();

// ========================================
// BLOQUEO DE SELECCIÓN Y ZOOM
// ========================================
['contextmenu', 'selectstart', 'copy', 'dragstart'].forEach(ev =>
    document.addEventListener(ev, e => { if (!e.target.closest?.('input')) e.preventDefault(); })
);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
});