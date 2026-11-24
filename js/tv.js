// ========================================
// TV EN VIVO (listas abiertas de iptv-org)
// Se activa desde peliculas.js con TV.open() / TV.leave()
// ========================================
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const video = $('#video');

  const PLAYLIST = (cc) => `https://iptv-org.github.io/iptv/countries/${cc}.m3u`;

  const GROUPS_ES = {
    General: 'General', News: 'Noticias', Music: 'Música', Sports: 'Deportes', Movies: 'Películas',
    Kids: 'Niños', Entertainment: 'Entretenimiento', Culture: 'Cultura', Documentary: 'Documentales',
    Education: 'Educación', Religious: 'Religión', Series: 'Series', Lifestyle: 'Estilo de vida',
    Comedy: 'Comedia', Animation: 'Animación', Business: 'Negocios', Cooking: 'Cocina', Family: 'Familia',
    Weather: 'Clima', Travel: 'Viajes', Outdoor: 'Aire libre', Science: 'Ciencia', Undefined: 'Otros',
  };
  const groupName = (g) => GROUPS_ES[g] || g;

  const store = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hue = (t) => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const setIcon = (btn, id) => { btn.innerHTML = `<svg class="i"><use href="#${id}"/></svg>`; };

  // ---------- 1) Leer el archivo M3U ----------
  function parseM3U(text) {
    const out = [];
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const attrs = {};
        line.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => (attrs[k] = v));
        const rest = line.replace(/([\w-]+)="[^"]*"/g, '');
        const name = rest.slice(rest.indexOf(',') + 1).trim();
        cur = {
          name: name || attrs['tvg-name'] || 'Canal',
          logo: attrs['tvg-logo'] || '',
          group: (attrs['group-title'] || 'Undefined').split(';')[0] || 'Undefined',
          headers: false,
        };
      } else if (line.startsWith('#EXTVLCOPT') && cur) {
        if (/http-(referrer|referer|user-agent)/i.test(line)) cur.headers = true;
      } else if (!line.startsWith('#') && cur) {
        cur.url = line;
        out.push(cur);
        cur = null;
      }
    }
    return out;
  }

  // ---------- 2) Comprobar si un canal da señal ----------
  const TIMEOUT = 7000;
  const resolveUrl = (base, ref) => new URL(ref, base).href;
  const lines = (t) => t.split(/\r?\n/).map((l) => l.trim());

  async function fetchText(url) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      return await r.text();
    } finally { clearTimeout(t); }
  }

  async function probe(url) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      ctl.abort();
    } finally { clearTimeout(t); }
  }

  async function check(c) {
    try {
      if (!/\.m3u8(\?|$)/i.test(c.url)) {
        if (!/\.(mp4|webm|ogv)(\?|$)/i.test(c.url)) return false;
        await probe(c.url);
        return true;
      }
      let url = c.url;
      let text = await fetchText(url);
      if (!text.includes('#EXTM3U')) return false;

      if (text.includes('#EXT-X-STREAM-INF')) {
        const l = lines(text);
        const i = l.findIndex((x) => x.startsWith('#EXT-X-STREAM-INF'));
        const ref = l.slice(i + 1).find((x) => x && !x.startsWith('#'));
        if (!ref) return false;
        url = resolveUrl(url, ref);
        text = await fetchText(url);
        if (!text.includes('#EXTM3U')) return false;
      }

      const seg = lines(text).find((x) => x && !x.startsWith('#'));
      if (!seg) return false;
      await probe(resolveUrl(url, seg));
      return true;
    } catch {
      return false;
    }
  }

  // ---------- 3) Estado ----------
  const TTL = 60 * 60 * 1000;
  let channels = [];
  let shown = [];
  let tab = 'ok';
  let group = '';
  let favOnly = false;
  let query = '';
  let current = null;
  const favs = store.get('tvFavs') || [];
  const isFav = (url) => favs.some((f) => f.url === url);
  const lastCh = store.get('tvLast');

  const status = new Map(Object.entries(store.get('tvStatus') || {}));
  const stateOf = (url) => status.get(url)?.[0];
  const fresh = (url) => { const s = status.get(url); return !!s && Date.now() - s[1] < TTL; };
  const saveStatus = () => {
    const now = Date.now();
    const o = {};
    for (const [u, s] of status) if (now - s[1] < TTL * 24) o[u] = s;
    store.set('tvStatus', o);
  };
  const setState = (url, st) => status.set(url, [st, Date.now()]);

  // ---------- 4) Cargar y verificar un país ----------
  let vTok = 0, vDone = 0, vTotal = 0;

  async function loadCountry(cc) {
    vTok++;
    $('#tvGrid').innerHTML = '<p class="empty">Cargando canales…</p>';
    $('#prog').textContent = '';
    try {
      const res = await fetch(PLAYLIST(cc));
      if (!res.ok) throw new Error(res.status);
      const secure = location.protocol === 'https:';
      const seen = new Set();
      const cname = ($('#country').querySelector(`option[value="${cc}"]`) || {}).textContent || '';
      channels = parseM3U(await res.text()).filter((c) =>
        !c.headers &&
        (!secure || c.url.startsWith('https:')) &&
        !seen.has(c.url) && seen.add(c.url)).map((c) => ({ ...c, country: cname }));
      group = ''; favOnly = false;
      draw();
      verify(channels);
    } catch {
      channels = [];
      $('#tvGrid').innerHTML = '<p class="empty">No se pudo cargar la lista. Revisa tu conexión.</p>';
    }
  }

  async function verify(list, force = false) {
    const my = ++vTok;
    const queue = list.filter((c) => force || !fresh(c.url));
    vDone = 0; vTotal = queue.length;
    progress();
    if (!vTotal) return;

    let last = 0;
    const worker = async () => {
      while (queue.length && my === vTok) {
        const c = queue.shift();
        const ok = await check(c);
        if (my !== vTok) return;
        setState(c.url, ok ? 'ok' : 'bad');
        vDone++;
        const now = Date.now();
        if (now - last > 400) { last = now; draw(); progress(); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (my !== vTok) return;
    vDone = vTotal;
    saveStatus();
    draw();
    progress();
  }

  const verifying = () => vTotal > 0 && vDone < vTotal;

  function progress() {
    const ok = channels.filter((c) => stateOf(c.url) === 'ok').length;
    const bad = channels.filter((c) => stateOf(c.url) === 'bad').length;
    $('#nOk').textContent = ok;
    $('#nBad').textContent = bad;
    $('#prog').textContent = verifying()
      ? `Verificando canales… ${vDone} de ${vTotal}`
      : `${ok} con señal · ${bad} sin señal`;
    $('#recheck').disabled = verifying();
  }

  // ---------- 5) Dibujar la lista ----------
  function drawChips(list) {
    const groups = [...new Set(list.map((c) => c.group))].sort((a, b) => groupName(a).localeCompare(groupName(b)));
    $('#tvChips').innerHTML =
      `<button class="tchip ${!group && !favOnly ? 'on' : ''}" data-g="">Todos</button>` +
      groups.map((g) => `<button class="tchip ${group === g && !favOnly ? 'on' : ''}" data-g="${esc(g)}">${esc(groupName(g))}</button>`).join('') +
      `<button class="tchip ${favOnly ? 'on' : ''}" data-fav="1">★ Mis canales</button>`;
  }

  function card(c) {
    const cls = ['ch', current && current.url === c.url ? 'on' : '', stateOf(c.url) === 'bad' ? 'bad' : ''].join(' ');
    const logo = c.logo && c.logo.startsWith('https') ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `<div class="${cls}" data-url="${esc(c.url)}" tabindex="0" role="button" aria-label="Ver ${esc(c.name)}">
      <div class="tlogo" style="--h:${hue(c.name)}"><span>${esc(c.name.charAt(0).toUpperCase())}</span>${logo}</div>
      <p>${esc(c.name)}</p><small>${esc(groupName(c.group))}</small>
      <button class="star" data-star="${esc(c.url)}" aria-pressed="${isFav(c.url)}" aria-label="Guardar canal">★</button>
    </div>`;
  }

  function draw() {
    const inTab = channels.filter((c) => stateOf(c.url) === tab);
    drawChips(favOnly ? favs : inTab);

    const q = query.trim().toLowerCase();
    const base = favOnly ? favs : inTab;
    const list = base.filter((c) => (!group || favOnly || c.group === group) && (!q || c.name.toLowerCase().includes(q)));
    shown = list;

    let empty = 'No hay canales con ese filtro.';
    if (favOnly) empty = 'Aún no guardaste canales con ★.';
    else if (!inTab.length) {
      empty = verifying() ? 'Verificando canales…'
        : tab === 'ok' ? 'Ningún canal responde ahora mismo. Mira “Sin señal” o toca “Volver a verificar”.'
        : 'Todos los canales respondieron.';
    }
    $('#tvGrid').innerHTML = list.length ? list.map(card).join('') : `<p class="empty">${empty}</p>`;
    $('#seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    progress();
  }

  // ======================================================================
  // 6) REPRODUCTOR (diseño tipo TV: número, logo, EN VIVO, reloj, panel de canales)
  // ======================================================================
  const ov = $('#ov'), box = $('#tvScreen'), menu = $('#qMenu'), panel = $('#chPanel');
  const sel = $('#country');
  let hls = null;
  let isLive = true;
  let seeking = false;
  let levels = [];
  let qPref = store.get('tvQ') || 'auto';
  const msg = (t) => { $('#tvMsg').textContent = t; };
  const playable = () => shown.filter((c) => stateOf(c.url) !== 'bad');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;

  function pickLevel(lv, pref) {
    if (pref === 'auto') return -1;
    const withH = lv.filter((l) => l.h);
    if (!withH.length) return -1;
    const ok = withH.filter((l) => l.h <= pref).sort((a, b) => b.h - a.h || b.br - a.br);
    if (ok.length) return ok[0].i;
    return withH.sort((a, b) => a.h - b.h || a.br - b.br)[0].i;
  }

  // --- controles: se ocultan solos ---
  let hideT;
  let firstPlay = false;
  function showCtl(ms = 3500) {
    ov.classList.remove('hide');
    clearTimeout(hideT);
    if (!video.paused && menu.hidden && panel.hidden && $('#err').hidden) hideT = setTimeout(() => ov.classList.add('hide'), ms);
  }
  // Un toque en cualquier parte (también el centro) muestra los controles.
  // Si estaban ocultos, ese toque solo los muestra: no pausa ni pulsa nada.
  let hiddenAtDown = false;
  box.addEventListener('pointerdown', () => { hiddenAtDown = ov.classList.contains('hide'); }, true);
  box.addEventListener('click', (e) => {
    if (hiddenAtDown) {
      hiddenAtDown = false;
      e.stopPropagation();
      e.preventDefault();
      showCtl();
      return;
    }
    if (e.target.closest('button,input,.tmenu,.panel')) { showCtl(); return; }
    if (!menu.hidden) { menu.hidden = true; return; }
    if (!panel.hidden) { panel.hidden = true; return; }
    ov.classList.add('hide');
  }, true);
  // Solo el mouse real los muestra al moverse (el toque en celular dispara un mousemove falso)
  box.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showCtl(); });

  const spin = (on) => { $('#spin').hidden = !on; box.classList.toggle('busy', on); };
  function showError(t) {
    $('#errTxt').textContent = t;
    $('#err').hidden = false;
    spin(false);
    ov.classList.remove('hide');
  }
  const hideError = () => { $('#err').hidden = true; };

  // --- encabezado del canal: número, logo, nombre, país ---
  const numOf = (c) => { const i = playable().findIndex((x) => x.url === c.url); return i >= 0 ? i + 1 : '–'; };
  function setBrand(c) {
    $('#ovName').textContent = c.name;
    $('#chNum').textContent = numOf(c);
    $('#ovCountry').textContent = c.country || '';
    const lg = $('#chLogo');
    const initial = c.name.charAt(0).toUpperCase();
    lg.textContent = '';
    if (c.logo && c.logo.startsWith('https')) {
      const im = new Image();
      im.alt = '';
      im.onerror = () => { lg.textContent = initial; };
      im.src = c.logo;
      lg.appendChild(im);
    } else lg.textContent = initial;
    syncFav();
  }

  // --- favoritos ---
  function toggleFav(c) {
    const i = favs.findIndex((f) => f.url === c.url);
    if (i >= 0) favs.splice(i, 1);
    else favs.push({ name: c.name, logo: c.logo, group: c.group, country: c.country, url: c.url });
    store.set('tvFavs', favs);
  }
  function syncFav() {
    const on = !!current && isFav(current.url);
    const b = $('#bFav');
    b.setAttribute('aria-pressed', on);
    b.querySelector('use').setAttribute('href', on ? '#i-heartf' : '#i-heart');
    b.querySelector('span').textContent = on ? 'Guardado' : 'Favorito';
  }
  $('#bFav').addEventListener('click', () => { if (current) { toggleFav(current); syncFav(); draw(); } });

  // --- cambiar de canal ---
  function zap(d) {
    const pool = playable();
    if (!pool.length) { msg('No hay más canales con señal en esta lista.'); return; }
    const i = pool.findIndex((c) => current && c.url === current.url);
    const n = i < 0 ? (d > 0 ? 0 : pool.length - 1) : (i + d + pool.length) % pool.length;
    play(pool[n]);
  }

  // --- panel lateral de canales ---
  function renderPanel() {
    panel.innerHTML = '<h4>Canales</h4>' + playable().map((c, i) =>
      `<button class="prow ${current && c.url === current.url ? 'on' : ''}" data-url="${esc(c.url)}"><em>${i + 1}</em><span>${esc(c.name)}</span></button>`).join('');
    panel.querySelector('.on')?.scrollIntoView({ block: 'center' });
  }
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-url]');
    if (!b) return;
    const c = [...channels, ...favs].find((x) => x.url === b.dataset.url);
    if (c) play(c);
  });
  $('#bList').addEventListener('click', async () => {
    const wasFs = !!fsEl();
    if (!wasFs && box.requestFullscreen) { try { await box.requestFullscreen(); } catch {} }
    panel.hidden = wasFs ? !panel.hidden : false;
    if (!panel.hidden) renderPanel();
    showCtl();
  });

  // --- reproducir ---
  function stop() {
    clearTimeout(stallT);
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function setSession(c) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: c.name, artist: 'PictureReel · TV en vivo',
        artwork: c.logo && c.logo.startsWith('https') ? [{ src: c.logo, sizes: '256x256' }] : [],
      });
    } catch {}
  }

  function fail(c) {
    setState(c.url, 'bad');
    saveStatus();
    stop();
    showError('Este canal dejó de responder y se movió a “Sin señal”.');
    draw();
  }

  function play(c) {
    current = c;
    store.set('tvLast', { name: c.name, logo: c.logo, group: c.group, country: c.country, url: c.url });
    setBrand(c);
    msg('Conectando…');
    hideError();
    spin(true);
    stop();
    firstPlay = true;
    isLive = true;
    levels = [];
    buildMenu();
    setSession(c);
    updateLive();
    draw();
    if (!panel.hidden) renderPanel();

    const isHls = /\.m3u8(\?|$)/i.test(c.url);
    if (isHls && window.Hls && Hls.isSupported()) {
      let retried = false;
      hls = new Hls({
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        enableWorker: true,
        maxBufferLength: 20,
        backBufferLength: 30,
      });
      hls.loadSource(c.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        levels = hls.levels.map((l, i) => ({ i, h: l.height || 0, br: l.bitrate || 0 }));
        buildMenu();
        hls.currentLevel = pickLevel(levels, qPref);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_, d) => { isLive = !!d.details.live; updateLive(); });
      hls.on(Hls.Events.LEVEL_SWITCHED, () => markQuality());
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !retried) { retried = true; hls.recoverMediaError(); return; }
        fail(c);
      });
    } else {
      video.src = c.url;
      video.play().catch(() => {});
      video.onerror = () => fail(c);
    }
  }

  // --- ajustes (engranaje): calidad y opciones del reproductor ---
  function buildMenu() {
    const heights = [...new Set(levels.map((l) => l.h).filter(Boolean))].sort((a, b) => b - a);
    const quality = heights.length > 1
      ? '<small>Calidad</small><button data-q="auto">Auto</button>' + heights.map((h) => `<button data-q="${h}">${h}p</button>`).join('')
      : '';
    menu.innerHTML = quality + '<small>Reproductor</small>' +
      '<button data-act="prev">Canal anterior</button><button data-act="next">Canal siguiente</button>' +
      (document.pictureInPictureEnabled ? '<button data-act="pip">Imagen en imagen</button>' : '') +
      `<button data-act="mute">${video.muted ? 'Activar sonido' : 'Silenciar'}</button>`;
    markQuality();
  }

  function markQuality() {
    menu.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === String(qPref)));
    const a = menu.querySelector('[data-q="auto"]');
    if (a) {
      const h = hls && hls.currentLevel >= 0 ? hls.levels[hls.currentLevel]?.height : 0;
      a.textContent = qPref === 'auto' && h ? `Auto · ${h}p` : 'Auto';
    }
  }

  async function togglePip() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (current) await video.requestPictureInPicture();
    } catch {}
  }
  function toggleMute() {
    video.muted = !video.muted;
    store.set('tvMuted', video.muted);
  }

  $('#bSet').addEventListener('click', () => {
    if (menu.hidden) buildMenu();
    menu.hidden = !menu.hidden;
    showCtl();
  });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.q) {
      qPref = b.dataset.q === 'auto' ? 'auto' : +b.dataset.q;
      store.set('tvQ', qPref);
      if (hls) hls.currentLevel = pickLevel(levels, qPref);
      markQuality();
    } else if (b.dataset.act === 'prev') zap(-1);
    else if (b.dataset.act === 'next') zap(1);
    else if (b.dataset.act === 'pip') togglePip();
    else if (b.dataset.act === 'mute') toggleMute();
    menu.hidden = true;
    showCtl();
  });

  // --- en vivo y barra de progreso ---
  function updateLive() {
    const s = video.seekable;
    const vod = !isLive && isFinite(video.duration);
    let pct = 100;
    if (s.length) {
      const a = s.start(0), b = s.end(s.length - 1);
      if (b > a) pct = Math.min(100, Math.max(0, (video.currentTime - a) / (b - a) * 100));
    }
    let atLive = true;
    if (isLive) {
      const edge = hls && hls.liveSyncPosition;
      atLive = edge ? edge - video.currentTime < 12 : pct > 97;
    }
    const seek = $('#seek');
    if (!seeking) { seek.value = pct * 10; seek.style.setProperty('--p', pct + '%'); }
    const lb = $('#liveBtn');
    lb.hidden = !isLive;
    lb.classList.toggle('on', atLive);
    lb.textContent = atLive ? '● EN VIVO' : '↻ Ir al vivo';
    $('#ovLive').hidden = !isLive;
    $('#liveTxt').textContent = vod ? 'Reproduciendo' : atLive ? 'Estás viendo la señal en directo' : 'Estás viendo unos segundos atrás';
  }

  $('#liveBtn').addEventListener('click', () => {
    if (hls && hls.liveSyncPosition) video.currentTime = hls.liveSyncPosition;
    else if (video.seekable.length) video.currentTime = video.seekable.end(video.seekable.length - 1);
    video.play().catch(() => {});
  });
  const seekEl = $('#seek');
  seekEl.addEventListener('pointerdown', () => { seeking = true; });
  ['pointerup', 'pointercancel', 'change'].forEach((ev) => seekEl.addEventListener(ev, () => { seeking = false; }));
  seekEl.addEventListener('input', (e) => {
    const v = e.target.value / 1000, s = video.seekable;
    e.target.style.setProperty('--p', e.target.value / 10 + '%');
    if (s.length) { const a = s.start(0), b = s.end(s.length - 1); video.currentTime = a + v * (b - a); }
    else if (isFinite(video.duration)) video.currentTime = v * video.duration;
  });

  let lastTick = 0;
  video.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastTick < 1000) return;
    lastTick = now;
    updateLive();
  });
  video.addEventListener('loadedmetadata', () => { if (!hls) { isLive = !isFinite(video.duration); } updateLive(); });

  // --- play / pausa ---
  function toggle() {
    if (!current) { const c = lastCh || playable()[0]; if (c) play(c); return; }
    if (video.paused) video.play().catch(() => {}); else video.pause();
  }
  $('#bPlay').addEventListener('click', toggle);
  $('#errRetry').addEventListener('click', () => { if (current) play(current); });
  $('#errNext').addEventListener('click', () => zap(1));

  video.addEventListener('play', () => { setIcon($('#bPlay'), 'i-pause'); showCtl(); });
  video.addEventListener('pause', () => { setIcon($('#bPlay'), 'i-play'); showCtl(); });

  // --- cortes de señal: reintenta solo ---
  let stallT = null, stallStage = 0;
  function stalled() {
    if (!current) return;
    if (stallStage === 0) {
      stallStage = 1;
      if (hls) hls.startLoad();
      msg('Reconectando…');
      stallT = setTimeout(stalled, 10000);
    } else {
      showError('Se cortó la señal. Puedes reintentar o cambiar de canal.');
    }
  }
  video.addEventListener('waiting', () => {
    spin(true);
    clearTimeout(stallT);
    stallStage = 0;
    stallT = setTimeout(stalled, 8000);
  });
  ['playing', 'canplay'].forEach((ev) => video.addEventListener(ev, () => {
    clearTimeout(stallT);
    spin(false);
    hideError();
  }));
  video.addEventListener('playing', () => {
    if (!current) return;
    msg('En vivo: ' + current.name);
    if (firstPlay) { firstPlay = false; showCtl(1500); }   // al arrancar, se ocultan solos enseguida
    if (stateOf(current.url) !== 'ok') {
      setState(current.url, 'ok');
      saveStatus();
      draw();
    }
  });
  addEventListener('offline', () => msg('Sin conexión a internet.'));
  addEventListener('online', () => { if (current && !$('#err').hidden) play(current); else msg(''); });

  // --- volumen guardado ---
  video.volume = store.get('tvVol') ?? 1;
  video.muted = !!store.get('tvMuted');

  // --- reloj ---
  const tick = () => { $('#clock').textContent = new Date().toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' }); };
  tick();
  setInterval(tick, 20000);

  // --- enviar a otra pantalla (si el navegador lo permite) ---
  const cast = $('#bCast');
  if ('remote' in video) {
    cast.hidden = false;
    cast.addEventListener('click', () => video.remote.prompt().catch(() => {}));
  } else if (video.webkitShowPlaybackTargetPicker) {
    cast.hidden = false;
    cast.addEventListener('click', () => video.webkitShowPlaybackTargetPicker());
  }

  // --- pantalla completa (gira a horizontal solo) ---
  async function enterFs() {
    try {
      if (box.requestFullscreen) await box.requestFullscreen();
      else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch {}
  }
  async function exitFs() {
    try { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
  }
  $('#bFull').addEventListener('click', () => (fsEl() ? exitFs() : enterFs()));
  $('#bBack').addEventListener('click', exitFs);
  const onFs = () => {
    const on = fsEl() === box;
    box.classList.toggle('fs', on);
    if (!on) panel.hidden = true;
    setIcon($('#bFull'), on ? 'i-fsx' : 'i-fs');
    try { if (on) window.screen.orientation.lock('landscape').catch(() => {}); else window.screen.orientation.unlock(); } catch {}
    showCtl();
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  // --- deslizar arriba/abajo para cambiar de canal (solo en pantalla completa) ---
  let t0 = null;
  box.addEventListener('touchstart', (e) => {
    const ok = box.classList.contains('fs') && e.touches.length === 1 && !e.target.closest('button,input,.tmenu,.panel');
    t0 = ok ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (!t0) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - t0.y, dx = t.clientX - t0.x;
    t0 = null;
    if (Math.abs(dy) > 70 && Math.abs(dx) < 60) zap(dy < 0 ? 1 : -1);
  }, { passive: true });

  // --- que la pantalla no se apague mientras ves TV ---
  let wake = null;
  async function keepAwake(on) {
    try {
      if (on) {
        if (!wake && navigator.wakeLock) {
          wake = await navigator.wakeLock.request('screen');
          wake.addEventListener('release', () => { wake = null; });
        }
      } else if (wake) { await wake.release(); wake = null; }
    } catch {}
  }
  video.addEventListener('playing', () => keepAwake(true));
  video.addEventListener('pause', () => keepAwake(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !video.paused) keepAwake(true);
  });

  // --- botones de la pantalla de bloqueo ---
  if ('mediaSession' in navigator) {
    const m = navigator.mediaSession;
    try {
      m.setActionHandler('play', () => video.play().catch(() => {}));
      m.setActionHandler('pause', () => video.pause());
      m.setActionHandler('previoustrack', () => zap(-1));
      m.setActionHandler('nexttrack', () => zap(1));
    } catch {}
  }

  // --- teclado: solo cuando la sección TV en vivo está visible ---
  addEventListener('keydown', (e) => {
    if ($('#tvView').hidden) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'f') $('#bFull').click();
    else if (k === 'm') toggleMute();
    else if (e.key === 'ArrowUp') { e.preventDefault(); zap(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); zap(1); }
  });

  // Al abrir: muestra el último canal visto (se reproduce al tocar ▶)
  if (lastCh) { setBrand(lastCh); msg('Último canal: ' + lastCh.name + ' · toca ▶ para verlo'); }
  setIcon($('#bPlay'), 'i-play');

  // ======================================================================
  // 7) EVENTOS DE LA LISTA
  // ======================================================================
  $('#seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab; favOnly = false; group = '';
    draw();
  });

  $('#recheck').addEventListener('click', () => verify(channels, true));

  $('#tvGrid').addEventListener('click', (e) => {
    const s = e.target.closest('[data-star]');
    if (s) {
      const url = s.dataset.star;
      const c = channels.find((x) => x.url === url) || favs.find((f) => f.url === url) || current;
      if (c) toggleFav(c);
      syncFav();
      draw();
      return;
    }
    const el = e.target.closest('[data-url]');
    if (!el) return;
    const c = [...channels, ...favs].find((x) => x.url === el.dataset.url);
    if (c) { play(c); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('#tvGrid').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.ch')) e.target.click();
  });

  $('#tvChips').addEventListener('click', (e) => {
    const b = e.target.closest('.tchip');
    if (!b) return;
    favOnly = 'fav' in b.dataset;
    group = favOnly ? '' : b.dataset.g;
    draw();
  });

  $('#tvQ').addEventListener('input', (e) => { query = e.target.value; draw(); });

  sel.value = store.get('tvCountry') || 'pe';
  sel.addEventListener('change', () => { store.set('tvCountry', sel.value); loaded = true; loadCountry(sel.value); });

  // ======================================================================
  // 8) CONEXIÓN CON PICTUREREEL
  // ======================================================================
  let loaded = false;

  // Al entrar a la sección: carga la lista la primera vez; después solo reanuda la verificación
  function open() {
    if (!loaded) { loaded = true; loadCountry(sel.value); return; }
    draw();
    verify(channels);
  }

  // Al salir: pausa el video (salvo imagen en imagen) y detiene las comprobaciones
  function leave() {
    vTok++;
    saveStatus();
    if (!document.pictureInPictureElement && !video.paused) video.pause();
  }

  window.TV = { open, leave, parseM3U, check, pickLevel };
})();