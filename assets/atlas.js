/**
 * Atlas — "the body at every scale". Homepage behaviour, paired with
 * assets/atlas.css.
 *
 *   field()     living colour field (WebGL) behind the hero and the closing
 *               section; it warms and bends under the pointer, like tissue
 *               under light touch
 *   cells()     a culture of dividing cells (Gray-Scott reaction-diffusion,
 *               on the GPU with a CPU fallback) in the breathing lens
 *   network()   fascia / mycelium threads that grow, fuse where they meet,
 *               and carry slow pulses of light
 *   rail()      the scale indicator: x1 -> x10 -> x100 -> x1000 -> x1
 *   breathe()   guided breathing over the live culture
 *
 * Everything visual is decorative (aria-hidden). Loops only run while their
 * element is on screen; prefers-reduced-motion gets still frames. Touches
 * nothing track.js or consent.js depend on (.wa-float, #newsletterForm, hrefs).
 */
(function () {
  "use strict";

  var doc = document, root = doc.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = matchMedia("(max-width: 680px)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* ---------- helpers ---------- */

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function rng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function once(el, cb, margin) {
    if (!hasIO) { cb(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cb(e.target); } });
    }, { rootMargin: margin || "0px 0px -12% 0px" });
    io.observe(el);
  }
  function whileVisible(el, on, off) {
    if (!hasIO) { on(); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) on(); else off(); });
    }).observe(el);
  }
  function loop(fn) {
    var id = 0, running = false;
    function tick(t) {
      if (!running) return;
      if (fn(t) === false) { running = false; return; }
      id = requestAnimationFrame(tick);
    }
    return {
      start: function () { if (running || reduce) return; running = true; id = requestAnimationFrame(tick); },
      stop: function () { running = false; cancelAnimationFrame(id); },
      get on() { return running; }
    };
  }
  function onResize(el, fn) {
    if (!("ResizeObserver" in window)) return;
    var w = el.clientWidth, t = 0;
    new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(function () { if (Math.abs(el.clientWidth - w) > 24) { w = el.clientWidth; fn(); } }, 180);
    }).observe(el);
  }
  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    p.u = u;
    return p;
  }
  // one triangle that covers the screen
  function fullscreen(gl) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return b;
  }

  /* ---------- field: the living colour behind the hero ---------- */

  var FIELD_FS = [
    "precision highp float;",
    "uniform vec2 uR; uniform float uT; uniform vec3 uM;",
    "float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);",
    "  return mix(mix(h(i), h(i + vec2(1., 0.)), u.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), u.x), u.y); }",
    "float fbm(vec2 p){ float s = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for (int i = 0; i < 5; i++){ s += a * n(p); p = m * p; a *= .5; } return s; }",
    "void main(){",
    "  float k = min(uR.x, uR.y);",
    "  vec2 p = (gl_FragCoord.xy - .5 * uR) / k;",
    "  vec2 mp = (uM.xy * uR - .5 * uR) / k;",
    "  float d = length(p - mp), touch = uM.z * exp(-d * d * 5.);",
    "  float t = uT * .035;",
    "  vec2 q = vec2(fbm(p * 1.25 + vec2(0., t)), fbm(p * 1.25 + vec2(5.2, 1.3) - t));",
    "  vec2 r = vec2(fbm(p * 1.4 + 3. * q + vec2(1.7, 9.2) + t * .7 + touch * .9), fbm(p * 1.4 + 3. * q + vec2(8.3, 2.8) - t * .5));",
    "  float f = fbm(p * 1.15 + 3.3 * r);",
    "  vec3 ink = vec3(.051, .043, .063), ember = vec3(1., .545, .24), rose = vec3(.894, .32, .56), violet = vec3(.478, .42, .878), cyan = vec3(.263, .776, .714);",
    "  vec3 col = ink;",
    "  col = mix(col, violet * .7, smoothstep(.35, .95, r.y) * .75);",
    "  col = mix(col, rose, smoothstep(.45, .95, f) * .8);",
    "  col = mix(col, ember, smoothstep(.62, 1.05, f + q.x * .25) * .85);",
    "  col = mix(col, cyan * .8, smoothstep(.72, 1.1, r.x) * .45);",
    "  col += (ember * .55 + rose * .45) * touch * .45;",
    "  col *= .42 + .75 * f;",
    "  col += (h(gl_FragCoord.xy + uT) - .5) / 255.;",
    "  gl_FragColor = vec4(col, 1.);",
    "}"
  ].join("\n");

  function field(el) {
    var cv = doc.createElement("canvas");
    var gl = cv.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return; // the CSS gradient underneath stays as the field
    var p;
    try { p = program(gl, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }", FIELD_FS); }
    catch (e) { return; }
    el.appendChild(cv);
    var buf = fullscreen(gl), scale = small ? 0.45 : 0.55;
    gl.useProgram(p);
    var loc = gl.getAttribLocation(p, "a");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var mx = 0.7, my = 0.5, tx = 0.7, ty = 0.5, mz = 0, tz = 0, last = 0, t0 = performance.now() - 40000 * Math.random();
    function size() {
      cv.width = Math.max(2, Math.round(el.clientWidth * scale)); cv.height = Math.max(2, Math.round(el.clientHeight * scale));
      gl.viewport(0, 0, cv.width, cv.height);
    }
    function draw(now) {
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05; mz += (tz - mz) * 0.04; tz *= 0.985;
      gl.uniform2f(p.u.uR, cv.width, cv.height);
      gl.uniform1f(p.u.uT, (now - t0) / 1000);
      gl.uniform3f(p.u.uM, mx, my, mz);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    size(); draw(performance.now());
    onResize(el, function () { size(); draw(performance.now()); });
    var lp = loop(function (now) { if (now - last < 32) return; last = now; draw(now); });
    whileVisible(el, lp.start, lp.stop);
    el.parentNode.addEventListener("pointermove", function (e) {
      var b = el.getBoundingClientRect();
      tx = (e.clientX - b.left) / b.width; ty = 1 - (e.clientY - b.top) / b.height; tz = 1;
    }, { passive: true });
  }

  /* ---------- cells: Gray-Scott reaction-diffusion ---------- */

  // Two chemicals diffuse and react (A + 2B -> 3B). At these feed/kill rates B
  // gathers into spots that grow and divide — the same maths behind many
  // patterns in living tissue.
  var F = 0.0367, K = 0.0649;

  var SIM_FS = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D s; uniform vec2 px; uniform vec4 brush; uniform vec4 cull; uniform float F; uniform float K;",
    "in vec2 v; out vec4 o;",
    "vec2 at(vec2 d){ return texture(s, v + d * px).rg; }",
    "void main(){",
    "  vec2 c = at(vec2(0.));",
    "  vec2 l = .2 * (at(vec2(1., 0.)) + at(vec2(-1., 0.)) + at(vec2(0., 1.)) + at(vec2(0., -1.)))",
    "         + .05 * (at(vec2(1., 1.)) + at(vec2(-1., -1.)) + at(vec2(1., -1.)) + at(vec2(-1., 1.))) - c;",
    "  float a = c.r, b = c.g, abb = a * b * b;",
    "  a += l.r - abb + F * (1. - a);",
    "  b += .5 * l.g + abb - (K + F) * b;",
    "  if (brush.z > 0. && distance(v, brush.xy) < brush.z) { b = max(b, .9); a = min(a, .5); }",
    "  if (cull.z > 0. && distance(v, cull.xy) < cull.z) { b *= cull.w; }",
    "  if (distance(v, vec2(.5)) > .495) { a = 1.; b = 0.; }",
    "  o = vec4(clamp(a, 0., 1.), clamp(b, 0., 1.), 0., 1.);",
    "}"
  ].join("\n");

  var SHOW_FS = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D s; uniform vec2 px; uniform float lvl;",
    "in vec2 v; out vec4 o;",
    "vec3 ramp(float t){",
    "  vec3 c = vec3(.027, .024, .04);",
    "  c = mix(c, vec3(.08, .1, .17), smoothstep(.0, .35, t));",
    "  c = mix(c, vec3(.29, .2, .55), smoothstep(.35, .5, t));",
    "  c = mix(c, vec3(.78, .26, .5), smoothstep(.48, .63, t));",
    "  c = mix(c, vec3(.96, .5, .27), smoothstep(.6, .78, t));",
    "  c = mix(c, vec3(1., .8, .56), smoothstep(.76, .9, t));",
    "  c = mix(c, vec3(1., .96, .88), smoothstep(.88, 1., t));",
    "  return c;",
    "}",
    "void main(){",
    "  vec2 u = (v - .5) / 1.12 + .5;",
    "  vec2 c = texture(s, u).rg;",
    "  float t = clamp((1. - (c.r - c.g)) * 1.12, 0., 1.);",
    "  float gx = texture(s, u + vec2(px.x, 0.)).g - texture(s, u - vec2(px.x, 0.)).g;",
    "  float gy = texture(s, u + vec2(0., px.y)).g - texture(s, u - vec2(0., px.y)).g;",
    "  float e = clamp(length(vec2(gx, gy)) * 7., 0., 1.);",
    "  vec3 col = ramp(t) + vec3(.26, .78, .71) * e * .55;",
    "  col *= .82 + .4 * lvl;",
    "  o = vec4(col, 1.);",
    "}"
  ].join("\n");

  var VS2 = "#version 300 es\nin vec2 a; out vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }";

  // GPU culture; returns null when WebGL2 float render targets aren't available
  function cultureGL(host, n, seed) {
    var cv = doc.createElement("canvas");
    var gl = cv.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) return null;
    var sim, show;
    try { sim = program(gl, VS2, SIM_FS); show = program(gl, VS2, SHOW_FS); } catch (e) { return null; }
    var buf = fullscreen(gl), r = rng(seed), data = new Float32Array(n * n * 4), c = n / 2;
    for (var i = 0; i < n * n; i++) { data[i * 4] = 1; data[i * 4 + 3] = 1; }
    for (var s = 0; s < n / 5; s++) {
      var a = r() * 6.283, rad = Math.sqrt(r()) * (c - 16), sx = c + Math.cos(a) * rad, sy = c + Math.sin(a) * rad;
      for (var y = -3; y <= 3; y++) for (var x = -3; x <= 3; x++) if (x * x + y * y <= 9) {
        var j = ((sy + y) | 0) * n + ((sx + x) | 0);
        data[j * 4] = 0.5; data[j * 4 + 1] = 0.9;
      }
    }
    var tex = [], fbo = [];
    for (var k = 0; k < 2; k++) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, n, n, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
      tex.push(t); fbo.push(f);
    }
    host.appendChild(cv);
    function bind(p) {
      gl.useProgram(p);
      var loc = gl.getAttribLocation(p, "a");
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    var cur = 0, brush = [0, 0, 0, 0], cull = [0, 0, 0, 1];
    var o = {
      gpu: true,
      step: function (iters) {
        bind(sim);
        gl.viewport(0, 0, n, n);
        gl.uniform2f(sim.u.px, 1 / n, 1 / n); gl.uniform1f(sim.u.F, F); gl.uniform1f(sim.u.K, K);
        gl.uniform4fv(sim.u.cull, cull);
        for (var i = 0; i < iters; i++) {
          gl.uniform4fv(sim.u.brush, i === 0 ? brush : [0, 0, 0, 0]);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
          gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          cur = 1 - cur;
        }
        brush = [0, 0, 0, 0];
      },
      draw: function (lvl) {
        bind(show);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, cv.width, cv.height);
        gl.bindTexture(gl.TEXTURE_2D, tex[cur]);
        gl.uniform2f(show.u.px, 1 / n, 1 / n); gl.uniform1f(show.u.lvl, lvl);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      feed: function (u, v) { brush = [(u - 0.5) / 1.12 + 0.5, 1 - ((v - 0.5) / 1.12 + 0.5), 5 / n, 0]; },
      cull: function (u, v, rad, k) { cull = [u, v, rad, k]; },
      fit: function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(host.clientWidth * dpr); cv.height = Math.round(host.clientHeight * dpr);
      }
    };
    o.fit();
    return o;
  }

  // CPU fallback: same chemistry on a smaller grid, drawn through a colour ramp
  function cultureCPU(host, n, seed) {
    var N = n * n, A = new Float32Array(N).fill(1), B = new Float32Array(N), A2 = new Float32Array(N).fill(1), B2 = new Float32Array(N), M = new Uint8Array(N);
    var c = (n - 1) / 2, R = c - 1.5, r = rng(seed);
    for (var i = 0; i < N; i++) { var x = i % n, y = (i / n) | 0; M[i] = (x - c) * (x - c) + (y - c) * (y - c) < R * R ? 1 : 0; }
    function drop(cx, cy, rad) {
      for (var y = Math.floor(cy - rad); y <= cy + rad; y++) for (var x = Math.floor(cx - rad); x <= cx + rad; x++) {
        var j = y * n + x;
        if (x > 0 && y > 0 && x < n - 1 && y < n - 1 && M[j] && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad) { B[j] = 0.9; A[j] = 0.5; }
      }
    }
    for (var s = 0; s < n / 6; s++) { var a = r() * 6.283, rad = Math.sqrt(r()) * (c - 12); drop(c + Math.cos(a) * rad, c + Math.sin(a) * rad, 3); }
    var stops = [[0, [7, 6, 10]], [0.35, [20, 26, 43]], [0.5, [74, 51, 140]], [0.63, [199, 66, 128]], [0.78, [245, 128, 69]], [0.9, [255, 204, 143]], [1, [255, 245, 224]]];
    var lut = new Uint8ClampedArray(768);
    for (var q = 0; q < 256; q++) {
      var t = q / 255, k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      var u = clamp((t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]), 0, 1);
      for (var ch = 0; ch < 3; ch++) lut[q * 3 + ch] = stops[k][1][ch] + (stops[k + 1][1][ch] - stops[k][1][ch]) * u;
    }
    var off = doc.createElement("canvas"); off.width = off.height = n;
    var octx = off.getContext("2d"), img = octx.createImageData(n, n);
    var cv = doc.createElement("canvas"), ctx = cv.getContext("2d");
    host.appendChild(cv);
    var fades = [];
    var o = {
      step: function (iters) {
        for (var it = 0; it < iters; it++) {
          for (var y = 1; y < n - 1; y++) for (var x = 1; x < n - 1; x++) {
            var j = y * n + x;
            if (!M[j]) { A2[j] = 1; B2[j] = 0; continue; }
            var a = A[j], b = B[j];
            var la = 0.2 * (A[j - 1] + A[j + 1] + A[j - n] + A[j + n]) + 0.05 * (A[j - n - 1] + A[j - n + 1] + A[j + n - 1] + A[j + n + 1]) - a;
            var lb = 0.2 * (B[j - 1] + B[j + 1] + B[j - n] + B[j + n]) + 0.05 * (B[j - n - 1] + B[j - n + 1] + B[j + n - 1] + B[j + n + 1]) - b;
            var abb = a * b * b;
            A2[j] = a + la - abb + F * (1 - a); B2[j] = b + 0.5 * lb + abb - (K + F) * b;
          }
          var tA = A; A = A2; A2 = tA; var tB = B; B = B2; B2 = tB;
        }
        fades.forEach(function (z) {
          for (var y = Math.floor(z[1] - z[2]); y <= z[1] + z[2]; y++) for (var x = Math.floor(z[0] - z[2]); x <= z[0] + z[2]; x++) {
            if (x > 0 && y > 0 && x < n - 1 && y < n - 1 && (x - z[0]) * (x - z[0]) + (y - z[1]) * (y - z[1]) <= z[2] * z[2]) B[y * n + x] *= z[3];
          }
        });
        fades = [];
      },
      draw: function (lvl) {
        var d = img.data;
        for (var j = 0; j < N; j++) {
          var t = clamp((1 - (A[j] - B[j])) * 1.12, 0, 1), k = ((t * 255) | 0) * 3, p = j * 4, g = 0.82 + 0.4 * lvl;
          d[p] = lut[k] * g; d[p + 1] = lut[k + 1] * g; d[p + 2] = lut[k + 2] * g; d[p + 3] = 255;
        }
        octx.putImageData(img, 0, 0);
        var m = cv.width * 0.06;
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.drawImage(off, -m, -m, cv.width + 2 * m, cv.height + 2 * m);
      },
      feed: function (u, v) { drop(((u - 0.5) / 1.12 + 0.5) * n, ((v - 0.5) / 1.12 + 0.5) * n, 2.5); },
      cull: function (u, v, rad, k) { fades.push([u * n, (1 - v) * n, rad * n, k]); },
      fit: function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(host.clientWidth * dpr); cv.height = Math.round(host.clientHeight * dpr);
      }
    };
    o.fit();
    return o;
  }

  /* ---------- the breathing guide, over the culture ---------- */

  var RHYTHMS = {
    calm:   { rounds: 6, phases: [["in", 4], ["out", 6]] },
    box:    { rounds: 4, phases: [["in", 4], ["hold", 4], ["out", 4], ["hold", 4]] },
    unwind: { rounds: 4, phases: [["in", 4], ["hold", 7], ["out", 8]] }
  };
  var WORDS = { "in": "Breathe in", "out": "Breathe out", hold: "Hold" };

  function breathe() {
    var sec = $("#breathe");
    if (!sec) return;
    var scope = $(".scope", sec), dishEl = $(".scope-dish", sec), btn = $("#breatheBtn"), snd = $("#breatheSound");
    var lab = $("#breatheLabel"), cnt = $(".scope-count", sec), ring = $(".scope-ring circle", sec), chips = $$(".chip", sec);
    var cul = cultureGL(dishEl, small ? 256 : 360, 77) || cultureCPU(dishEl, small ? 130 : 160, 77);
    var gpu = !!cul.gpu;
    var lvl = 0, lastCull = 0, r = rng(5);
    cul.step(reduce ? 2600 : 700); cul.draw(0);
    onResize(dishEl, function () { cul.fit(); cul.draw(lvl); });

    var lastFeed = 0;
    function feed(e) {
      var now = performance.now();
      if (now - lastFeed < 80) return;
      lastFeed = now;
      var b = dishEl.getBoundingClientRect();
      cul.feed((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
      if (reduce) { cul.step(300); cul.draw(lvl); }
    }
    dishEl.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") feed(e); }, { passive: true });
    dishEl.addEventListener("pointerdown", feed, { passive: true });

    var rhythm = "calm", running = false, t0 = 0, lastPhase = "", audio = null, soundOn = false;
    function setLvl(v) { lvl = v; scope.style.setProperty("--lvl", v.toFixed(4)); }
    function setRing(v) { ring.style.strokeDashoffset = (1 - v).toFixed(4); }
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        rhythm = ch.getAttribute("data-rhythm");
        chips.forEach(function (o) { o.setAttribute("aria-pressed", o === ch ? "true" : "false"); });
        if (running) { stop(); start(); }
      });
    });
    // an optional soft tone that rises with the in-breath and falls with the out-breath
    function tone() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (audio || !AC) return;
      var ac = new AC(), g = ac.createGain(), lp = ac.createBiquadFilter(), o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain();
      lp.type = "lowpass"; lp.frequency.value = 700; g.gain.value = 0; g2.gain.value = 0.35;
      o1.type = o2.type = "sine"; o1.frequency.value = 174; o2.frequency.value = 261;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(ac.destination);
      o1.start(); o2.start();
      audio = { ac: ac, g: g, o1: o1, o2: o2 };
    }
    function sound(v) {
      if (!audio) return;
      var now = audio.ac.currentTime;
      audio.g.gain.setTargetAtTime(soundOn && running ? 0.012 + v * 0.05 : 0, now, 0.12);
      audio.o1.frequency.setTargetAtTime(160 + v * 60, now, 0.2);
      audio.o2.frequency.setTargetAtTime((160 + v * 60) * 1.5, now, 0.2);
    }
    snd.addEventListener("click", function () {
      soundOn = !soundOn;
      snd.setAttribute("aria-pressed", soundOn ? "true" : "false");
      snd.textContent = soundOn ? "Sound on" : "Sound off";
      if (soundOn) { tone(); if (audio && audio.ac.state === "suspended") audio.ac.resume(); }
      sound(lvl);
    });
    function start() {
      running = true; t0 = performance.now(); lastPhase = "";
      sec.classList.add("guided");
      btn.textContent = "Stop"; btn.setAttribute("aria-pressed", "true");
      if (soundOn) { tone(); if (audio && audio.ac.state === "suspended") audio.ac.resume(); }
      tick(t0);
    }
    function stop(msg) {
      running = false;
      sec.classList.remove("guided");
      btn.textContent = "Begin"; btn.setAttribute("aria-pressed", "false");
      lab.textContent = msg || ""; cnt.textContent = "";
      setLvl(0); setRing(0); sound(0);
      if (reduce) cul.draw(0);
    }
    btn.addEventListener("click", function () { if (running) stop(); else start(); });
    function tick(now) {
      var R = RHYTHMS[rhythm], cyc = 0, el = (now - t0) / 1000;
      R.phases.forEach(function (p) { cyc += p[1]; });
      var round = Math.floor(el / cyc);
      if (round >= R.rounds) { stop("Welcome back"); setTimeout(function () { if (!running) lab.textContent = ""; }, 3500); return; }
      var inCyc = el - round * cyc, k = 0, acc = 0;
      while (inCyc >= acc + R.phases[k][1]) { acc += R.phases[k][1]; k++; }
      var ph = R.phases[k], p = (inCyc - acc) / ph[1], prev = R.phases[(k - 1 + R.phases.length) % R.phases.length][0];
      var v = ph[0] === "in" ? ease(p) : ph[0] === "out" ? 1 - ease(p) : prev === "in" ? 1 : 0;
      setLvl(reduce ? 0 : v); setRing(v); sound(v);
      var key = round + ":" + k;
      if (key !== lastPhase) { lastPhase = key; lab.textContent = WORDS[ph[0]]; }
      cnt.textContent = Math.ceil(ph[1] - (inCyc - acc)) + "  ·  " + (round + 1) + " of " + R.rounds;
    }
    var lp = loop(function (now) {
      cul.step(gpu ? 14 : (small ? 7 : 9));
      // now and then a cluster quietly dies back, so the rest keep dividing to fill the space
      if (now - lastCull > 2800) { lastCull = now; cul.cull(0.5 + (r() - 0.5) * 0.6, 0.5 + (r() - 0.5) * 0.6, 0.06 + r() * 0.04, 0.9); }
      else cul.cull(0, 0, 0, 1);
      if (running) tick(now);
      cul.draw(lvl);
    });
    whileVisible(scope, lp.start, function () { lp.stop(); if (running) stop(); });
    if (reduce) setInterval(function () { if (running) tick(performance.now()); }, 250);
  }

  /* ---------- network: fascia / mycelium threads ---------- */

  function network(h, o) {
    function layer() {
      var c = doc.createElement("canvas"); h.appendChild(c);
      return { c: c, ctx: c.getContext("2d"), w: 0, h: 0 };
    }
    var net = layer(), top = layer(), ctx = net.ctx, tctx = top.ctx;
    var r, tips, paths, grid, gw, gh, G = 7, pulses = [], lastPulse = 0, spawned = 0, lastSpawn = 0;
    function fit(L) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      L.w = h.clientWidth; L.h = h.clientHeight;
      L.c.width = Math.round(L.w * dpr); L.c.height = Math.round(L.h * dpr);
      L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function cell(x, y) { var gx = (x / G) | 0, gy = (y / G) | 0; return gx < 0 || gy < 0 || gx >= gw || gy >= gh ? -1 : gy * gw + gx; }
    function tip(x, y, a, g, life) {
      var id = paths.length;
      paths.push([x, y]);
      tips.push({ x: x, y: y, a: a, g: g, life: life, age: 0, id: id, curl: (r() - 0.5) * 0.024 });
    }
    function soma(x, y, size) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      g.addColorStop(0, "rgba(" + o.glow + ",.6)"); g.addColorStop(0.35, "rgba(" + o.glow + ",.18)"); g.addColorStop(1, "rgba(" + o.glow + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size * 3, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(" + o.glow + ",.9)"; ctx.beginPath(); ctx.arc(x, y, size * 0.5, 0, 6.2832); ctx.fill();
    }
    function reset() {
      fit(net); fit(top);
      ctx.clearRect(0, 0, net.w, net.h);
      r = rng(o.seed); tips = []; paths = []; pulses = [];
      gw = Math.ceil(net.w / G) + 1; gh = Math.ceil(net.h / G) + 1;
      grid = new Int32Array(gw * gh).fill(-1);
      var W = net.w, H = net.h;
      for (var i = 0; i < o.count; i++) {
        var s = r(), x, y, a;
        if (s < 0.3) { x = r() * W; y = H + 4; a = -Math.PI / 2 + (r() - 0.5) * 1.2; }
        else if (s < 0.55) { x = -4; y = r() * H; a = (r() - 0.5) * 1.1; }
        else if (s < 0.8) { x = W + 4; y = r() * H; a = Math.PI + (r() - 0.5) * 1.1; }
        else { x = r() * W; y = -4; a = Math.PI / 2 + (r() - 0.5) * 1.2; }
        tip(x, y, a, 0, 320 + r() * 260);
      }
      for (var k = 0; k < o.somas; k++) {
        var sx = W * (0.06 + r() * 0.88), sy = H * (0.1 + r() * 0.8), arms = 3 + ((r() * 3) | 0), a0 = r() * 6.283;
        soma(sx, sy, 3 + r() * 3);
        for (var m = 0; m < arms; m++) tip(sx, sy, a0 + (m / arms) * 6.283 + (r() - 0.5) * 0.5, 1, 180 + r() * 220);
      }
    }
    function step() {
      var W = net.w, H = net.h, b = [[], [], [], [], [], []], fused = [];
      for (var i = tips.length - 1; i >= 0; i--) {
        var t = tips[i], ox = t.x, oy = t.y;
        t.a += (r() - 0.5) * 0.3 + t.curl;
        t.x += Math.cos(t.a) * 1.8; t.y += Math.sin(t.a) * 1.8; t.life--; t.age++;
        b[Math.min(5, t.g)].push(ox, oy, t.x, t.y);
        paths[t.id].push(t.x, t.y);
        var gc = cell(t.x, t.y), dead = t.life <= 0 || t.x < -30 || t.y < -30 || t.x > W + 30 || t.y > H + 30;
        if (gc >= 0 && !dead) {
          // two threads meeting fuse, the way hyphae and fascia knit together
          if (grid[gc] >= 0 && grid[gc] !== t.id && t.age > 40 && r() < 0.6) { fused.push(t.x, t.y); dead = true; }
          else grid[gc] = t.id;
        }
        if (!dead && t.g < 5 && tips.length < o.max && r() < 0.026 / (1 + t.g * 0.6))
          tip(t.x, t.y, t.a + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.6), t.g + 1, t.life * 0.75);
        if (dead) tips.splice(i, 1);
      }
      for (var g = 0; g < 6; g++) {
        var arr = b[g];
        if (!arr.length) continue;
        ctx.beginPath();
        for (var j = 0; j < arr.length; j += 4) { ctx.moveTo(arr[j], arr[j + 1]); ctx.lineTo(arr[j + 2], arr[j + 3]); }
        ctx.lineWidth = Math.max(0.4, 1.5 * Math.pow(0.74, g));
        ctx.strokeStyle = "rgba(" + o.color + "," + (o.alpha * (1 - g * 0.1)).toFixed(3) + ")";
        ctx.stroke();
      }
      if (fused.length) {
        ctx.fillStyle = "rgba(" + o.glow + ",.75)";
        ctx.beginPath();
        for (var f = 0; f < fused.length; f += 2) { ctx.moveTo(fused[f] + 1.8, fused[f + 1]); ctx.arc(fused[f], fused[f + 1], 1.8, 0, 6.2832); }
        ctx.fill();
      }
    }
    function drawTop(now) {
      tctx.clearRect(0, 0, top.w, top.h);
      tctx.shadowColor = "rgba(" + o.glow + ",.9)"; tctx.shadowBlur = 8;
      tctx.fillStyle = "rgba(" + o.glow + ",.9)";
      tctx.beginPath();
      for (var i = 0; i < tips.length; i++) { tctx.moveTo(tips[i].x + 1.3, tips[i].y); tctx.arc(tips[i].x, tips[i].y, 1.3, 0, 6.2832); }
      tctx.fill();
      if (now - lastPulse > 380 && pulses.length < 8 && paths.length) {
        lastPulse = now;
        var p = paths[(r() * paths.length) | 0];
        if (p.length > 90) pulses.push({ p: p, i: 0, v: 1.6 + r() * 1.4, c: r() < 0.5 ? o.glow : o.glow2 });
      }
      tctx.lineCap = "round";
      for (var k = pulses.length - 1; k >= 0; k--) {
        var q = pulses[k], pts = q.p;
        q.i += q.v;
        var head = Math.floor(q.i) * 2;
        if (head >= pts.length - 2) { pulses.splice(k, 1); continue; }
        var tail = Math.max(0, head - 40);
        tctx.shadowColor = "rgba(" + q.c + ",1)"; tctx.shadowBlur = 12;
        tctx.strokeStyle = "rgba(" + q.c + ",.55)"; tctx.lineWidth = 1.7;
        tctx.beginPath(); tctx.moveTo(pts[tail], pts[tail + 1]);
        for (var s = tail + 2; s <= head; s += 2) tctx.lineTo(pts[s], pts[s + 1]);
        tctx.stroke();
        tctx.fillStyle = "rgba(" + q.c + ",1)";
        tctx.beginPath(); tctx.arc(pts[head], pts[head + 1], 2.2, 0, 6.2832); tctx.fill();
      }
      tctx.shadowBlur = 0;
    }
    function finish() { var guard = 0; while (tips.length && guard++ < 4000) step(); tctx.clearRect(0, 0, top.w, top.h); }
    var lp = loop(function (now) { if (tips.length) { step(); step(); } drawTop(now); });
    reset();
    if (reduce) finish();
    whileVisible(h, lp.start, lp.stop);
    onResize(h, function () { var was = lp.on; lp.stop(); reset(); finish(); if (was) lp.start(); });
    if (!reduce) h.parentNode.addEventListener("pointermove", function (e) {
      var now = performance.now();
      if (now - lastSpawn < 70 || spawned > 320) return;
      lastSpawn = now; spawned++;
      var bb = h.getBoundingClientRect();
      tip(e.clientX - bb.left, e.clientY - bb.top, r() * 6.283, 2, 70 + r() * 80);
    }, { passive: true });
  }

  /* ---------- page furniture ---------- */

  function rail() {
    var items = $$(".rail li");
    if (!items.length || !hasIO) return;
    var by = {};
    items.forEach(function (li) { by[li.getAttribute("data-scale")] = li; });
    function set(k) { items.forEach(function (li) { li.classList.toggle("on", li === by[k]); }); }
    set("person");
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) set(e.target.getAttribute("data-scale")); });
    }, { rootMargin: "-48% 0px -48% 0px" });
    $$("[data-scale]").forEach(function (s) { if (s.tagName !== "LI") io.observe(s); });
  }

  function reveals() {
    $$(".rv, .lens, .frame").forEach(function (el) { once(el, function () { el.classList.add("in"); }); });
    $$(".index article").forEach(function (a) {
      a.addEventListener("pointermove", function (e) {
        var b = a.getBoundingClientRect();
        a.style.setProperty("--mx", (e.clientX - b.left) + "px");
      }, { passive: true });
    });
  }

  function navState() {
    var nav = $("nav");
    if (!nav) return;
    // over the light "room" sections the bar turns light too
    var ticking = false;
    function upd() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        nav.classList.toggle("solid", window.scrollY > 40);
        var under = doc.elementFromPoint(8, nav.offsetHeight + 2), sec = under && under.closest && under.closest(".room, .dawn");
        nav.classList.toggle("light", !!sec);
      });
    }
    addEventListener("scroll", upd, { passive: true });
    upd();
  }

  function voices() {
    var box = $("#voices");
    if (!box) return;
    var vs = $$(".voice", box), dots = $$(".voice-dots i"), i = 0, timer = 0, paused = false;
    function show(k) {
      i = (k + vs.length) % vs.length;
      vs.forEach(function (v, j) { v.classList.toggle("on", j === i); });
      dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
    }
    show(0);
    $$(".voice-nav button").forEach(function (b) {
      b.addEventListener("click", function () { show(i + (+b.getAttribute("data-dir"))); });
    });
    box.parentNode.addEventListener("pointerenter", function () { paused = true; });
    box.parentNode.addEventListener("pointerleave", function () { paused = false; });
    box.parentNode.addEventListener("focusin", function () { paused = true; });
    box.parentNode.addEventListener("focusout", function () { paused = false; });
    if (!reduce) whileVisible(box, function () {
      clearInterval(timer);
      timer = setInterval(function () { if (!paused) show(i + 1); }, 9000);
    }, function () { clearInterval(timer); });
  }

  /* ---------- boot ---------- */

  function safely(fn) { try { fn(); } catch (e) { if (window.console) console.warn("atlas.js:", e); } }
  safely(navState);
  safely(reveals);
  safely(rail);
  safely(voices);
  $$("[data-field]").forEach(function (el) { safely(function () { field(el); }); });
  $$("[data-net]").forEach(function (el) {
    safely(function () {
      network(el, { seed: 33, color: "110,205,195", glow: "255,160,110", glow2: "228,82,143", alpha: 0.2, count: 11, somas: 6, max: 280 });
    });
  });
  safely(breathe);
})();
