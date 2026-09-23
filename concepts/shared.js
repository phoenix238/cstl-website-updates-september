/**
 * Shared helpers for the design concepts in /concepts/.
 * Exposes window.C with: rng, noise (simplex 2D/3D), loop, whileVisible,
 * once, fitCanvas, paintMask (soft painted image edges) and the concept
 * switcher bar. Concept pages are previews only — they are noindex and
 * are not linked from the real site.
 */
(function () {
  "use strict";
  var doc = document;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 700px)").matches;

  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Simplex noise (after Stefan Gustavson's public-domain reference)
  var grad3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
  var perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  (function () {
    var r = rng(1234), p = [];
    for (var i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  })();
  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
  function n2(xin, yin) {
    var s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    var x0 = xin - (i - t), y0 = yin - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255, n = 0, g, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = pm12[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x0 + grad3[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x1 + grad3[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x2 + grad3[g + 1] * y2); }
    return 70 * n;
  }
  function n3(xin, yin, zin) {
    var s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3;
    var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t), i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3, ii = i & 255, jj = j & 255, kk = k & 255, n = 0, g, tt;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x0 + grad3[g + 1] * y0 + grad3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x1 + grad3[g + 1] * y1 + grad3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x2 + grad3[g + 1] * y2 + grad3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (grad3[g] * x3 + grad3[g + 1] * y3 + grad3[g + 2] * z3); }
    return 32 * n;
  }

  function loop(fn) {
    var id = 0, running = false;
    function tick(t) { if (!running) return; if (fn(t) === false) { running = false; return; } id = requestAnimationFrame(tick); }
    return {
      start: function () { if (running || reduce) return; running = true; id = requestAnimationFrame(tick); },
      stop: function () { running = false; cancelAnimationFrame(id); },
      get on() { return running; }
    };
  }
  function whileVisible(el, on, off) {
    if (!("IntersectionObserver" in window)) { on(); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) on(); else off(); }); }).observe(el);
  }
  function once(el, cb, margin) {
    if (!("IntersectionObserver" in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { rootMargin: margin || "0px 0px -10% 0px" });
    io.observe(el);
  }
  function fitCanvas(cv, maxDpr) {
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2), w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }
  function onResize(el, fn) {
    if (!("ResizeObserver" in window)) return;
    var w = el.clientWidth, t = 0;
    new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { if (Math.abs(el.clientWidth - w) > 24) { w = el.clientWidth; fn(); } }, 200); }).observe(el);
  }

  // smooth closed blob through points (Catmull-Rom -> cubic bezier)
  function blobPath(cx, cy, R, wob, seed, pts) {
    var r = rng(seed), n = pts || 9, P = [], d = "";
    for (var i = 0; i < n; i++) { var a = (i / n) * 6.2832, rr = R * (1 - wob + r() * wob * 2); P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    for (i = 0; i < n; i++) {
      var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      if (!i) d += "M" + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
      d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d + "Z";
  }

  // a soft, painted edge for photos: an irregular blob, torn by turbulence and
  // feathered with blur, used as a CSS mask so the photo melts into the page
  function paintMask(seed, opts) {
    opts = opts || {};
    var R = opts.r || 40, wob = opts.wob || 0.14, blur = opts.blur || 3.2, tear = opts.tear || 9;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>" +
      "<filter id='f' x='-30%' y='-30%' width='160%' height='160%'>" +
      "<feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='3' seed='" + seed + "'/>" +
      "<feDisplacementMap in='SourceGraphic' scale='" + tear + "' xChannelSelector='R' yChannelSelector='G'/>" +
      "<feGaussianBlur stdDeviation='" + blur + "'/></filter>" +
      "<path fill='white' filter='url(#f)' d='" + blobPath(50, 50, R, wob, seed, opts.pts || 10) + "'/></svg>";
    return "url(\"data:image/svg+xml," + encodeURIComponent(svg) + "\")";
  }
  function applyMasks() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-paint]"), function (el, i) {
      var o = {}, spec = el.getAttribute("data-paint");
      spec.split(";").forEach(function (kv) { var p = kv.split(":"); if (p[1]) o[p[0].trim()] = +p[1]; });
      var m = paintMask(o.seed || 7 + i * 13, o);
      el.style.webkitMaskImage = m; el.style.maskImage = m;
      el.style.webkitMaskSize = "100% 100%"; el.style.maskSize = "100% 100%";
      el.style.webkitMaskRepeat = "no-repeat"; el.style.maskRepeat = "no-repeat";
    });
  }

  // reveal-on-scroll for [data-rv]
  function reveals() {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-rv]"), function (el) { once(el, function () { el.classList.add("in"); }); });
  }

  // the switcher between concepts
  var NAMES = ["Mycelium Silk", "Marbled Watercolour", "Ripple Lines", "Soft Culture", "Aura",
    "Body Heat", "Whorl", "Fluid Body", "Nerve Garden", "Spine of Light", "Every Scale"];
  var FILES = ["1-mycelium-silk.html", "2-marbled-watercolour.html", "3-ripple-lines.html", "4-soft-culture.html", "5-aura.html",
    "6-body-heat.html", "7-whorl.html", "8-fluid-body.html", "9-nerve-garden.html", "10-spine-of-light.html", "11-every-scale.html"];
  function switcher() {
    var n = +doc.body.getAttribute("data-concept");
    if (!n) return;
    var bar = doc.createElement("nav");
    bar.className = "cx-bar"; bar.setAttribute("aria-label", "Concept switcher");
    var N = FILES.length, prev = (n - 2 + N) % N, next = n % N;
    bar.innerHTML = "<a href='./' class='cx-all'>All concepts</a>" +
      "<a href='" + FILES[prev] + "' aria-label='Previous concept'>&larr;</a>" +
      "<span><b>" + n + "/" + N + "</b> " + NAMES[n - 1] + "</span>" +
      "<a href='" + FILES[next] + "' aria-label='Next concept'>&rarr;</a>";
    doc.body.appendChild(bar);
  }

  window.C = { rng: rng, n2: n2, n3: n3, loop: loop, whileVisible: whileVisible, once: once, fitCanvas: fitCanvas, onResize: onResize,
    blobPath: blobPath, paintMask: paintMask, reduce: reduce, small: small };
  applyMasks(); reveals(); switcher();
})();
