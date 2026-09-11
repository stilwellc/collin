// ── theme (explicit toggle persists; otherwise system) ─────────────────────
(function () {
  var root = document.documentElement;
  function current() { var t = root.getAttribute('data-theme'); if (t) return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function set(t) { root.setAttribute('data-theme', t); try { localStorage.setItem('theme', t); } catch (e) {} }
  window.__toggleTheme = function () { set(current() === 'dark' ? 'light' : 'dark'); };
  var b = document.getElementById('theme'); if (b) b.addEventListener('click', window.__toggleTheme);
})();

// ── the canvas: the name, decoded ──────────────────────────────────────────
// Cells inside the letterform start as random hex and resolve left→right into
// squares; cells outside stay a faint dot field. Hover un-resolves cells near
// the cursor (encrypt where you touch). Every 7s the word cycles. Type on the
// page and the letterform becomes what you typed. Reduced motion: final state.
(function () {
  var c = document.getElementById('field');
  if (!c) return;
  var ctx = c.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEX = '0123456789abcdef';
  var WORDS = ['Collin', 'Stilwell', 'Security'];
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W, H, cols, rows, cell, mask, chars, heat, t0, wi = 0, mx = -1e4, my = -1e4, typed = '', cycle = null;
  var hint = document.getElementById('field-hint');
  function ink() { return getComputedStyle(document.body).color; }
  function build(word) {
    var r = c.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 640 ? 11 : 14;
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    var m = document.createElement('canvas'); m.width = cols; m.height = rows;
    var mc = m.getContext('2d');
    mc.fillStyle = '#000'; mc.textBaseline = 'middle'; mc.textAlign = 'left';
    var fs = rows * 0.92;
    mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif';
    while (mc.measureText(word).width > cols * 0.96 && fs > 8) { fs -= 1; mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif'; }
    mc.fillText(word, cols * 0.02, rows * 0.54);
    var px = mc.getImageData(0, 0, cols, rows).data;
    mask = new Uint8Array(cols * rows); chars = new Array(cols * rows); heat = new Float32Array(cols * rows);
    for (var i = 0; i < cols * rows; i++) { mask[i] = px[i * 4 + 3] > 96 ? 1 : 0; chars[i] = HEX[(Math.random() * 16) | 0]; }
    t0 = performance.now();
  }
  function frame(now) {
    var el = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var col = ink();
    ctx.font = '400 ' + (cell * 0.78) + 'px "Geist Mono", Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    var wave = reduce ? 1e9 : (el - 0.3) / 1.8;
    var R = cell * 4.2, R2 = R * R, flicker = ((now / 60) | 0) % 2 === 0;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var i = y * cols + x, cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (mask[i]) {
        var dx = cx - mx, dy = cy - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) heat[i] = Math.max(heat[i], 1 - d2 / R2);
        var resolved = wave >= x / cols && heat[i] < 0.08;
        if (heat[i] > 0) heat[i] -= reduce ? 1 : 0.035;
        if (!resolved && flicker) chars[i] = HEX[(Math.random() * 16) | 0];
        ctx.fillStyle = col;
        if (resolved) { ctx.globalAlpha = 0.92; var q = cell * 0.62; ctx.fillRect(cx - q / 2, cy - q / 2, q, q); }
        else { ctx.globalAlpha = 0.34; ctx.fillText(chars[i], cx, cy); }
      } else { ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1); }
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }
  function show(word) { build(word); }
  function startCycle() { if (reduce || cycle) return; cycle = setInterval(function () { wi = (wi + 1) % WORDS.length; show(WORDS[wi]); }, 7000); }
  function stopCycle() { if (cycle) { clearInterval(cycle); cycle = null; } }
  function start() { show(typed || WORDS[wi]); if (reduce) frame(performance.now()); else requestAnimationFrame(frame); startCycle(); }
  // type to rewrite: letters/space/backspace when no input is focused and no overlay is open
  window.__fieldType = function (e) {
    if (e.key === 'Escape') { typed = ''; show(WORDS[wi]); startCycle(); if (hint) hint.textContent = 'hover to encrypt · type to rewrite'; return true; }
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); if (!typed) { show(WORDS[wi]); startCycle(); } else show(typed); return true; }
    if (e.key.length === 1 && /[a-zA-Z0-9 .&'-]/.test(e.key) && typed.length < 12) { stopCycle(); typed += e.key; show(typed); if (hint) hint.textContent = 'esc to reset'; return true; }
    return false;
  };
  c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  c.addEventListener('pointerleave', function () { mx = my = -1e4; });
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('300 40px Geist'), document.fonts.load('400 12px "Geist Mono"')]).then(start, start); else start();
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { show(typed || WORDS[wi]); }, 120); });
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
    { t: 'Home', h: 'g h', u: 'index.html' }, { t: 'Work', h: 'g w', u: 'work.html' }, { t: 'About', h: 'g a', u: 'about.html' }, { t: 'Résumé', h: 'g r', u: 'resume.html' },
    { t: 'lectr — case study', h: 'g l', u: 'lectr.html' }, { t: 'SecMCPHub — case study', h: '', u: 'secmcphub.html' }, { t: 'Soirée — case study', h: '', u: 'soiree.html' },
    { t: 'Open lectr.bid', h: '↗', u: 'https://lectr.bid', x: 1 }, { t: 'Open soiree.today', h: '↗', u: 'https://soiree.today', x: 1 },
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
    if (pending === 'g' && now - pt < 900) { pending = null; var map = { h: 'index.html', w: 'work.html', a: 'about.html', r: 'resume.html', l: 'lectr.html' }; if (map[e.key]) { e.preventDefault(); location.href = map[e.key]; return; } }
    if (e.key === 'g') { pending = 'g'; pt = now; return; }
    if (window.__fieldType && window.__fieldType(e)) e.preventDefault();
  });
})();
