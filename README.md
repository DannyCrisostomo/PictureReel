
---

# 🎬 PictureReel: Películas de TMDb con Paginación y Búsqueda (API) 🎥
```javascript
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
}
```

## Descripción

PictureReel es un proyecto que utiliza la API de The Movie Database (TMDb) para mostrar películas con funcionalidades de paginación y búsqueda.

## 🛠️ Instalación
1. Clona el repositorio.
2. Abre el archivo `index.html` en tu navegador.

## Uso
- Ingresa un término de búsqueda en el campo de búsqueda y presiona el botón "Buscar".
- Utiliza los botones de paginación para navegar entre las páginas de resultados.

## 🚀 Tecnologías utilizadas
- HTML
- CSS
- JavaScript

## Redirección a la página 🔗

Para acceder a PictureReel, visita [PictureReel](https://inquisitive-pony-28778a.netlify.app/).

![Preview en Móvil](https://github.com/DannyCrisostomo/PictureReel/blob/4f5727024fa700623c6b72a04fc406ff00899f18/img/movil.png)

![Preview en Windows](https://github.com/DannyCrisostomo/PictureReel/blob/4f5727024fa700623c6b72a04fc406ff00899f18/img/windows.png)

## Iconos utilizados
- 🎥 - Película
- 🔍 - Búsqueda
- ◀️ - Página anterior
- ▶️ - Página siguiente

## Créditos
Este proyecto fue creado por [DannyCrisostomo](https://github.com/DannyCrisostomo).

¡Disfruta explorando películas con PictureReel! 🍿

---
