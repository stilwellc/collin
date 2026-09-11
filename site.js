// ── theme (explicit toggle persists; otherwise system) ─────────────────────
(function () {
  var root = document.documentElement;
  function current() { var t = root.getAttribute('data-theme'); if (t) return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function set(t) { root.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (e) {} }
  window.__toggleTheme = function () { set(current() === 'dark' ? 'light' : 'dark'); };
  var b = document.getElementById('theme'); if (b) b.addEventListener('click', window.__toggleTheme);
})();

// ── the matrix: picture → text, in cells ────────────────────────────────────
// One engine for every header. A cell grid over the canvas. Phase 1 (if a
// picture is given): the picture, sampled per cell as squares sized by
// luminance — a halftone. Phase 2: the squares dissolve into random hex.
// Phase 3: cells inside the text's letterform resolve left→right into solid
// squares; the rest fall back to a faint dot field. Hover un-resolves cells
// near the cursor; click replays from the picture. Reduced motion: text only.
function matrix(c, opts) {
  var ctx = c.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEX = '0123456789abcdef';
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W, H, cols, rows, cell, mask, chars, heat, lum, t0, mx = -1e4, my = -1e4, img = null, word = opts.text, raf = 0;
  var PIC = 1.6, DISSOLVE = 0.7, RESOLVE = 1.8;                 // seconds per phase
  function ink() { return getComputedStyle(document.body).color; }
  function build() {
    var r = c.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 640 ? 10 : 13;
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    var m = document.createElement('canvas'); m.width = cols; m.height = rows;
    var mc = m.getContext('2d');
    mc.fillStyle = '#000'; mc.textBaseline = 'middle'; mc.textAlign = 'left';
    var fs = rows * 0.92;
    mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif';
    while (mc.measureText(word).width > cols * 0.96 && fs > 8) { fs -= 1; mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif'; }
    mc.fillText(word, cols * 0.02, rows * 0.54);
    var px = mc.getImageData(0, 0, cols, rows).data;
    mask = new Uint8Array(cols * rows); chars = new Array(cols * rows); heat = new Float32Array(cols * rows); lum = null;
    for (var i = 0; i < cols * rows; i++) { mask[i] = px[i * 4 + 3] > 96 ? 1 : 0; chars[i] = HEX[(Math.random() * 16) | 0]; }
    if (img) {
      // cover-fit the picture into the grid, then per-cell luminance
      var p = document.createElement('canvas'); p.width = cols; p.height = rows;
      var pc = p.getContext('2d');
      // contain-fit, anchored left like the text that replaces it
      var s = Math.min(cols * 0.96 / img.naturalWidth, rows / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      pc.drawImage(img, cols * 0.02, (rows - dh) / 2, dw, dh);
      var d = pc.getImageData(0, 0, cols, rows).data; lum = new Float32Array(cols * rows);
      // halftone the FIGURE, not the ground: if the picture is mostly light,
      // draw its dark pixels (a wordmark on paper reads as the wordmark);
      // then stretch to the 5th–95th percentile and push midtones down so the
      // result is a picture made of squares, not a slab.
      var raw = new Float32Array(cols * rows), mean = 0;
      for (var j = 0; j < cols * rows; j++) { raw[j] = (d[j*4]*299 + d[j*4+1]*587 + d[j*4+2]*114) / 255000; mean += raw[j]; }
      mean /= cols * rows; var flip = mean > 0.5;
      var sorted = Array.prototype.slice.call(raw).sort(function (a, b) { return a - b; });
      var lo = sorted[Math.floor(sorted.length * 0.05)], hi = sorted[Math.floor(sorted.length * 0.95)], span = Math.max(0.05, hi - lo);
      for (var k = 0; k < cols * rows; k++) { var v = flip ? 1 - raw[k] : raw[k]; v = (v - (flip ? 1 - hi : lo)) / span; v = Math.min(1, Math.max(0, v)); lum[k] = Math.pow(v, 1.7); }
    }
    t0 = performance.now();
  }
  function frame(now) {
    var el = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var col = ink();
    ctx.font = '400 ' + (cell * 0.78) + 'px "Geist Mono", Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    var hasPic = !!lum && !reduce;
    var tPic = hasPic ? PIC : 0, tDis = hasPic ? DISSOLVE : 0;
    var wave = reduce ? 1e9 : (el - tPic - tDis - 0.2) / RESOLVE;   // 0..1 across columns
    var picMix = hasPic ? (el < tPic ? 1 : Math.max(0, 1 - (el - tPic) / tDis)) : 0;   // 1 = picture, 0 = gone
    var R = cell * 4.2, R2 = R * R, flicker = ((now / 60) | 0) % 2 === 0;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var i = y * cols + x, cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      ctx.fillStyle = col;
      if (picMix > 0) {
        var q = cell * 0.86 * lum[i] * picMix;
        if (q > 0.6) { ctx.globalAlpha = 0.9; ctx.fillRect(cx - q / 2, cy - q / 2, q, q); }
        if (picMix < 1 && flicker && Math.random() < 0.3 * (1 - picMix)) { ctx.globalAlpha = 0.3; ctx.fillText(HEX[(Math.random() * 16) | 0], cx, cy); }
        continue;
      }
      if (mask[i]) {
        var dx = cx - mx, dy = cy - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) heat[i] = Math.max(heat[i], 1 - d2 / R2);
        var resolved = wave >= x / cols && heat[i] < 0.08;
        if (heat[i] > 0) heat[i] -= reduce ? 1 : 0.035;
        if (!resolved && flicker) chars[i] = HEX[(Math.random() * 16) | 0];
        if (resolved) { ctx.globalAlpha = 0.92; var s = cell * 0.62; ctx.fillRect(cx - s / 2, cy - s / 2, s, s); }
        else { ctx.globalAlpha = 0.34; ctx.fillText(chars[i], cx, cy); }
      } else { ctx.globalAlpha = 0.16; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1); }
    }
    ctx.globalAlpha = 1;
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  function play() { build(); cancelAnimationFrame(raf); if (reduce) frame(performance.now()); else raf = requestAnimationFrame(frame); }
  function setWord(w) { word = w; play(); }
  c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  c.addEventListener('pointerleave', function () { mx = my = -1e4; });
  c.addEventListener('click', function () { play(); });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(play, 120); });
  function start() {
    if (opts.src) { img = new Image(); img.onload = play; img.onerror = function () { img = null; play(); }; img.src = opts.src; }
    else play();
  }
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('300 40px Geist'), document.fonts.load('400 12px "Geist Mono"')]).then(start, start); else start();
  return { setWord: setWord, replay: play, get word() { return word; } };
}

// headers on landers + case studies
[].forEach.call(document.querySelectorAll('canvas.matrix'), function (c) { matrix(c, { text: c.dataset.text || '', src: c.dataset.src || null }); });

// the home field: same engine, plus the word cycle and type-to-rewrite
(function () {
  var c = document.getElementById('field');
  if (!c) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WORDS = ['Collin', 'Stilwell', 'Security'], wi = 0, typed = '', cycle = null;
  var hint = document.getElementById('field-hint');
  var m = matrix(c, { text: WORDS[0] });
  function startCycle() { if (reduce || cycle) return; cycle = setInterval(function () { wi = (wi + 1) % WORDS.length; m.setWord(WORDS[wi]); }, 7000); }
  function stopCycle() { if (cycle) { clearInterval(cycle); cycle = null; } }
  startCycle();
  window.__fieldType = function (e) {
    if (e.key === 'Escape') { typed = ''; m.setWord(WORDS[wi]); startCycle(); if (hint) hint.textContent = 'hover to encrypt · type to rewrite'; return true; }
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); if (!typed) { m.setWord(WORDS[wi]); startCycle(); } else m.setWord(typed); return true; }
    if (e.key.length === 1 && /[a-zA-Z0-9 .&'-]/.test(e.key) && typed.length < 12) { stopCycle(); typed += e.key; m.setWord(typed); if (hint) hint.textContent = 'esc to reset'; return true; }
    return false;
  };
})();

// ── live: the page's own last commit, and lectr's live corpus ──────────────
(function () {
  var el = document.getElementById('commit');
  if (el) fetch('https://api.github.com/repos/stilwellc/collin/commits/main', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (!j || !j.sha) return; var ago = Math.round((Date.now() - new Date(j.commit.committer.date)) / 36e5);
      el.textContent = 'main @ ' + j.sha.slice(0, 7) + ' · ' + (ago < 1 ? 'just now' : ago < 48 ? ago + 'h ago' : Math.round(ago / 24) + 'd ago'); }).catch(function () {});
  var lots = document.getElementById('live-lots') || document.getElementById('cs-lots');
  if (!lots) return;
  fetch('https://lectr.bid/data/ray/meta.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    if (!m || !m.totalLots) return;
    var n = function (x) { return x.toLocaleString('en-US'); }, short = function (x) { return (x / 1e6).toFixed(2) + 'M'; };
    var ago = Math.round((Date.now() - new Date(m.lastCrawl)) / 36e5), when = ago < 1 ? 'under an hour ago' : ago < 48 ? ago + 'h ago' : Math.round(ago / 24) + 'd ago';
    var a = document.getElementById('live-lots'); if (a) { a.textContent = n(m.totalLots); document.getElementById('live-sold').textContent = n(m.totalSold); document.getElementById('live-when').textContent = when; var d = document.getElementById('live-dot'); if (d && ago < 36) d.classList.add('on'); }
    var b = document.getElementById('cs-lots'); if (b) { b.textContent = short(m.totalLots); document.getElementById('cs-sold').textContent = short(m.totalSold); document.getElementById('cs-when').textContent = 'crawled ' + when; }
  }).catch(function () {});
})();

// ── command palette + shortcuts ────────────────────────────────────────────
(function () {
  var pal = document.getElementById('pal'), inp = document.getElementById('pal-in'), list = document.getElementById('pal-list'), keys = document.getElementById('keys');
  if (!pal) return;
  var ITEMS = [
    { t: 'Home', h: 'g h', u: 'index.html' }, { t: 'Work', h: 'g w', u: 'work.html' }, { t: 'Security', h: 'g s', u: 'security.html' }, { t: 'Writing', h: 'g n', u: 'writing.html' }, { t: 'GitHub', h: 'g g', u: 'github.html' }, { t: 'About', h: 'g a', u: 'about.html' }, { t: 'Résumé', h: 'g r', u: 'resume.html' },
    { t: 'lectr — case study', h: 'g l', u: 'lectr.html' }, { t: 'SecMCPHub — case study', h: '', u: 'secmcphub.html' }, { t: 'Soirée — case study', h: '', u: 'soiree.html' },
    { t: 'Open lectr.bid', h: '↗', u: 'https://lectr.bid', x: 1 }, { t: 'Open Starling', h: '↗', u: 'https://starling-6s1.pages.dev', x: 1 }, { t: 'text2print (GitHub)', h: '↗', u: 'https://github.com/stilwellc/text2print', x: 1 }, { t: 'Open soiree.today', h: '↗', u: 'https://soiree.today', x: 1 },
    { t: 'Email hello@collin.dev', h: '', u: 'mailto:hello@collin.dev' }, { t: 'GitHub', h: '↗', u: 'https://github.com/stilwellc', x: 1 }, { t: 'LinkedIn', h: '↗', u: 'https://www.linkedin.com/in/collin-stilwell/', x: 1 }, { t: 'Substack', h: '↗', u: 'https://collinsthoughts.substack.com', x: 1 },
    { t: 'Toggle theme', h: 't', fn: function () { window.__toggleTheme && window.__toggleTheme(); } }, { t: 'Shortcuts', h: '?', fn: function () { openKeys(); } }
  ];
  var sel = 0, shown = ITEMS;
  function render() {
    var q = inp.value.trim().toLowerCase();
    shown = ITEMS.filter(function (i) { return !q || i.t.toLowerCase().indexOf(q) >= 0; });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map(function (i, k) { return '<li' + (k === sel ? ' class="on"' : '') + ' data-k="' + k + '"><span>' + i.t + '</span><span class="h">' + i.h + '</span></li>'; }).join('') || '<li><span class="h">nothing matches</span></li>';
  }
  function go(i) { if (!i) return; close(); if (i.fn) return i.fn(); if (i.x) window.open(i.u, '_blank', 'noopener'); else location.href = i.u; }
  function open() { closeKeys(); pal.hidden = false; inp.value = ''; sel = 0; render(); inp.focus(); }
  function close() { pal.hidden = true; inp.blur(); }
  function openKeys() { close(); keys.hidden = false; }
  function closeKeys() { keys.hidden = true; }
  inp.addEventListener('input', function () { sel = 0; render(); });
  list.addEventListener('click', function (e) { var li = e.target.closest('li[data-k]'); if (li) go(shown[+li.dataset.k]); });
  pal.addEventListener('click', function (e) { if (e.target === pal) close(); });
  keys.addEventListener('click', function (e) { if (e.target === keys) closeKeys(); });
  var btn = document.getElementById('palette-btn'); if (btn) btn.addEventListener('click', open);
  var pending = null, pt = 0;
  addEventListener('keydown', function (e) {
    var inField = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.hidden ? open() : close(); return; }
    if (!pal.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(shown[sel]); }
      return;
    }
    if (!keys.hidden) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeKeys(); } return; }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); open(); return; }
    if (e.key === '?') { e.preventDefault(); openKeys(); return; }
    if (e.key === 't') { window.__toggleTheme && window.__toggleTheme(); return; }
    var now = Date.now();
    if (pending === 'g' && now - pt < 900) { pending = null; var map = { h: 'index.html', w: 'work.html', s: 'security.html', n: 'writing.html', g: 'github.html', a: 'about.html', r: 'resume.html', l: 'lectr.html' }; if (map[e.key]) { e.preventDefault(); location.href = map[e.key]; return; } }
    if (e.key === 'g') { pending = 'g'; pt = now; return; }
    if (window.__fieldType && window.__fieldType(e)) e.preventDefault();
  });
})();

// ── GitHub, live ───────────────────────────────────────────────────────────
(function () {
  var cells = document.getElementById('gh-cells');
  if (!cells) return;
  var H = { Accept: 'application/vnd.github+json' };
  fetch('https://api.github.com/users/stilwellc', { headers: H }).then(function (r) { return r.ok ? r.json() : null; }).then(function (u) {
    if (!u) return;
    document.getElementById('gh-repos').textContent = u.public_repos;
    document.getElementById('gh-since').textContent = new Date(u.created_at).getFullYear();
    if (u.location) document.getElementById('gh-loc').textContent = u.location;
  }).catch(function () {});
  fetch('https://api.github.com/users/stilwellc/repos?per_page=100&sort=pushed', { headers: H }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rs) {
    if (!rs || !rs.length) return;
    var own = rs.filter(function (r) { return !r.fork && r.name !== 'stilwellc' && r.name !== 'collin'; }).slice(0, 8);
    cells.innerHTML = own.map(function (r) {
      return '<a class="cell" href="' + r.html_url + '" target="_blank" rel="noopener"><div class="top"><span class="pill mono">' + (r.language || 'repo') + '</span>' + (r.stargazers_count ? '<span class="pill mono">★ ' + r.stargazers_count + '</span>' : '') + '</div><h2>' + r.name + '<span class="arrow">↗</span></h2><p>' + (r.description || '') + '</p><div class="foot">pushed ' + r.pushed_at.slice(0, 10) + '</div></a>';
    }).join('');
  }).catch(function () {});
  fetch('https://api.github.com/users/stilwellc/events/public?per_page=100', { headers: H }).then(function (r) { return r.ok ? r.json() : null; }).then(function (ev) {
    if (!ev) return;
    var pushes = ev.filter(function (e) { return e.type === 'PushEvent'; });
    document.getElementById('gh-pushes').textContent = pushes.length;
    // 12 weeks × 7 days, newest column on the right
    var days = {}; pushes.forEach(function (e) { var d = e.created_at.slice(0, 10); days[d] = (days[d] || 0) + 1; });
    var grid = document.getElementById('gh-grid'), now = new Date(), out = '';
    for (var w = 11; w >= 0; w--) for (var d = 0; d < 7; d++) {
      var dt = new Date(now); dt.setDate(now.getDate() - (w * 7 + (6 - d)));
      var k = dt.toISOString().slice(0, 10), n = days[k] || 0;
      out += '<i class="' + (n >= 6 ? 'l3' : n >= 3 ? 'l2' : n >= 1 ? 'l1' : '') + '" title="' + k + ' · ' + n + ' push' + (n === 1 ? '' : 'es') + '"></i>';
    }
    grid.innerHTML = out;
  }).catch(function () {});
})();
