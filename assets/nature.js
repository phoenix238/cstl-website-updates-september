/**
 * Nature layer — shared across all pages, paired with assets/nature.css.
 *
 * A painterly micro/macro world drawn entirely in code (no extra image
 * downloads): torn-paper edges between sections, watercolour washes behind
 * photos, hand-drawn botanical line art that sketches itself in, mycelium that
 * grows through the dark bands, drifting spores over the hero, a close-up of
 * mushroom gills, and a tree-ring breathing guide.
 *
 * Everything added here is decorative (aria-hidden) and progressive: if this
 * file fails to load, the pages look exactly as they did before. Drawings are
 * seeded, so every visitor sees the same composition. Animation loops only run
 * while their canvas is on screen, and prefers-reduced-motion gets the finished
 * drawings with no movement.
 *
 * Deliberately touches nothing track.js or consent.js depend on (.wa-float,
 * .book-frame, #newsletterForm, link hrefs).
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement, body = doc.body;
  if (!("IntersectionObserver" in window) || !window.CSS || !CSS.supports("isolation", "isolate")) return;

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";
  root.classList.add("nx");
  if (reduce) root.classList.add("nx-still");

  /* ---------- small helpers ---------- */

  // mulberry32 — seeded so drawings are identical on every load
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // smooth 1-D noise: a few summed sines at random phases (range roughly ±1.9)
  function waves(r, n, base) {
    var o = [];
    for (var i = 0; i < n; i++) o.push([base * Math.pow(2.1, i) * (0.7 + r() * 0.6), r() * 6.2832, Math.pow(0.52, i)]);
    return function (x) {
      var s = 0;
      for (var i = 0; i < o.length; i++) s += Math.sin(x * o[i][0] + o[i][1]) * o[i][2];
      return s;
    };
  }
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function mk(tag, attrs, parent, svg) {
    var e = svg ? doc.createElementNS(NS, tag) : doc.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // mark an element as a decoration host: positioned + its own stacking context,
  // so z-index:-1 decorations sit above its background but under its content
  function host(e) {
    if (getComputedStyle(e).position === "static") e.classList.add("nx-rel");
    e.classList.add("nx-host");
    return e;
  }
  function bgOf(el) {
    var c = getComputedStyle(el).backgroundColor;
    return !c || c === "transparent" || /,\s*0\)$/.test(c) ? null : c;
  }
  // Catmull-Rom through points -> cubic bezier path
  function smooth(pts, closed) {
    var n = pts.length, d = "M" + f1(pts[0][0]) + " " + f1(pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], p1 = pts[i],
          p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      d += "C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return closed ? d + "Z" : d;
  }
  function once(el, cb, margin) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { rootMargin: margin || "0px 0px -10% 0px" });
    io.observe(el);
  }
  function whileVisible(el, on, off) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) on(); else off(); });
    }).observe(el);
  }
  // rAF loop; fn returns false to stop itself
  function loop(fn) {
    var id = 0, running = false;
    function tick(t) {
      if (!running) return;
      if (fn(t) === false) { running = false; return; }
      id = requestAnimationFrame(tick);
    }
    return {
      start: function () { if (running || reduce || doc.hidden) return; running = true; id = requestAnimationFrame(tick); },
      stop: function () { running = false; cancelAnimationFrame(id); },
      get on() { return running; }
    };
  }
  // canvas that fills its host; fit() re-sizes the backing store
  function canvasIn(h, cls) {
    var c = mk("canvas", { "class": "nx-canvas " + (cls || ""), "aria-hidden": "true" }, h);
    var o = { c: c, ctx: c.getContext("2d"), w: 0, h: 0 };
    o.fit = function (maxDpr) {
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
      o.w = c.clientWidth; o.h = c.clientHeight;
      c.width = Math.max(1, Math.round(o.w * dpr)); c.height = Math.max(1, Math.round(o.h * dpr));
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    return o;
  }
  // call fn when the host's width changes meaningfully (ignores mobile URL-bar jitter)
  function onResize(el, fn) {
    var w = el.clientWidth, t = 0;
    if (!("ResizeObserver" in window)) return;
    new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { if (Math.abs(el.clientWidth - w) > 24) { w = el.clientWidth; fn(); } }, 180);
    }).observe(el);
  }

  var scrollers = [], ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      for (var i = 0; i < scrollers.length; i++) scrollers[i]();
    });
  }

  /* ---------- torn paper edges between sections (+ grass before the footer) ---------- */

  function torn(color, seed) {
    var r = rng(seed), n = waves(r, 4, 1 / 150), W = 3200, H = 26;
    var s = mk("svg", { "class": "nx-deckle", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true", focusable: "false" }, null, true);
    function edge(off, amp, shift) {
      var d = "M0 " + H;
      for (var x = 0; x <= W; x += 5) d += "L" + x + " " + f1(clamp(off + n(x + shift) * amp + (r() - 0.5) * 2.2, 0, H));
      return d + "L" + W + " " + H + "Z";
    }
    mk("path", { d: edge(12, 5, 900), fill: color, "fill-opacity": ".2" }, s, true);
    mk("path", { d: edge(15, 5, 0), fill: color }, s, true);
    return s;
  }

  function grass(color, seed, W) {
    var r = rng(seed), H = 96;
    var s = mk("svg", { "class": "nx-grass", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, null, true);
    var gs = [mk("g", { "class": "sw1" }, s, true), mk("g", { "class": "sw2" }, s, true), mk("g", { "class": "sw3" }, s, true)];
    var count = Math.round(W / 11);
    for (var i = 0; i < count; i++) {
      // clumps toward both edges, a few stragglers in the middle
      var u = r(), x = u < 0.5 ? Math.pow(u * 2, 1.9) * W * 0.42 : W - Math.pow((u - 0.5) * 2, 1.9) * W * 0.42;
      var h = 12 + Math.pow(r(), 1.8) * 64 * (1 - Math.abs(x / W - 0.5)), lean = (r() - 0.5) * h * 0.8;
      var b = H - 6 - r() * 5, w = 0.7 + r() * 1.1, tx = x + lean, ty = b - h;
      mk("path", {
        d: "M" + f1(x - w) + " " + f1(b) + "Q" + f1(x + lean * 0.25) + " " + f1(b - h * 0.55) + " " + f1(tx) + " " + f1(ty) +
          "Q" + f1(x + lean * 0.25 + w) + " " + f1(b - h * 0.55) + " " + f1(x + w) + " " + f1(b) + "Z",
        fill: color
      }, gs[i % 3], true);
      if (r() < 0.13 && h > 40) {
        // seed head: a few grains stepping down the tip
        var dx = lean / h, g = "";
        for (var k = 0; k < 6; k++) {
          var gy = ty + k * 4.2, gx = tx - dx * k * 4.2;
          g += "M" + f1(gx) + " " + f1(gy) + "l" + f1(-2.2) + " " + f1(-3) + "M" + f1(gx) + " " + f1(gy) + "l2.2 -3";
        }
        mk("path", { d: g, stroke: color, "stroke-width": "1.1", fill: "none", "stroke-linecap": "round" }, gs[i % 3], true);
      }
    }
    return s;
  }

  function deckles() {
    var main = $("main"), foot = $("footer"), list = [];
    var src = main ? main.children : body.children;
    for (var i = 0; i < src.length; i++) {
      var e = src[i];
      if (/^(SCRIPT|NAV|STYLE|NOSCRIPT|A|BUTTON|IFRAME|CANVAS)$/.test(e.tagName) || e.hidden) continue;
      var cs = getComputedStyle(e);
      if (cs.position === "fixed" || cs.display === "none") continue;
      list.push(e);
    }
    if (foot && list.indexOf(foot) < 0) list.push(foot);
    var base = bgOf(body) || "rgb(250, 248, 244)", footBg = foot ? bgOf(foot) || base : null, made = [];
    for (var j = 1; j < list.length; j++) {
      var prev = list[j - 1], a = bgOf(prev) || base, b = bgOf(list[j]) || base;
      if (a === b) continue;
      host(prev).appendChild(torn(b, 11 + j * 37));
      made.push({ prev: prev, color: b });
    }
    // grass grows on the last edge that leads into the footer's colour
    for (var m = made.length - 1; m >= 0; m--) {
      if (made[m].color === footBg) {
        var p = made[m].prev, g = grass(footBg, 5, Math.max(360, Math.min(2400, innerWidth)));
        p.appendChild(g);
        onResize(body, function () { var ng = grass(footBg, 5, Math.max(360, Math.min(2400, innerWidth))); p.replaceChild(ng, g); g = ng; });
        break;
      }
    }
  }

  /* ---------- watercolour washes ---------- */

  var washId = 0;
  function wash(colors, seed, blobs) {
    var r = rng(seed), id = "nxw" + washId++;
    var s = mk("svg", { "class": "nx-wash", viewBox: "0 0 400 400", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, null, true);
    var f = mk("filter", { id: id, x: "-30%", y: "-30%", width: "160%", height: "160%", "color-interpolation-filters": "sRGB" }, mk("defs", {}, s, true), true);
    // warp the soft shapes into ragged, bleeding edges
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: ".011", numOctaves: "4", seed: String(1 + Math.floor(r() * 900)), result: "w" }, f, true);
    mk("feDisplacementMap", { "in": "SourceGraphic", in2: "w", scale: "70", xChannelSelector: "R", yChannelSelector: "G", result: "s" }, f, true);
    mk("feGaussianBlur", { "in": "s", stdDeviation: "2", result: "b" }, f, true);
    // pigment pools at the drying edge
    mk("feMorphology", { "in": "s", operator: "erode", radius: "3", result: "e" }, f, true);
    mk("feComposite", { "in": "s", in2: "e", operator: "out", result: "rim" }, f, true);
    mk("feGaussianBlur", { "in": "rim", stdDeviation: "1.1", result: "rim2" }, f, true);
    // paper granulation
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: ".6", numOctaves: "2", seed: String(Math.floor(r() * 900)), result: "g" }, f, true);
    mk("feColorMatrix", { "in": "g", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.4", result: "ga" }, f, true);
    mk("feComposite", { "in": "b", in2: "ga", operator: "in", result: "gb" }, f, true);
    var m = mk("feMerge", {}, f, true);
    mk("feMergeNode", { "in": "gb" }, m, true);
    mk("feMergeNode", { "in": "rim2" }, m, true);
    var g = mk("g", { filter: "url(#" + id + ")" }, s, true);
    for (var i = 0; i < (blobs || 3); i++) {
      var cx = 200 + (r() - 0.5) * 80, cy = 200 + (r() - 0.5) * 80, R = 110 + r() * 45, pts = [];
      for (var j = 0; j < 9; j++) {
        var a = (j / 9) * 6.2832, rr = R * (0.74 + r() * 0.4);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      mk("path", { d: smooth(pts, true), fill: colors[i % colors.length], "fill-opacity": (0.32 + r() * 0.2).toFixed(2) }, g, true);
    }
    return s;
  }

  var PALETTES = [
    ["#a9ae88", "#c9b891", "#b8b48c"], // sage & straw
    ["#c99a72", "#dcb58e", "#c4876a"], // clay & ochre
    ["#b99a86", "#d8b9a0", "#aab08e"], // dusty rose & lichen
    ["#9fae96", "#cfc09c", "#c7a07c"]  // moss & sand
  ];

  function imageWashes() {
    $$("img.r").forEach(function (img, i) {
      var p = img.parentElement;
      if (!p || p.querySelector(".nx-wash")) return;
      host(p);
      var s = wash(PALETTES[i % PALETTES.length], 300 + i * 17);
      s.classList.add("nx-behind");
      var b = img.getBoundingClientRect(), right = b.left + b.width / 2 > innerWidth / 2;
      s.style.setProperty("--wx", right ? "8%" : "-8%");
      s.style.setProperty("--wy", i % 2 ? "-6%" : "7%");
      p.insertBefore(s, p.firstChild);
      once(p, function () { s.classList.add("on"); }, "0px 0px -15% 0px");
    });
    // loose washes in section corners
    [
      [".conditions", 1, "top:-6%;right:-8%;width:46vw;height:46vw"],
      [".faq-section", 0, "top:-10%;left:-10%;width:40vw;height:40vw"],
      [".h-bookcta", 3, "top:5%;left:50%;width:60vw;height:32vw;margin-left:-30vw"],
      [".blog-section", 2, "bottom:-8%;left:-6%;width:36vw;height:36vw"],
      [".breathe", 0, "top:0;left:-12%;width:44vw;height:44vw"],
      [".h-pricing", 3, "top:8%;right:-10%;width:34vw;height:34vw"],
      [".cl-body", 3, "top:-4%;right:-10%;width:44vw;height:44vw"],
      [".cl-test", 0, "bottom:-6%;left:-10%;width:40vw;height:40vw"],
      [".faq-main", 2, "top:6%;right:-12%;width:40vw;height:40vw"],
      [".journal-grid-section", 1, "top:-6%;left:-10%;width:40vw;height:40vw"],
      [".reach-band", 0, "top:-10%;right:-8%;width:36vw;height:36vw"],
      [".blog-nav", 3, "top:-20%;right:-6%;width:30vw;height:30vw"]
    ].forEach(function (spec, i) {
      $$(spec[0]).forEach(function (sec) {
        var s = wash(PALETTES[spec[1]], 700 + i * 29, 4);
        s.classList.add("nx-loose");
        s.setAttribute("style", spec[2]);
        host(sec).insertBefore(s, sec.firstChild);
        once(sec, function () { s.classList.add("on"); });
      });
    });
  }

  /* ---------- hand-drawn botanical line art ---------- */

  // each returns { w, h, paths: [[d, strokeWidth], ...] } in its own coordinate box
  function artLeaf(r) {
    var W = 220, H = 330, bx = 110, by = 300, len = 270, bend = (r() - 0.5) * 50, WM = 60 + r() * 18, P = [];
    function mid(t) { return [bx + Math.sin(t * Math.PI) * bend * 0.4 + t * bend * 0.3, by - t * len]; }
    function wd(t) { return Math.sin(Math.pow(clamp(t, 0, 1), 0.8) * Math.PI) * WM; }
    var L = [], R = [];
    for (var i = 0; i <= 36; i++) {
      var t = i / 36, m = mid(t), w = wd(t);
      L.push([m[0] - w + (r() - 0.5) * 1.4, m[1]]);
      R.push([m[0] + w + (r() - 0.5) * 1.4, m[1]]);
    }
    P.push([smooth(L.concat(R.reverse().slice(1)), false), 1.3]);
    var rib = [];
    for (var k = -4; k <= 34; k++) rib.push(mid(k / 36));
    P.push([smooth(rib, false), 1.4]);
    for (var v = 1; v <= 8; v++) {
      var t0 = v / 9.6, t1 = t0 + 0.13, a = mid(t0), e1 = mid(t1), w0 = wd(t0), w1 = wd(t1);
      [-1, 1].forEach(function (sd) {
        var ex = e1[0] + sd * w1 * 0.93, cx = a[0] + sd * w0 * 0.55;
        P.push(["M" + f1(a[0]) + " " + f1(a[1]) + "Q" + f1(cx) + " " + f1(a[1] - 8) + " " + f1(ex) + " " + f1(e1[1]), 0.85]);
        // a couple of tertiary veinlets off each vein
        var mx = (a[0] + ex) / 2, my = (a[1] + e1[1]) / 2 - 4;
        P.push(["M" + f1(mx) + " " + f1(my) + "l" + f1(sd * 7) + " " + f1(9 + r() * 5) + "M" + f1(mx + sd * 10) + " " + f1(my - 2) + "l" + f1(sd * 6) + " " + f1(-8 - r() * 4), 0.55]);
      });
    }
    return { w: W, h: H, paths: P };
  }

  function artFern(r) {
    var W = 300, H = 440, bend = 50 + r() * 30, P = [];
    function rach(t) { return [120 + bend * t * t, 425 - 360 * t]; }
    var pts = [];
    for (var i = 0; i <= 30; i++) pts.push(rach((i / 30) * 0.93));
    P.push([smooth(pts, false), 1.4]);
    // fiddlehead curl at the tip
    var tip = rach(0.93), sp = [];
    for (var a = 0; a <= 9.5; a += 0.35) {
      var rad = 15 * Math.exp(-a * 0.2);
      sp.push([tip[0] + 10 + Math.cos(a + 3.1) * rad, tip[1] - 6 + Math.sin(a + 3.1) * rad]);
    }
    P.push([smooth([tip].concat(sp), false), 1.1]);
    var N = 17;
    for (var p = 0; p < N; p++) {
      var t = 0.07 + (p / N) * 0.8, sd = p % 2 ? 1 : -1, b = rach(t), len = 100 * Math.pow(1 - t, 0.75) * (0.9 + r() * 0.2);
      var ang = 0.42 + r() * 0.12, ex = b[0] + sd * len * Math.cos(ang), ey = b[1] - len * Math.sin(ang);
      var cx = b[0] + sd * len * 0.55, cy = b[1] - len * 0.08;
      P.push(["M" + f1(b[0]) + " " + f1(b[1]) + "Q" + f1(cx) + " " + f1(cy) + " " + f1(ex) + " " + f1(ey), 0.9]);
      var lf = "", M = Math.max(3, Math.round(len / 10));
      for (var q = 1; q < M; q++) {
        var u = q / M, it = 1 - u;
        var qx = it * it * b[0] + 2 * it * u * cx + u * u * ex, qy = it * it * b[1] + 2 * it * u * cy + u * u * ey;
        var l = len * 0.16 * (1 - u * 0.7);
        lf += "M" + f1(qx) + " " + f1(qy) + "l" + f1(sd * l * 0.35) + " " + f1(-l) + "M" + f1(qx) + " " + f1(qy) + "l" + f1(sd * l * 0.5) + " " + f1(l * 0.6);
      }
      P.push([lf, 0.6]);
    }
    return { w: W, h: H, paths: P };
  }

  function artDandelion(r) {
    var W = 320, H = 440, cx = 150, cy = 150, P = [], bend = (r() - 0.5) * 40;
    P.push(["M" + cx + " " + (cy + 8) + "Q" + f1(cx + bend) + " 300 " + f1(cx + bend * 0.6) + " 435", 1.3]);
    for (var i = 0; i < 44; i++) {
      var a = -Math.PI / 2 + (i / 44) * 6.2832 + (r() - 0.5) * 0.08;
      if (Math.abs(((a - Math.PI / 2) % 6.2832 + 6.2832) % 6.2832 - 3.1416) > 2.75) continue; // gap for the stem
      var len = 80 + r() * 20, ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len, d = "M" + cx + " " + cy + "L" + f1(ex) + " " + f1(ey);
      for (var k = 0; k < 8; k++) {
        var fa = a + (k / 7 - 0.5) * 1.8, fl = 14 + r() * 7;
        d += "M" + f1(ex) + " " + f1(ey) + "l" + f1(Math.cos(fa) * fl) + " " + f1(Math.sin(fa) * fl);
      }
      P.push([d, 0.6]);
    }
    // a few seeds already drifting away on the wind
    for (var s = 0; s < 6; s++) {
      var sx = 220 + r() * 90, sy = 20 + r() * 110, rot = -0.9 + r() * 0.6, sl = 24 + r() * 10;
      var bx = sx + Math.cos(rot + Math.PI / 2) * sl, by = sy + Math.sin(rot + Math.PI / 2) * sl, d2 = "M" + f1(bx) + " " + f1(by) + "L" + f1(sx) + " " + f1(sy);
      for (var k2 = 0; k2 < 8; k2++) {
        var fa2 = rot - Math.PI / 2 + (k2 / 7 - 0.5) * 1.9, fl2 = 11 + r() * 5;
        d2 += "M" + f1(sx) + " " + f1(sy) + "l" + f1(Math.cos(fa2) * fl2) + " " + f1(Math.sin(fa2) * fl2);
      }
      P.push([d2, 0.55]);
    }
    return { w: W, h: H, paths: P };
  }

  // fascia under the microscope: a loose web of cells
  function artWeb(r) {
    var W = 420, H = 420, G = 7, pts = [], P = [];
    for (var y = 0; y < G; y++) {
      pts.push([]);
      for (var x = 0; x < G; x++) pts[y].push([30 + (x / (G - 1)) * 360 + (r() - 0.5) * 42, 30 + (y / (G - 1)) * 360 + (r() - 0.5) * 42]);
    }
    function link(a, b) {
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], k = (r() - 0.5) * 0.35;
      var fade = 1 - Math.hypot(mx - 210, my - 210) / 260;
      if (fade < 0.12) return;
      P.push(["M" + f1(a[0]) + " " + f1(a[1]) + "Q" + f1(mx - dy * k) + " " + f1(my + dx * k) + " " + f1(b[0]) + " " + f1(b[1]), f1(0.5 + fade * 0.8)]);
    }
    for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
      if (i < G - 1) link(pts[j][i], pts[j][i + 1]);
      if (j < G - 1) link(pts[j][i], pts[j + 1][i]);
      if (i < G - 1 && j < G - 1) link(r() < 0.5 ? pts[j][i] : pts[j][i + 1], r() < 0.5 ? pts[j + 1][i + 1] : pts[j + 1][i]);
    }
    return { w: W, h: H, paths: P };
  }

  var ARTS = { leaf: artLeaf, fern: artFern, dandelion: artDandelion, web: artWeb };

  function lineArt() {
    [
      [".h-intro", "leaf", "left:-2.5%;top:9%;width:clamp(130px,15vw,230px);--rot:-16deg"],
      [".conditions", "fern", "right:-1.5%;top:2%;width:clamp(140px,16vw,240px);--rot:18deg"],
      [".fascial", "web", "right:2%;top:7%;width:clamp(240px,30vw,440px);--rot:6deg"],
      [".faq-section", "dandelion", "left:7%;top:12%;width:clamp(110px,13vw,190px);--rot:-8deg"],
      [".faq-section", "dandelion", "right:8%;bottom:10%;width:clamp(80px,9vw,140px);--rot:12deg"],
      [".blog-section", "leaf", "right:-1%;top:6%;width:clamp(110px,12vw,180px);--rot:28deg"],
      [".h-loc", "fern", "left:-2%;bottom:12%;width:clamp(120px,13vw,200px);--rot:-10deg"],
      [".h-how", "web", "left:-6%;bottom:-4%;width:clamp(200px,22vw,320px);--rot:-8deg"],
      [".cl-body", "fern", "left:-2%;bottom:6%;width:clamp(130px,14vw,210px);--rot:-12deg"],
      [".faq-main", "dandelion", "left:4%;top:5%;width:clamp(110px,12vw,180px);--rot:-6deg"],
      [".journal-grid-section", "leaf", "right:1%;bottom:4%;width:clamp(110px,12vw,180px);--rot:22deg"],
      [".reach-band", "dandelion", "left:5%;top:10%;width:clamp(90px,10vw,160px);--rot:-10deg"],
      [".cl-fees", "leaf", "right:2%;top:0;width:clamp(100px,11vw,170px);--rot:24deg"]
    ].forEach(function (spec, i) {
      $$(spec[0]).forEach(function (sec) {
        var r = rng(900 + i * 53), a = ARTS[spec[1]](r);
        var s = mk("svg", { "class": "nx-art", viewBox: "0 0 " + a.w + " " + a.h, "aria-hidden": "true", focusable: "false" }, null, true);
        s.setAttribute("style", spec[2]);
        a.paths.forEach(function (p, k) {
          var pe = mk("path", { d: p[0], "stroke-width": p[1], pathLength: "1" }, s, true);
          pe.style.transitionDelay = ((k / a.paths.length) * 1.8).toFixed(2) + "s";
        });
        host(sec).insertBefore(s, sec.firstChild);
        once(s, function () { s.classList.add("drawn"); }, "0px 0px -5% 0px");
      });
    });
  }

  /* ---------- drifting spores / pollen (canvas) ---------- */

  function spores(h, o) {
    var cv = canvasIn(h, "nx-spores"), ctx = cv.ctx, parts = [], r = rng(o.seed || 7), px = -9999, py = -9999;
    var sprite = mk("canvas", { width: 64, height: 64 }), sg = sprite.getContext("2d"), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,242,222,1)"); gr.addColorStop(0.22, "rgba(255,228,196,.5)"); gr.addColorStop(1, "rgba(255,220,186,0)");
    sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    function make(p, init) {
      p.x = r() * cv.w; p.y = init ? r() * cv.h : cv.h + 12; p.s = 0.6 + r() * r() * 2.6;
      p.vx = (r() - 0.5) * 0.14; p.vy = -(0.05 + r() * 0.2); p.ph = r() * 6.28; p.a = (0.25 + r() * 0.6) * (o.alpha || 1);
      p.seed = r() < 0.16; p.rot = r() * 6.28; p.vr = (r() - 0.5) * 0.004;
      return p;
    }
    function init() {
      cv.fit(2); parts = [];
      var n = Math.round((o.density || 1) * clamp((cv.w * cv.h) / 26000, 14, 60));
      for (var i = 0; i < n; i++) parts.push(make({}, true));
    }
    function draw() {
      ctx.clearRect(0, 0, cv.w, cv.h);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.ph += 0.012; p.rot += p.vr;
        p.x += p.vx + Math.sin(p.ph) * 0.16; p.y += p.vy;
        var dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 16000) { var f = (1 - d2 / 16000) * 0.9; p.x += (dx / Math.sqrt(d2 + 1)) * f; p.y += (dy / Math.sqrt(d2 + 1)) * f; }
        if (p.y < -20 || p.x < -30 || p.x > cv.w + 30) make(p, false);
        var al = p.a * (0.65 + 0.35 * Math.sin(p.ph * 1.7)), sz = p.s * 7;
        ctx.globalAlpha = al;
        ctx.drawImage(sprite, p.x - sz, p.y - sz, sz * 2, sz * 2);
        if (p.seed) {
          // dandelion seed: a stalk with a fan of filaments
          var L = p.s * 7, c = Math.cos(p.rot), s = Math.sin(p.rot);
          ctx.globalAlpha = al * 0.7;
          ctx.strokeStyle = "#fff4e4"; ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - s * L, p.y + c * L);
          for (var k = 0; k < 9; k++) {
            var fa = p.rot - Math.PI / 2 + (k / 8 - 0.5) * 2.2;
            ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(fa) * L * 0.8, p.y + Math.sin(fa) * L * 0.8);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    var lp = loop(draw);
    init(); draw();
    whileVisible(h, lp.start, lp.stop);
    onResize(h, function () { init(); draw(); });
    addEventListener("pointermove", function (e) {
      if (!lp.on) return;
      var b = cv.c.getBoundingClientRect();
      px = e.clientX - b.left; py = e.clientY - b.top;
    }, { passive: true });
  }

  /* ---------- mycelium: hyphae that grow, branch, and answer the pointer ---------- */

  function mycelium(h, o) {
    var net = canvasIn(h, "nx-myc"), tipsCv = canvasIn(h, "nx-myc"), ctx = net.ctx, tctx = tipsCv.ctx;
    var tips = [], r, spawned = 0, lastSpawn = 0, grown = false;
    var col = o.color, glow = o.glow || o.color;
    function tip(x, y, a, g, life) { return { x: x, y: y, a: a, g: g, life: life, curl: (r() - 0.5) * 0.024 }; }
    function seed() {
      r = rng(o.seed || 1); tips = [];
      var W = net.w, H = net.h;
      for (var i = 0; i < (o.count || 9); i++) {
        var s = r(), x, y, a;
        if (s < 0.3) { x = r() * W; y = H + 4; a = -Math.PI / 2 + (r() - 0.5) * 1.2; }
        else if (s < 0.5) { x = -4; y = r() * H; a = (r() - 0.5) * 1.1; }
        else if (s < 0.7) { x = W + 4; y = r() * H; a = Math.PI + (r() - 0.5) * 1.1; }
        else if (s < 0.85) { x = r() * W; y = -4; a = Math.PI / 2 + (r() - 0.5) * 1.2; }
        else { x = W * (0.1 + r() * 0.8); y = H * (0.1 + r() * 0.8); a = r() * 6.283; }
        tips.push(tip(x, y, a, 0, 300 + r() * 260));
      }
    }
    function step() {
      var W = net.w, H = net.h, b = [[], [], [], [], [], []];
      for (var i = tips.length - 1; i >= 0; i--) {
        var t = tips[i], ox = t.x, oy = t.y;
        t.a += (r() - 0.5) * 0.3 + t.curl;
        t.x += Math.cos(t.a) * 1.8; t.y += Math.sin(t.a) * 1.8; t.life--;
        b[Math.min(5, t.g)].push(ox, oy, t.x, t.y);
        if (t.g < 5 && tips.length < (o.max || 200) && r() < 0.02 / (1 + t.g * 0.7))
          tips.push(tip(t.x, t.y, t.a + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.6), t.g + 1, t.life * 0.75));
        if (t.life <= 0 || t.x < -30 || t.y < -30 || t.x > W + 30 || t.y > H + 30) tips.splice(i, 1);
      }
      for (var g = 0; g < 6; g++) {
        var arr = b[g];
        if (!arr.length) continue;
        ctx.beginPath();
        for (var j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); }
        ctx.lineWidth = Math.max(0.4, 1.5 * Math.pow(0.74, g));
        ctx.strokeStyle = "rgba(" + col + "," + (o.alpha * (1 - g * 0.1)).toFixed(3) + ")";
        ctx.stroke();
      }
    }
    function drawTips() {
      tctx.clearRect(0, 0, tipsCv.w, tipsCv.h);
      tctx.fillStyle = "rgba(" + glow + ",.85)";
      tctx.shadowColor = "rgba(" + glow + ",.9)"; tctx.shadowBlur = 6;
      tctx.beginPath();
      for (var i = 0; i < tips.length; i++) { tctx.moveTo(tips[i].x + 1.3, tips[i].y); tctx.arc(tips[i].x, tips[i].y, 1.3, 0, 6.2832); }
      tctx.fill();
    }
    function finish() { var guard = 0; while (tips.length && guard++ < 4000) step(); tctx.clearRect(0, 0, tipsCv.w, tipsCv.h); grown = true; }
    function reset() { net.fit(2); tipsCv.fit(2); seed(); }
    var lp = loop(function () {
      step(); step();
      drawTips();
      if (!tips.length) { tctx.clearRect(0, 0, tipsCv.w, tipsCv.h); grown = true; return false; }
    });
    reset();
    if (reduce) finish();
    whileVisible(h, function () { if (tips.length) lp.start(); }, lp.stop);
    onResize(h, function () { lp.stop(); reset(); finish(); });
    if (!reduce) h.addEventListener("pointermove", function (e) {
      var now = performance.now();
      if (now - lastSpawn < 70 || spawned > 320) return;
      lastSpawn = now; spawned++;
      var bb = net.c.getBoundingClientRect();
      tips.push(tip(e.clientX - bb.left, e.clientY - bb.top, r() * 6.283, 2, 70 + r() * 80));
      if (!lp.on) lp.start();
    }, { passive: true });
    return { grown: function () { return grown; } };
  }

  /* ---------- macro: the underside of a mushroom cap ---------- */

  function gills(h) {
    var cv = canvasIn(h, "nx-gills");
    function draw() {
      cv.fit(1.5);
      var ctx = cv.ctx, W = cv.w, H = cv.h, r = rng(4242), n1 = waves(r, 4, 1 / 140), n2 = waves(r, 3, 1 / 7);
      var edge = function (x) { return H * 0.5 - H * 0.12 * Math.sin(Math.PI * clamp(x / W, 0, 1)) + n1(x) * 5; };
      var vx = W * 0.5, vy = H * 2.8, x, i;
      ctx.clearRect(0, 0, W, H);
      // out-of-focus warmth behind the cap
      for (i = 0; i < 14; i++) {
        var bx = r() * W, by = r() * H * 0.45, br = 30 + r() * 90, g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, "rgba(196,120,70," + (0.05 + r() * 0.07).toFixed(3) + ")"); g.addColorStop(1, "rgba(196,120,70,0)");
        ctx.fillStyle = g; ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-10, H + 10);
      for (x = -10; x <= W + 10; x += 6) ctx.lineTo(x, edge(x));
      ctx.lineTo(W + 10, H + 10); ctx.closePath();
      var bg = ctx.createLinearGradient(0, H * 0.35, 0, H);
      bg.addColorStop(0, "#7c3016"); bg.addColorStop(1, "#261006");
      ctx.fillStyle = bg; ctx.fill(); ctx.clip();
      // each gill is a thin pleated ridge: neighbours undulate together (n2) and
      // broad bands of light and shade drift across the fan (n3)
      var N = Math.round(W / 3.1), n3 = waves(r, 3, 1 / 38), n4 = waves(r, 2, 1 / 5);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (i = 0; i < N; i++) {
        var x0 = -W * 0.12 + ((i + r() * 0.5) / N) * W * 1.24, y0 = edge(x0) - 3 + (r() < 0.42 ? 8 + r() * 70 : 0);
        var dx = vx - x0, dy = vy - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, len = (H - y0) / uy + 30;
        var amp = 2.5 + Math.abs(n2(i * 0.6)) * 5, ph = n2(i * 0.35) * 2.2, fq = 5 + n4(i) * 1.5;
        var lit = clamp(0.55 + n3(i) * 0.32 + (r() - 0.5) * 0.18, 0.08, 1);
        var base = "rgb(" + Math.round(118 + lit * 96) + "," + Math.round(40 + lit * 58) + "," + Math.round(16 + lit * 30) + ")";
        var layers = [["rgba(28,8,3,.82)", 2.8 + r() * 0.8, 1.2], [base, 1.5 + r() * 0.7, 0], ["rgba(255,192,142," + (0.18 + lit * 0.5).toFixed(2) + ")", 0.6, -0.7]];
        var pts = [];
        for (var u = 0; u <= 1.0001; u += 0.04) {
          var w = Math.sin(u * fq + ph) * amp * (0.35 + u), px = x0 + ux * len * u, py = y0 + uy * len * u;
          pts.push(px - uy * w, py + ux * w);
        }
        for (var k = 0; k < 3; k++) {
          ctx.strokeStyle = layers[k][0]; ctx.lineWidth = layers[k][1];
          ctx.beginPath(); ctx.moveTo(pts[0] + layers[k][2], pts[1]);
          for (var q = 2; q < pts.length; q += 2) ctx.lineTo(pts[q] + layers[k][2], pts[q + 1]);
          ctx.stroke();
        }
      }
      // light falls on the rim, the throat of the gills sinks into shadow
      var sh = ctx.createLinearGradient(0, H * 0.38, 0, H);
      sh.addColorStop(0, "rgba(255,170,110,.16)"); sh.addColorStop(0.18, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(14,5,2,.82)");
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // the fuzzy cream margin of the cap
      ctx.save();
      ctx.shadowColor = "rgba(240,210,170,.5)"; ctx.shadowBlur = 8;
      ctx.strokeStyle = "rgba(232,204,168,.35)"; ctx.lineWidth = 3;
      ctx.beginPath(); for (x = -10; x <= W + 10; x += 6) ctx[x === -10 ? "moveTo" : "lineTo"](x, edge(x) - 1); ctx.stroke();
      ctx.restore();
      var specks = ["#efdcc4", "#d8b896", "#bf9470", "#f6ead9", "#caa17a"];
      for (i = 0; i < W * 2.4; i++) {
        x = r() * W;
        var y = edge(x) - 1 + (r() - 0.62) * 12 * r(), rad = 0.35 + r() * r() * 1.8;
        ctx.globalAlpha = 0.45 + r() * 0.5; ctx.fillStyle = specks[i % 5];
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    draw();
    onResize(h, draw);
  }

  /* ---------- tree rings for the breathing guide ---------- */

  function rings() {
    var r = rng(99), n = waves(r, 5, 1);
    var s = mk("svg", { "class": "nx-rings", viewBox: "0 0 400 400", "aria-hidden": "true", focusable: "false" }, null, true);
    var defs = mk("defs", {}, s, true);
    var rough = mk("filter", { id: "nxRough", x: "-10%", y: "-10%", width: "120%", height: "120%" }, defs, true);
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: ".045", numOctaves: "3", seed: "8", result: "t" }, rough, true);
    mk("feDisplacementMap", { "in": "SourceGraphic", in2: "t", scale: "7", xChannelSelector: "R", yChannelSelector: "G" }, rough, true);
    var g = mk("g", { "class": "nx-rings-g" }, s, true);
    var disc = wash(["#e3c8a3", "#d9b68d", "#ead3b2"], 51, 3);
    disc.setAttribute("x", "0"); disc.setAttribute("y", "0"); disc.setAttribute("width", "400"); disc.setAttribute("height", "400");
    g.appendChild(disc);
    var cx = 200 + (r() - 0.5) * 18, cy = 200 + (r() - 0.5) * 18, R = 4, k = 0;
    function ring(rad, amp) {
      var pts = [];
      for (var i = 0; i < 90; i++) {
        var a = (i / 90) * 6.2832, rr = rad * (1 + amp * n(a) * (rad / 180)) + (r() - 0.5) * 0.7;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      return smooth(pts, true);
    }
    while (R < 170) {
      R += 3 + r() * r() * 9; k++;
      var strong = k % 5 === 0;
      mk("path", {
        d: ring(R, 0.05), fill: "none", stroke: "#7b4a2b", pathLength: "1", "class": "nx-ring",
        "stroke-width": (strong ? 1.5 + r() : 0.5 + r() * 0.9).toFixed(2), "stroke-opacity": (strong ? 0.7 : 0.25 + r() * 0.35).toFixed(2),
        style: "--i:" + k
      }, g, true);
    }
    mk("path", { d: ring(177, 0.06), fill: "none", stroke: "#a0714a", "stroke-width": "1.6", "stroke-opacity": ".7", "class": "nx-ring", pathLength: "1", style: "--i:" + (k + 1) }, g, true);
    mk("path", { d: ring(184, 0.07), fill: "none", stroke: "#4d2f1c", "stroke-width": "7", "stroke-opacity": ".85", filter: "url(#nxRough)", "class": "nx-ring", pathLength: "1", style: "--i:" + (k + 2) }, g, true);
    for (var c = 0; c < 3; c++) {
      var a0 = r() * 6.2832, d = "M" + f1(cx + Math.cos(a0) * 40) + " " + f1(cy + Math.sin(a0) * 40), rr2 = 40;
      while (rr2 < 175) { rr2 += 8; a0 += (r() - 0.5) * 0.06; d += "L" + f1(cx + Math.cos(a0) * rr2) + " " + f1(cy + Math.sin(a0) * rr2); }
      mk("path", { d: d, fill: "none", stroke: "#5a3622", "stroke-width": "1", "stroke-opacity": ".45", "class": "nx-ring", pathLength: "1", style: "--i:" + (k + 3) }, g, true);
    }
    mk("circle", { cx: f1(cx), cy: f1(cy), r: "3", fill: "#6b4029" }, g, true);
    return s;
  }

  function breathe() {
    var sec = $("#breathe");
    if (!sec) return;
    sec.hidden = false;
    var vis = $(".breathe-visual", sec), btn = $("#breatheBtn"), lab = $("#breatheLabel"), cnt = $(".breathe-count", sec);
    vis.insertBefore(rings(), vis.firstChild);
    once(vis, function () { vis.classList.add("drawn"); });
    var timer = 0, running = false;
    function phase(txt, scale, ms, count) {
      lab.textContent = txt;
      cnt.textContent = count || "";
      vis.style.setProperty("--bd", ms + "ms");
      vis.style.setProperty("--bs", scale);
    }
    function stop() {
      running = false; clearTimeout(timer);
      vis.classList.remove("guided");
      btn.textContent = "Begin"; btn.setAttribute("aria-pressed", "false");
      lab.textContent = ""; cnt.textContent = "";
    }
    function run(i) {
      if (i >= 3) {
        phase("Welcome back", 0.92, 2400);
        timer = setTimeout(stop, 4200);
        return;
      }
      phase("Breathe in", 1.05, 4000, (i + 1) + " of 3");
      timer = setTimeout(function () {
        phase("Breathe out", 0.82, 6000, (i + 1) + " of 3");
        timer = setTimeout(function () { run(i + 1); }, 6000);
      }, 4000);
    }
    btn.addEventListener("click", function () {
      if (running) { stop(); return; }
      running = true;
      vis.classList.add("guided");
      btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
      phase("Settle in", 0.86, 1600);
      timer = setTimeout(function () { run(0); }, 1800);
    });
  }

  /* ---------- the macro band ---------- */

  function macro() {
    var mb = $(".macro");
    if (!mb) return;
    mb.hidden = false;
    var stick = $(".macro-stick", mb), words = $$(".macro-words span", mb);
    gills(stick);
    var tx = 0.5, ty = 0.55, lx = 0.5, ly = 0.55, lastMove = 0;
    scrollers.push(function () {
      var b = mb.getBoundingClientRect(), vh = innerHeight;
      if (b.bottom < 0 || b.top > vh) return;
      var span = b.height - vh, p = span > 0 ? clamp(-b.top / span, 0, 1) : 0.5;
      mb.style.setProperty("--mp", p.toFixed(4));
      var idx = Math.min(words.length - 1, Math.floor(p * words.length * 0.999));
      for (var i = 0; i < words.length; i++) words[i].classList.toggle("on", i === idx);
    });
    stick.addEventListener("pointermove", function (e) {
      var b = stick.getBoundingClientRect();
      tx = (e.clientX - b.left) / b.width; ty = (e.clientY - b.top) / b.height; lastMove = performance.now();
    }, { passive: true });
    var lp = loop(function (t) {
      if (t - lastMove > 2500) { tx = 0.5 + Math.sin(t / 3100) * 0.3; ty = 0.58 + Math.sin(t / 2300) * 0.12; }
      lx += (tx - lx) * 0.06; ly += (ty - ly) * 0.06;
      stick.style.setProperty("--lx", (lx * 100).toFixed(2) + "%");
      stick.style.setProperty("--ly", (ly * 100).toFixed(2) + "%");
    });
    whileVisible(stick, lp.start, lp.stop);
  }

  /* ---------- reveal & interaction polish ---------- */

  function rules() {
    $$(".rule").forEach(function (el) {
      var s = mk("svg", { viewBox: "0 0 64 10", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, el, true);
      mk("path", { d: "M1 5.5C9 2.5 15 8.5 24 5.2S40 2 47 5.6 58 7.4 63 4.4", pathLength: "1" }, s, true);
      once(el, function () { el.classList.add("drawn"); });
    });
  }

  function splitWords(h) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          ch.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
            var o = mk("span", { "class": "nx-w" }), inner = mk("span", {}, o);
            inner.textContent = p; inner.style.setProperty("--i", i++);
            frag.appendChild(o);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && ch.tagName !== "BR") walk(ch);
      });
    })(h);
    h.classList.add("nx-split");
    once(h, function () { h.classList.add("nx-in"); }, "0px 0px -6% 0px");
  }

  function reveals() {
    $$("h2.dsp, .hero-copy h1, .cl-hero h1, .page-hero h1, .blog-hero h1, .h-bookcta h2").forEach(splitWords);
    // grids reveal card by card instead of all at once
    $$(".cond-grid, .test-grid, .blog-grid, .p-grid, .loc-grid, .row3, .tiers, .journal-grid").forEach(function (g) {
      g.classList.add("nx-stagger");
      Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty("--i", i); });
      once(g, function () {
        g.classList.add("nx-go");
        setTimeout(function () { g.classList.add("nx-done"); }, 1400 + g.children.length * 90);
      });
    });
    // photos open like paint spreading across the paper
    if (!reduce) $$("img.r, .journal-card-img img, .blog-card-img img").forEach(function (img) {
      img.classList.add("nx-paint");
      once(img, function () {
        img.classList.add("nx-open");
        setTimeout(function () { img.classList.add("nx-free"); }, 2600);
      }, "0px 0px -8% 0px");
    });
    // soft glow that follows the pointer across cards
    $$(".cond-card, .p-card, .test-card, .loc-card, .blog-card, .contact-card, .tier, .journal-card, .cl-test-card").forEach(function (c) {
      c.classList.add("nx-card");
      c.addEventListener("pointermove", function (e) {
        var b = c.getBoundingClientRect();
        c.style.setProperty("--mx", (e.clientX - b.left).toFixed(0) + "px");
        c.style.setProperty("--my", (e.clientY - b.top).toFixed(0) + "px");
      }, { passive: true });
    });
  }

  function steps() {
    var st = $(".steps");
    if (!st) return;
    host(st);
    mk("span", { "class": "nx-stem", "aria-hidden": "true" }, st);
    var items = $$(".step", st);
    scrollers.push(function () {
      var b = st.getBoundingClientRect(), line = innerHeight * 0.66;
      if (b.bottom < -200 || b.top > innerHeight + 200) return;
      st.style.setProperty("--sp", clamp((line - b.top) / b.height, 0, 1).toFixed(3));
      for (var i = 0; i < items.length; i++) items[i].classList.toggle("lit", items[i].getBoundingClientRect().top + 18 < line);
    });
  }

  function marquee() {
    var ti = $(".trust-in");
    if (!ti) return;
    var track = mk("div", { "class": "nx-track" });
    while (ti.firstChild) track.appendChild(ti.firstChild);
    ti.appendChild(track);
    var clone = track.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.classList.add("nx-clone");
    ti.appendChild(clone);
    ti.classList.add("nx-marquee");
  }

  function hero() {
    var hm = $(".hero-media");
    if (!hm) return;
    host(hm);
    spores(hm, { seed: 3, alpha: 0.9 });
    var img = $("img", hm);
    if (img && !reduce) scrollers.push(function () {
      var y = window.scrollY;
      if (y < innerHeight * 1.3) img.style.translate = "0 " + (y * 0.22).toFixed(1) + "px";
    });
  }

  function darkBands() {
    $$(".quote-band").forEach(function (q) {
      host(q);
      mycelium(q, { seed: 21, color: "236,214,186", glow: "236,178,128", alpha: 0.2, count: 10, max: 220 });
    });
    $$(".cl-hero, .page-hero, .blog-hero").forEach(function (h, i) {
      host(h);
      mycelium(h, { seed: 40 + i, color: "236,214,186", glow: "236,178,128", alpha: 0.13, count: 8, max: 160 });
      spores(h, { seed: 60 + i, density: 0.5, alpha: 0.7 });
    });
    $$(".testimonials").forEach(function (t) { host(t); spores(t, { seed: 77, density: 0.45, alpha: 0.55 }); });
    $$(".h-bookcta").forEach(function (c) {
      host(c);
      mycelium(c, { seed: 88, color: "124,92,62", glow: "176,122,82", alpha: 0.11, count: 7, max: 140 });
    });
  }

  function progress() {
    var bar = mk("div", { "class": "nx-progress", "aria-hidden": "true" }, body);
    scrollers.push(function () {
      var m = root.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (m > 0 ? clamp(window.scrollY / m, 0, 1) : 0).toFixed(4) + ")";
    });
  }

  /* ---------- boot ---------- */

  function safely(fn) { try { fn(); } catch (e) { if (window.console) console.warn("nature.js:", e); } }
  [macro, breathe, deckles, imageWashes, lineArt, rules, reveals, steps, marquee, hero, darkBands, progress].forEach(safely);
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
