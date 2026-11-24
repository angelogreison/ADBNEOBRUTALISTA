/* Artesana del Barro · site.js (v6, desde cero). Sin dependencias. */
(function () {
  'use strict';
  var WA = '5491156206435';
  /* ===== Conexión con Google Sheets (opcional) =====
     SHEET_CSV_URL: link de "Publicar en la web" (formato CSV) de la hoja de horarios y precios.
     LEADS_URL: URL de la aplicación web de Apps Script que guarda las reservas en otra hoja.
     Si están vacíos, el sitio usa los datos de respaldo que están más abajo. */
  var SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQz9QfkstOZ6xhcdiya3aPfIrEIdEe9d83PiPVfDwymuaXIUalYUVMlnJsLVFdhPtI7i2kqWoUWtFE6/pub?gid=0&single=true&output=csv';   /* hoja de cupos publicada: pisa los turnos de horarios.csv */
  var LEADS_URL = '';
  var HORARIOS_URL = '/ABD-PRUEBA-NOV26/assets/horarios.csv';   /* archivo que se edita a mano para actualizar turnos y precios */
  var header = document.getElementById('site-header');
  function money(n) { return '$' + Math.round(n).toLocaleString('es-AR'); }

  /* Alto disponible para los paneles que cuelgan de la cabecera (menú y buscador) */
  function setAvail() {
    if (!header) return;
    var b = header.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--avail', Math.max(240, window.innerHeight - b) + 'px');
  }
  window.addEventListener('resize', setAvail, { passive: true });

  /* ---------- Menú móvil ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  var searchBtn = document.getElementById('search-btn');
  var searchPanel = document.getElementById('search');
  function setSearch(open) {
    if (!searchBtn || !searchPanel) return;
    if (open) setMenu(false);
    searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    searchPanel.hidden = !open;
    if (open) { setAvail(); loadIndex(); setTimeout(function () { document.getElementById('search-q').focus(); }, 30); }
  }
  function setMenu(open) {
    if (!burger || !menu) return;
    if (open) { setSearch(false); setAvail(); }
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.hidden = !open;
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    window.matchMedia('(min-width:1024px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setMenu(false); if (searchPanel && !searchPanel.hidden) { setSearch(false); searchBtn.focus(); } }
  });

  /* ---------- Video del hero: solo en pantallas anchas y sin ahorro de datos ---------- */
  var vid = document.getElementById('heroVideo');
  if (vid) {
    var conn = navigator.connection || {};
    var ok = window.matchMedia('(min-width:768px)').matches &&
      !window.matchMedia('(prefers-reduced-motion:reduce)').matches && !conn.saveData;
    if (ok) {
      var go = function () {
        vid.muted = true; vid.defaultMuted = true; vid.loop = true; vid.playsInline = true;
        vid.src = vid.getAttribute('data-src');
        var start = function () { var p = vid.play(); if (p && p.catch) p.catch(retry); };
        /* si el navegador bloquea la reproducción automática, se reintenta con el primer gesto de la persona */
        var retry = function () {
          var once = function () { ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, once, true); }); start(); };
          ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, once, { capture: true, passive: true }); });
        };
        vid.addEventListener('canplay', start, { once: true });
        start();
      };
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    }
  }

  /* ---------- Turnos con cupo ---------- */
  /* Mantener sincronizado con la grilla de /servicios/planes-y-horarios/ (solo turnos con cupo). */
  var PRICES = { Modelado: 82000, Alfarería: 93500 };
  var SLOTS = [
    { d: 'Lunes', s: '14:00', e: '16:00', c: 'Modelado', n: 'Disponible' },
    { d: 'Lunes', s: '16:00', e: '18:00', c: 'Alfarería', n: 'Disponible' },
    { d: 'Lunes', s: '18:30', e: '20:30', c: 'Modelado', n: 'Último cupo' },
    { d: 'Lunes', s: '18:30', e: '20:30', c: 'Alfarería (con experiencia previa)', n: 'Pocos cupos' },
    { d: 'Martes', s: '18:30', e: '20:30', c: 'Modelado', n: 'Último cupo' },
    { d: 'Martes', s: '18:30', e: '20:30', c: 'Alfarería', n: 'Pocos cupos' },
    { d: 'Miércoles', s: '16:00', e: '18:00', c: 'Modelado', n: 'Disponible' },
    { d: 'Miércoles', s: '18:00', e: '20:00', c: 'Modelado', n: 'Disponible' },
    { d: 'Jueves', s: '15:30', e: '17:30', c: 'Modelado', n: 'Último cupo' },
    { d: 'Jueves', s: '18:00', e: '20:00', c: 'Modelado', n: 'Último cupo' },
    { d: 'Viernes', s: '14:00', e: '16:00', c: 'Alfarería', n: 'Disponible' },
    { d: 'Viernes', s: '18:30', e: '20:30', c: 'Modelado', n: 'Último cupo' },
    { d: 'Sábado', s: '14:00', e: '16:00', c: 'Modelado', n: 'Pocos cupos' }
  ];
  /* Turnos completos: no se pueden reservar, pero se muestran en rojo en la grilla de horarios */
  var FULL = [
    { d: 'Martes', s: '10:30', e: '12:30', c: 'Alfarería', n: 'Sin cupos' },
    { d: 'Sábado', s: '11:00', e: '13:00', c: 'Modelado', n: 'Sin cupos' }
  ];
  var DAY_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var onData = [];   /* funciones a llamar cuando llegan datos nuevos de la hoja */

  function csvRows(text) {
    var rows = [], row = [], cur = '', q = false;
    for (var k = 0; k < text.length; k++) {
      var ch = text[k];
      if (q) { if (ch === '"') { if (text[k + 1] === '"') { cur += '"'; k++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function plain(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
  /* La hoja de cupos de Mariana viene como: "Lunes 18:30 - 20:30 MODELADO - NOMBRE", máx., inscriptas, disponibilidad.
     Se convierte al formato interno (dia, inicio, fin, clase, nota, estado). El nombre de la profe NO se usa ni se muestra. */
  function cuposToRows(rows) {
    var out = [['dia', 'inicio', 'fin', 'clase', 'nota', 'estado']];
    var dispIdx = rows[0].map(plain).indexOf('disponibilidad');
    var DIAS = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', sabados: 'Sábado' };
    function hhmm(h, m) { return (h.length < 2 ? '0' + h : h) + ':' + (m || '00'); }
    rows.slice(1).forEach(function (r) {
      var txt = String(r[0] || '');
      var dia = DIAS[plain(txt.split(/\s+/)[0])];
      var t = txt.match(/(\d{1,2})(?::(\d{2}))?\s*(?:hs)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(?:hs)?/i);
      var n = parseInt(String(r[dispIdx] || '').replace(/\D/g, ''), 10);
      if (!dia || !t || isNaN(n)) return;
      var resto = plain(txt.slice(txt.indexOf(t[0]) + t[0].length));
      var clase = /alfar|torno/.test(resto) ? 'Alfarería' : 'Modelado';
      var nota = /experiencia previa/.test(resto) ? 'con experiencia previa' : '';
      var estado = n <= 0 ? 'Sin cupos' : n === 1 ? 'Último cupo' : n === 2 ? 'Pocos cupos' : 'Disponible';
      out.push([dia, hhmm(t[1], t[2]), hhmm(t[3], t[4]), clase, nota, estado]);
    });
    return out;
  }  function applySheet(text) {
    var rows = csvRows(text.replace(/^\uFEFF/, '')); if (rows.length < 2) return false;
    if (rows[0].map(plain).indexOf('disponibilidad') > -1) rows = cuposToRows(rows);
    if (rows.length < 2) return false;
    var head = rows[0].map(plain), col = function (n) { return head.indexOf(n); };
    var iD = col('dia'), iS = col('inicio'), iE = col('fin'), iC = col('clase'), iN = col('nota'), iT = col('estado');
    if (iD < 0 || iS < 0 || iC < 0 || iT < 0) return false;
    var slots = [], full = [], prices = {};
    rows.slice(1).forEach(function (r) {
      var dia = (r[iD] || '').trim(), clase = (r[iC] || '').trim(), est = (r[iT] || '').trim();
      if (!dia) return;
      var kind = /torno|alfar/i.test(clase) ? 'Alfarería' : 'Modelado';
      if (plain(dia) === 'precio') { var n = parseInt(est.replace(/\D/g, ''), 10); if (n > 0) prices[kind] = n; return; }
      var e = plain(est); if (!e) return;
      if (/sin cupo|completo|lleno|agotado/.test(e)) { var dF = DAY_ORDER.filter(function (d) { return plain(d) === plain(dia); })[0]; if (dF) full.push({ d: dF, s: (r[iS] || '').trim(), e: iE > -1 ? (r[iE] || '').trim() : '', c: kind + ((iN > -1 && (r[iN] || '').trim()) ? ' (' + (r[iN] || '').trim() + ')' : ''), n: 'Sin cupos' }); return; }
      var label = /ultimo/.test(e) ? 'Último cupo' : /poco/.test(e) ? 'Pocos cupos' : 'Disponible';
      var nota = iN > -1 ? (r[iN] || '').trim() : '';
      var diaOk = DAY_ORDER.filter(function (d) { return plain(d) === plain(dia); })[0];
      if (!diaOk) return;
      slots.push({ d: diaOk, s: (r[iS] || '').trim(), e: iE > -1 ? (r[iE] || '').trim() : '', c: kind + (nota ? ' (' + nota + ')' : ''), n: label });
    });
    if (!slots.length) return false;
    slots.sort(function (a, b) { return DAY_ORDER.indexOf(a.d) - DAY_ORDER.indexOf(b.d) || a.s.localeCompare(b.s); });
    SLOTS = slots; FULL = full;
    if (prices.Modelado) PRICES.Modelado = prices.Modelado;
    if (prices.Alfarería) PRICES.Alfarería = prices.Alfarería;
    return true;
  }
  function fetchText(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error(r.status); return r.text(); });
  }
  function loadSheet() {
    if (!window.fetch) return;
    var notify = function () { onData.forEach(function (fn) { fn(); }); };
    /* 1) horarios.csv (en el sitio): precios y turnos de respaldo. 2) hoja de cupos publicada: pisa los turnos. */
    var base = HORARIOS_URL ? fetchText(HORARIOS_URL, 5000).then(function (t) { if (applySheet(t)) notify(); }).catch(function () {}) : Promise.resolve();
    base.then(function () {
      if (!SHEET_CSV_URL) return;
      return fetchText(SHEET_CSV_URL, 6000).then(function (t) { if (applySheet(t)) notify(); }).catch(function () { /* si falla, quedan los de horarios.csv */ });
    });
  }  function planOf(x) { return /^Alfarería/.test(x.c) ? 'Alfarería' : 'Modelado'; }

  /* ---------- Barra dinámica: mensajes rotativos con pausa ---------- */
  var msgEl = document.getElementById('infomsg');
  if (msgEl) {
    var list = [];
    var buildList = function () {
      list.length = 0;
      var last = SLOTS.filter(function (x) { return x.n === 'Último cupo'; });
      if (last.length) list.push({ t: 'Últimos cupos: ' + last.map(function (x) { return x.d.slice(0, 3) + ' ' + x.s + ' (' + x.c.split(' ')[0].toLowerCase() + ')'; }).join(', '), h: '/ABD-PRUEBA-NOV26/#inscripcion' });
      var free = SLOTS.filter(function (x) { return x.n === 'Disponible'; });
      if (free.length) list.push({ t: 'Con lugar: ' + free.map(function (x) { return x.d.slice(0, 3) + ' ' + x.s; }).join(', '), h: '/ABD-PRUEBA-NOV26/#inscripcion' });
      list.push({ t: 'Clase de prueba: modelado $28.000 o alfarería $40.000', h: '/ABD-PRUEBA-NOV26/servicios/clase-de-prueba/' });
      list.push({ t: 'Horneado de piezas para ceramistas en horno de 70 litros', h: '/ABD-PRUEBA-NOV26/servicios/horneado-de-piezas/' });
    };
    buildList();
    var i = 0, timer = null;
    var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var movil = window.matchMedia('(max-width:819px)');
    var show = function (k) {
      var a = msgEl.querySelector('a'); if (!a) return; i = (k + list.length) % list.length;
      msgEl.style.opacity = 0;
      setTimeout(function () { a.textContent = list[i].t; a.setAttribute('href', list[i].h); msgEl.style.opacity = 1; }, 220);
    };
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
    var start = function () { stop(); if (movil.matches || reduce) return; timer = setInterval(function () { show(i + 1); }, 5000); };
    /* Celular: todos los mensajes en una cinta que se desliza despacio (si la persona pidió menos movimiento, queda el primero fijo) */
    var armarCinta = function () {
      msgEl.classList.add('ticker'); msgEl.style.opacity = 1;
      if (reduce) { msgEl.classList.add('fijo'); msgEl.innerHTML = '<a href="' + list[0].h + '">' + escHtml(list[0].t) + '</a>'; return; }
      var items = list.map(function (m) { return '<a href="' + m.h + '">' + escHtml(m.t) + '</a>'; }).join('<span class="sep" aria-hidden="true">•</span>');
      var copia = items.replace(/<a /g, '<a tabindex="-1" ');
      msgEl.innerHTML = '<span class="ticker-track"><span class="ticker-set">' + items + '<span class="sep" aria-hidden="true">•</span></span>' +
        '<span class="ticker-set" aria-hidden="true">' + copia + '<span class="sep">•</span></span></span>';
      var track = msgEl.querySelector('.ticker-track'), set = msgEl.querySelector('.ticker-set');
      var ancho = set.getBoundingClientRect().width;
      if (ancho) track.style.animationDuration = Math.max(25, Math.round(ancho / 32)) + 's';   /* unos 32 px por segundo */
    };
    var armarRotativa = function () {
      msgEl.classList.remove('ticker', 'fijo');
      msgEl.innerHTML = '<a href="' + list[i % list.length].h + '">' + escHtml(list[i % list.length].t) + '</a>';
    };
    var aplicar = function () { if (movil.matches) { stop(); armarCinta(); } else { armarRotativa(); start(); } };
    aplicar();
    onData.push(function () { buildList(); aplicar(); });
    if (movil.addEventListener) movil.addEventListener('change', aplicar);
    msgEl.addEventListener('mouseenter', stop);
    msgEl.addEventListener('mouseleave', start);
    msgEl.addEventListener('focusin', stop);
    msgEl.addEventListener('focusout', start);
  }
  /* ---------- Envío de una reserva (hero y mini formulario de horarios) ---------- */
  function sendReservation(x, v, src) {
    var plan = planOf(x), p = PRICES[plan];
    var msg = '¡Hola Mariana! Quiero reservar un lugar en el taller:\n\n' +
      'Nombre: ' + v.nombre + '\n' +
      'Email: ' + v.email + '\n' +
      'WhatsApp: ' + v.whatsapp + '\n' +
      'Día: ' + x.d + '\n' +
      'Horario: ' + x.s + ' a ' + x.e + 'hs (' + x.c + ')\n' +
      'Plan: Plan ' + plan + ' (' + money(p) + ' por mes)\n' +
      'Seña (50%): ' + money(p / 2);
    if (window.fbq) { try { window.fbq('track', 'Lead'); } catch (_) {} }
    if (window.gtag) { try { window.gtag('event', 'generate_lead', { method: src }); } catch (_) {} }
    if (LEADS_URL && !v.web && window.fetch) {
      try {
        fetch(LEADS_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ nombre: v.nombre, email: v.email, whatsapp: v.whatsapp,
            dia: x.d, horario: x.s + ' a ' + x.e, clase: x.c, plan: 'Plan ' + plan, precio: p, sena: p / 2, pagina: location.pathname, origen: src }) }).catch(function () {});
      } catch (_) {}
    }
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  }
  /* ---------- Formulario de reserva ---------- */
  var form = document.getElementById('enroll');
  if (form) {
    var dia = form.elements.dia, hor = form.elements.horario;
    var err = document.getElementById('enroll-err'), box = document.getElementById('enroll-price');
    function buildDays() {
      var prev = dia.value, days = [];
      SLOTS.forEach(function (x) { if (days.indexOf(x.d) < 0) days.push(x.d); });
      dia.length = 1;
      days.forEach(function (d) { dia.add(new Option(d, d)); });
      if (days.indexOf(prev) > -1) dia.value = prev;
      fillHours();
    }
    buildDays(); onData.push(buildDays);
    function showPrice() {
      if (hor.value === '') { box.hidden = true; box.innerHTML = ''; return; }
      var x = SLOTS[+hor.value], plan = planOf(x), p = PRICES[plan], sena = p / 2;
      box.innerHTML = '<div class="main"><span><strong>Plan ' + plan + '</strong> (por mes)</span><b>' + money(p) + '</b></div>' +
        'Seña para reservar (50%): <strong>' + money(sena) + '</strong><br>El resto (' + money(sena) + ') lo abonás en tu primera clase.';
      box.hidden = false;
    }
    function fillHours() {
      hor.length = 1;
      var list = SLOTS.filter(function (x) { return x.d === dia.value; });
      list.forEach(function (x) {
        hor.add(new Option(x.s + ' a ' + x.e + ' · ' + x.c + ' (' + x.n + ')', String(SLOTS.indexOf(x))));
      });
      hor.disabled = !list.length;
      hor.options[0].text = list.length ? 'Elegí un horario' : 'Elegí primero un día';
      showPrice();
    }
    dia.addEventListener('change', fillHours);
    hor.addEventListener('change', showPrice);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      if (!form.checkValidity() || !f.horario.value) {
        err.classList.add('on');
        (form.querySelector(':invalid') || f.horario).focus();
        return;
      }
      err.classList.remove('on');
      sendReservation(SLOTS[+f.horario.value], { nombre: f.nombre.value.trim(), email: f.email.value.trim(), whatsapp: f.whatsapp.value.trim(), web: '' }, 'form_hero');
    });
  }

  /* ---------- Buscador del sitio ---------- */
  var INDEX = null, loading = false, lastQ = '';
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function loadIndex() {
    if (INDEX || loading) return; loading = true;
    fetch('/ABD-PRUEBA-NOV26/assets/search-index.json').then(function (r) { return r.json(); }).then(function (j) {
      INDEX = j.map(function (p) { return { p: p, t: norm(p.t), d: norm(p.d), h: norm(p.h), k: norm(p.k), u: norm(p.u) }; });
      var q = document.getElementById('search-q'); if (q && q.value) run(q.value);
    }).catch(function () { loading = false; });
  }
  function run(raw) {
    var out = document.getElementById('search-results'), st = document.getElementById('search-status'), sug = document.getElementById('search-suggest');
    var q = norm(raw).trim(); out.innerHTML = '';
    if (!q) { sug.hidden = false; st.textContent = ''; return; }
    sug.hidden = true;
    if (window.gtag && q.length > 2 && q !== lastQ) { lastQ = q; try { window.gtag('event', 'search', { search_term: q }); } catch (_) {} }
    if (!INDEX) { st.textContent = 'Buscando…'; return; }
    var toks = q.split(/\s+/).filter(function (t) { return t.length > 1; });
    var res = INDEX.map(function (it) {
      var sc = 0, all = true;
      toks.forEach(function (t) {
        var s = (it.t.indexOf(t) > -1 ? 6 : 0) + (it.k.indexOf(t) > -1 ? 8 : 0) + (it.h.indexOf(t) > -1 ? 2 : 0) + (it.d.indexOf(t) > -1 ? 1 : 0) + (it.u.indexOf(t) > -1 ? 1 : 0);
        if (!s) all = false; sc += s;
      });
      return { it: it, sc: all ? sc : 0 };
    }).filter(function (r) { return r.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 6);
    if (!res.length) {
      out.innerHTML = '<li class="none">No encontramos resultados para “' + raw.replace(/[<>&"]/g, '') + '”. Probá con otra palabra o <a href="https://wa.me/' + WA + '" target="_blank" rel="noopener noreferrer"><u>escribinos por WhatsApp</u></a>.</li>';
      st.textContent = 'Sin resultados'; return;
    }
    res.forEach(function (r) {
      var li = document.createElement('li'), a = document.createElement('a'), s = document.createElement('strong'), d = document.createElement('span');
      a.href = r.it.p.u; s.textContent = r.it.p.t; d.textContent = r.it.p.d; a.appendChild(s); a.appendChild(d); li.appendChild(a); out.appendChild(li);
    });
    st.textContent = res.length + (res.length === 1 ? ' resultado' : ' resultados');
  }
  if (searchBtn && searchPanel) {
    searchBtn.addEventListener('click', function () { setSearch(searchPanel.hidden); });
    var sq = document.getElementById('search-q'), tm;
    sq.addEventListener('input', function () { clearTimeout(tm); tm = setTimeout(function () { run(sq.value); }, 120); });
    document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); run(sq.value); var a = document.querySelector('#search-results a'); if (a) a.focus(); });
    document.getElementById('search-suggest').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]'); if (!b) return; sq.value = b.getAttribute('data-q'); run(sq.value); sq.focus();
    });
    searchPanel.addEventListener('click', function (e) { if (e.target.closest('#search-results a')) setSearch(false); });
  }

  loadSheet();

  /* ---------- Reseñas de Google (Elfsight) cargadas al acercarse ---------- */
  var rev = document.getElementById('reviews-widget');
  function loadReviews() {
    if (document.getElementById('elf-js')) return;
    var s = document.createElement('script');
    s.id = 'elf-js'; s.src = 'https://elfsightcdn.com/platform.js'; s.async = true;
    document.head.appendChild(s);
  }
  if (rev) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { loadReviews(); io.disconnect(); }
      }, { rootMargin: '500px' });
      io.observe(rev);
    } else { loadReviews(); }
  }

  /* ---------- Google Analytics 4: tras la primera interacción o a los 4 s ---------- */
  var gaDone = false;
  function loadGA() { return;
    if (gaDone) return; gaDone = true;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=G-9HD0M84T4R';
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', 'G-9HD0M84T4R');
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, loadGA, { once: true, passive: true });
  });
  setTimeout(loadGA, 4000);

  /* ---------- Planes y horarios: precios [data-price] / [data-sena] y grilla #horarios-grid ---------- */
  var slotGrid = document.getElementById('horarios-grid');
  var priceNodes = document.querySelectorAll('[data-price],[data-sena]');
  function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function paintPrices() {
    Array.prototype.forEach.call(priceNodes, function (el) {
      var k = el.getAttribute('data-price'), h = el.getAttribute('data-sena');
      if (k && PRICES[k]) el.textContent = money(PRICES[k]).slice(1);
      else if (h && PRICES[h]) el.textContent = money(PRICES[h] / 2).slice(1);
    });
  }
  var shown = [];
  function paintSlots() {
    if (!slotGrid || !SLOTS.length) return;
    var list = SLOTS.concat(FULL).map(function (x, n) { return { x: x, n: n }; }).sort(function (a, b) {
      return DAY_ORDER.indexOf(a.x.d) - DAY_ORDER.indexOf(b.x.d) || a.x.s.localeCompare(b.x.s) || a.n - b.n;
    }).map(function (o) { return o.x; });
    var html = '', day = '';
    shown = list;
    list.forEach(function (x) {
      if (x.d !== day) { day = x.d; html += '<h3 class="slot-day">' + escHtml(day) + '</h3>'; }
      var cls = x.n === 'Sin cupos' ? ' full' : x.n === 'Último cupo' ? ' last' : x.n === 'Pocos cupos' ? ' few' : '';
      var when = x.s + (x.e ? ' a ' + x.e : '');
      html += '<div class="slot' + cls + '"><span><strong>' + escHtml(when) + '</strong> · ' + escHtml(x.c) + '</span>' +
        '<span class="st">' + escHtml(x.n) + '</span>' +
        (x.n === 'Sin cupos' ? '' : '<button type="button" class="btn line" data-book="' + shown.indexOf(x) + '" aria-label="Reservar ' + escHtml(day + ' ' + when + ', ' + x.c) + '">Reservar</button>') + '</div>';
    });
    slotGrid.innerHTML = html;
  }

  /* ---------- Barra dinámica bajo el hero: solo disponibilidad actual por día y horario ---------- */
  var availTrack = document.getElementById('avail-track');
  function paintAvail() {
    if (!availTrack) return;
    var all = SLOTS.concat(FULL).map(function (x, n) { return { x: x, n: n }; }).sort(function (a, b) {
      return DAY_ORDER.indexOf(a.x.d) - DAY_ORDER.indexOf(b.x.d) || a.x.s.localeCompare(b.x.s) || a.n - b.n;
    }).map(function (o) { return o.x; });
    if (!all.length) return;
    var set = all.map(function (x) {
      var cls = x.n === 'Sin cupos' ? ' full' : '';
      var when = x.d + ' ' + x.s + (x.e ? ' a ' + x.e : '');
      var col = { 'Disponible': '#22C55E', 'Pocos cupos': '#FACC15', 'Último cupo': '#F97316', 'Sin cupos': '#EF4444' }[x.n] || '#FFFFFF';
      return '<span class="marquee-item' + cls + '"><i class="av-dot" style="background:' + col + '" aria-hidden="true"></i>' + escHtml(when) + ' · ' + escHtml(x.c) + ': ' + escHtml(x.n) + '</span>' +
        '<span class="marquee-sep" aria-hidden="true">★</span>';
    }).join('');
    /* dos copias seguidas: la animación recorre una y vuelve a empezar sin corte */
    availTrack.innerHTML = set + set;
    var ancho = availTrack.scrollWidth / 2;
    if (ancho) availTrack.style.animationDuration = Math.max(20, Math.round(ancho / 40)) + 's';
  }
  paintAvail();
  onData.push(paintAvail);

  /* ---------- Mini formulario de reserva desde la grilla de horarios ---------- */
  var bookDlg = null, bookSlot = null;
  function buildBook() {
    bookDlg = document.createElement('dialog');
    bookDlg.className = 'book';
    bookDlg.setAttribute('aria-labelledby', 'book-t');
    bookDlg.innerHTML =
      '<div class="enroll book-card">' +
      '<button type="button" class="book-x" aria-label="Cerrar">×</button>' +
      '<h2 id="book-t">Reservá este turno</h2>' +
      '<p class="book-slot" id="book-slot"></p>' +
      '<div class="price-box" id="book-price" aria-live="polite"></div>' +
      '<form id="book-form" novalidate>' +
      '<div class="field"><label for="b-nombre">Nombre y apellido</label><input id="b-nombre" name="nombre" type="text" autocomplete="name" required></div>' +
      '<div class="field"><label for="b-email">Email</label><input id="b-email" name="email" type="email" autocomplete="email" inputmode="email" required></div>' +
      '<div class="field"><label for="b-wa">WhatsApp</label><input id="b-wa" name="whatsapp" type="tel" autocomplete="tel" inputmode="tel" placeholder="+54 9 11 …" required></div>' +
      '<p class="err" id="book-err" role="alert">Completá todos los datos para reservar.</p>' +
      '<button class="btn send block" type="submit">Reservar por WhatsApp</button>' +
      '<p class="fine">Se abre WhatsApp con tus datos y este turno ya elegido, para que Mariana te confirme el lugar.</p>' +
      '</form></div>';
    document.body.appendChild(bookDlg);
    bookDlg.querySelector('.book-x').addEventListener('click', function () { bookDlg.close(); });
    bookDlg.addEventListener('click', function (e) { if (e.target === bookDlg) bookDlg.close(); });
    bookDlg.querySelector('#book-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var fm = e.target, f = fm.elements, er = bookDlg.querySelector('#book-err');
      if (!fm.checkValidity()) { er.classList.add('on'); (fm.querySelector(':invalid') || f.nombre).focus(); return; }
      er.classList.remove('on');
      sendReservation(bookSlot, { nombre: f.nombre.value.trim(), email: f.email.value.trim(), whatsapp: f.whatsapp.value.trim(), web: '' }, 'form_horarios');
      bookDlg.close();
    });
  }
  function openBook(x) {
    if (!window.HTMLDialogElement) { window.location.href = '/ABD-PRUEBA-NOV26/#inscripcion'; return; }
    if (!bookDlg) buildBook();
    bookSlot = x;
    var plan = planOf(x), p = PRICES[plan];
    bookDlg.querySelector('#book-slot').innerHTML = '<strong>' + escHtml(x.d) + '</strong> · ' + escHtml(x.s + ' a ' + x.e) + ' · ' + escHtml(x.c);
    bookDlg.querySelector('#book-price').innerHTML = '<div class="main"><span><strong>Plan ' + plan + '</strong> (por mes)</span><b>' + money(p) + '</b></div>' +
      'Seña para reservar (50%): <strong>' + money(p / 2) + '</strong><br>El resto (' + money(p / 2) + ') lo abonás en tu primera clase.';
    bookDlg.querySelector('#book-err').classList.remove('on');
    bookDlg.showModal();
    bookDlg.querySelector('#b-nombre').focus();
  }
  if (slotGrid) {
    slotGrid.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-book]') : null;
      if (btn && shown[+btn.getAttribute('data-book')]) openBook(shown[+btn.getAttribute('data-book')]);
    });
  }
  if (slotGrid || priceNodes.length) {
    paintPrices(); paintSlots();
    onData.push(paintPrices, paintSlots);
  }
(function(){var bar=document.querySelector('.sticky-cta');if(!bar)return;function sync(){bar.classList.toggle('visible',window.scrollY>400);}window.addEventListener('scroll',sync,{passive:true});sync();})();
})();