// Home canvas: the name, decoded. A cell grid; cells inside the letterforms
// start as random hex and resolve left→right into filled squares; cells
// outside stay a faint dot field. Touch it and the squares near the cursor
// fall back into hex and re-resolve behind you — encrypt where you touch.
// Every few seconds the word cycles (Collin → Stilwell → Security) and the
// resolve wave runs again. Reduced motion: final state, no cycling.
(function () {
  var c = document.getElementById('field');
  if (!c) return;
  var ctx = c.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEX = '0123456789abcdef';
  var WORDS = ['Collin', 'Stilwell', 'Security'];
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W, H, cols, rows, cell, mask, chars, heat, t0, wi = 0, mx = -1e4, my = -1e4;
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
      } else {
        ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    if (!reduce) requestAnimationFrame(frame);
  }
  function start() { build(WORDS[wi]); if (reduce) frame(performance.now()); else requestAnimationFrame(frame); }
  if (!reduce) setInterval(function () { wi = (wi + 1) % WORDS.length; build(WORDS[wi]); }, 7000);
  c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  c.addEventListener('pointerleave', function () { mx = my = -1e4; });
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('300 40px Geist'), document.fonts.load('400 12px "Geist Mono"')]).then(start, start);
  } else start();
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(start, 120); });
})();

// The page shows its own last commit, live from GitHub (public repo, CORS ok).
// Falls back silently to the static text if the request fails.
(function () {
  var el = document.getElementById('commit');
  if (!el) return;
  fetch('https://api.github.com/repos/stilwellc/collin/commits/main', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.sha) return;
      var d = new Date(j.commit.committer.date), ago = Math.round((Date.now() - d) / 36e5);
      el.textContent = 'main @ ' + j.sha.slice(0, 7) + ' · ' + (ago < 1 ? 'just now' : ago < 48 ? ago + 'h ago' : Math.round(ago / 24) + 'd ago');
      el.href = j.html_url;
    }).catch(function () {});
})();
