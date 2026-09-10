// Home canvas: the name, decoded. A cell grid of mono glyphs; cells inside the
// letterforms of "Collin" start as random hex and resolve left→right into the
// letter; cells outside stay as a faint dot field. Low contrast on purpose —
// it is texture that happens to spell the name, not a hero image.
(function () {
  var c = document.getElementById('field');
  if (!c) return;
  var ctx = c.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HEX = '0123456789abcdef';
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W, H, cols, rows, cell, mask, chars, t0;
  function ink() { return getComputedStyle(document.body).color; }
  function build() {
    var r = c.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 640 ? 11 : 14;
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    // letterform mask: draw the word once, sample per cell
    var m = document.createElement('canvas'); m.width = cols; m.height = rows;
    var mc = m.getContext('2d');
    mc.fillStyle = '#000'; mc.textBaseline = 'middle'; mc.textAlign = 'left';
    var fs = rows * 0.92;
    mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif';
    var word = 'Collin';
    while (mc.measureText(word).width > cols * 0.96 && fs > 8) { fs -= 1; mc.font = '300 ' + fs + 'px Geist, Helvetica, Arial, sans-serif'; }
    mc.fillText(word, cols * 0.02, rows * 0.54);
    var px = mc.getImageData(0, 0, cols, rows).data;
    mask = new Uint8Array(cols * rows); chars = new Array(cols * rows);
    for (var i = 0; i < cols * rows; i++) { mask[i] = px[i * 4 + 3] > 96 ? 1 : 0; chars[i] = HEX[(Math.random() * 16) | 0]; }
    t0 = performance.now();
  }
  function frame(now) {
    var el = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var col = ink();
    ctx.font = '400 ' + (cell * 0.78) + 'px "Geist Mono", Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    // the resolve wave sweeps left→right over ~2.2s, then holds
    var wave = reduce ? 1e9 : (el - 0.4) / 2.2;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var i = y * cols + x, cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (mask[i]) {
        var p = x / cols;
        var resolved = wave >= p;
        if (!resolved && ((now / 60) | 0) % 2 === 0) chars[i] = HEX[(Math.random() * 16) | 0];
        ctx.fillStyle = col;
        if (resolved) { ctx.globalAlpha = 0.92; var q = cell * 0.62; ctx.fillRect(cx - q / 2, cy - q / 2, q, q); }
        else { ctx.globalAlpha = 0.3; ctx.fillText(chars[i], cx, cy); }
      } else {
        ctx.globalAlpha = 0.16; ctx.fillStyle = col;
        ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    if (!reduce && wave < 1.2) requestAnimationFrame(frame); else if (!reduce) setTimeout(function () { requestAnimationFrame(frame); }, 800);
  }
  function start() { build(); requestAnimationFrame(frame); }
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('300 40px Geist'), document.fonts.load('400 12px "Geist Mono"')]).then(start, start);
  } else start();
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(start, 120); });
})();
