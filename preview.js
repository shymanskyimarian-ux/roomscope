/* ============================================================
   Roomscope — before/after renovation photo preview module
   Global: window.RoomscopePreview   Class prefix: rs-p-
   Plain JS, self-contained, no libs. Canvas-styled preview —
   "a look, not a promise". Safe to mount twice.
   ============================================================ */
(function () {
  "use strict";

  var STYLE_ID = "rs-p-style";

  /* ---------- catalog-facing constants ---------- */
  var PAINTS = [
    { name: "Warm White", hex: "#E8E2D4" },
    { name: "Sage",       hex: "#A3B18A" },
    { name: "Dusty Sky",  hex: "#9DB4C0" },
    { name: "Terracotta", hex: "#C77855" },
    { name: "Charcoal",   hex: "#4A4E52" },
    { name: "Butter",     hex: "#E7D8A1" }
  ];
  var FLOORS = [
    { name: "Light Oak",        hex: "#C9A87C", type: "vinyl",    sku: "vinyl plank flooring" },
    { name: "Warm Walnut",      hex: "#8B6748", type: "vinyl",    sku: "vinyl plank flooring" },
    { name: "Grey Wash",        hex: "#9A968F", type: "vinyl",    sku: "vinyl plank flooring" },
    { name: "Classic Laminate", hex: "#B08D5F", type: "laminate", sku: "laminate flooring" }
  ];

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return { r: 128, g: 128, b: 128 };
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function shade(rgb, f) {
    return {
      r: Math.max(0, Math.min(255, Math.round(rgb.r * f))),
      g: Math.max(0, Math.min(255, Math.round(rgb.g * f))),
      b: Math.max(0, Math.min(255, Math.round(rgb.b * f)))
    };
  }
  function rgba(rgb, a) {
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")";
  }
  /* deterministic pseudo-random in [0,1) — stable across renders */
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- one-time style injection ---------- */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = "" +
      ".rs-p-wrap{display:block}" +
      ".rs-p-stage{position:relative;aspect-ratio:4/3;border:1px solid var(--line,rgba(255,255,255,.08));background:var(--bg-2,#0e0f11);border-radius:3px;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:pan-y;cursor:ew-resize}" +
      ".rs-p-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}" +
      ".rs-p-after{will-change:clip-path}" +
      ".rs-p-divider{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--green,#76B900);box-shadow:0 0 14px var(--green-glow,rgba(118,185,0,.35));z-index:4;cursor:ew-resize;outline:none;touch-action:none}" +
      ".rs-p-divider:focus-visible{box-shadow:0 0 0 2px var(--green-bright,#93d61f),0 0 14px var(--green-glow,rgba(118,185,0,.35))}" +
      ".rs-p-grip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:22px;background:#0a0b0a;border:1px solid var(--green,#76B900);border-radius:2px;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 0 12px var(--green-glow,rgba(118,185,0,.35))}" +
      ".rs-p-grip i{display:block;width:4px;height:9px;background:var(--green,#76B900);transform:skewX(-20deg)}" +
      ".rs-p-chip{position:absolute;top:10px;z-index:3;pointer-events:none;font-family:var(--font-mono,monospace);font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;padding:.28rem .55rem;background:rgba(8,8,8,.78);border:1px solid var(--line-2,rgba(255,255,255,.14));color:var(--muted,#9a9ea6);border-radius:2px}" +
      ".rs-p-chip--before{left:10px}" +
      ".rs-p-chip--after{right:10px;color:var(--green,#76B900);border-color:rgba(118,185,0,.4)}" +
      ".rs-p-caption{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:3;pointer-events:none;white-space:nowrap;font-family:var(--font-mono,monospace);font-size:.62rem;letter-spacing:.08em;color:var(--muted-2,#6b6f77);background:rgba(8,8,8,.72);border:1px solid var(--line,rgba(255,255,255,.08));padding:.25rem .6rem;border-radius:2px}" +
      ".rs-p-note{position:absolute;left:10px;bottom:10px;z-index:3;pointer-events:none;font-family:var(--font-mono,monospace);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#9a9ea6);background:rgba(8,8,8,.72);border:1px dashed var(--line-2,rgba(255,255,255,.14));padding:.25rem .6rem;border-radius:2px}" +
      ".rs-p-note[hidden]{display:none}" +
      ".rs-p-controls{display:flex;flex-wrap:wrap;gap:1.4rem 2.2rem;margin-top:1rem;align-items:flex-start}" +
      ".rs-p-label{display:block;font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-2,#6b6f77);margin:0 0 .5rem}" +
      ".rs-p-swatches{display:flex;gap:.55rem;flex-wrap:wrap}" +
      ".rs-p-swatch{width:24px;height:24px;padding:0;border:1px solid var(--line-2,rgba(255,255,255,.14));border-radius:2px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;appearance:none;-webkit-appearance:none}" +
      ".rs-p-swatch:hover{transform:translateY(-1px)}" +
      ".rs-p-swatch:focus-visible{outline:2px solid var(--green-bright,#93d61f);outline-offset:3px}" +
      ".rs-p-swatch.rs-p-sel{box-shadow:0 0 0 2px var(--green,#76B900),0 0 10px var(--green-glow,rgba(118,185,0,.35));border-color:var(--green,#76B900)}" +
      ".rs-p-floorchips{display:flex;gap:.55rem;flex-wrap:wrap}" +
      ".rs-p-floorchip{display:inline-flex;align-items:center;gap:.45rem;font-family:var(--font-mono,monospace);font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#9a9ea6);background:var(--bg-2,#0e0f11);border:1px solid var(--line-2,rgba(255,255,255,.14));border-radius:2px;padding:.42rem .6rem;cursor:pointer;transition:border-color .15s ease,color .15s ease}" +
      ".rs-p-floorchip:hover{border-color:var(--green,#76B900)}" +
      ".rs-p-floorchip:focus-visible{outline:2px solid var(--green-bright,#93d61f);outline-offset:3px}" +
      ".rs-p-floorchip.rs-p-sel{border-color:var(--green,#76B900);color:var(--text,#F2F3F5);box-shadow:0 0 10px var(--green-glow,rgba(118,185,0,.35))}" +
      ".rs-p-fc-dot{width:12px;height:12px;flex:0 0 auto;border:1px solid rgba(0,0,0,.45);border-radius:1px}";
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ============================================================
     Instance
     ============================================================ */
  function Instance(container, opts) {
    opts = opts || {};
    this.container = container;
    this.onChange = opts.onChange;
    this.paint = PAINTS[0];
    this.floor = (opts.floorDefault === "laminate") ? FLOORS[3] : FLOORS[0];
    this.photoImg = null;
    this.photoFailed = false;
    this._raf = 0;
    this._dead = false;
    this._frac = 0.5;
    this._off = null;

    this.buildDom();
    this.bindEvents();
    this.loadPhoto(opts.photoDataUrl);
    this.scheduleRender();
  }

  Instance.prototype.buildDom = function () {
    var i, p, f, html = "";
    html += '<div class="rs-p-wrap">';
    html += '<div class="rs-p-stage">';
    html += '<canvas class="rs-p-base" aria-hidden="true"></canvas>';
    html += '<canvas class="rs-p-after" aria-hidden="true"></canvas>';
    html += '<span class="rs-p-chip rs-p-chip--before">Before</span>';
    html += '<span class="rs-p-chip rs-p-chip--after">After</span>';
    html += '<div class="rs-p-divider" role="slider" tabindex="0" aria-label="Before and after divider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="rs-p-grip"><i></i><i></i></span></div>';
    html += '<span class="rs-p-caption">styled preview &mdash; a look, not a promise</span>';
    html += '<span class="rs-p-note" hidden></span>';
    html += "</div>";
    html += '<div class="rs-p-controls">';
    html += '<div class="rs-p-group"><span class="rs-p-label">Wall paint</span><div class="rs-p-swatches">';
    for (i = 0; i < PAINTS.length; i++) {
      p = PAINTS[i];
      html += '<button type="button" class="rs-p-swatch' + (p === this.paint ? " rs-p-sel" : "") +
        '" data-rs-paint="' + i + '" title="' + esc(p.name) + '" aria-label="Wall paint: ' + esc(p.name) +
        '" aria-pressed="' + (p === this.paint ? "true" : "false") +
        '" style="background:' + esc(p.hex) + '"></button>';
    }
    html += "</div></div>";
    html += '<div class="rs-p-group"><span class="rs-p-label">Floor</span><div class="rs-p-floorchips">';
    for (i = 0; i < FLOORS.length; i++) {
      f = FLOORS[i];
      html += '<button type="button" class="rs-p-floorchip' + (f === this.floor ? " rs-p-sel" : "") +
        '" data-rs-floor="' + i + '" aria-pressed="' + (f === this.floor ? "true" : "false") +
        '"><span class="rs-p-fc-dot" style="background:' + esc(f.hex) + '"></span>' + esc(f.name) + "</button>";
    }
    html += "</div></div>";
    html += "</div></div>";

    this.container.innerHTML = html;
    this.stage = this.container.querySelector(".rs-p-stage");
    this.baseCv = this.container.querySelector(".rs-p-base");
    this.afterCv = this.container.querySelector(".rs-p-after");
    this.divider = this.container.querySelector(".rs-p-divider");
    this.noteEl = this.container.querySelector(".rs-p-note");
    this.setFrac(0.5);
  };

  Instance.prototype.bindEvents = function () {
    var self = this;

    /* drag: pointer events cover mouse + touch + pen */
    this._onDown = function (ev) {
      if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === "mouse") return;
      ev.preventDefault();
      var rect = self.stage.getBoundingClientRect();
      if (!rect.width) return;
      var move = function (e) {
        self.setFrac((e.clientX - rect.left) / rect.width);
      };
      var up = function (e) {
        self.stage.removeEventListener("pointermove", move);
        self.stage.removeEventListener("pointerup", up);
        self.stage.removeEventListener("pointercancel", up);
        try { self.stage.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      try { self.stage.setPointerCapture(ev.pointerId); } catch (err) {}
      self.stage.addEventListener("pointermove", move);
      self.stage.addEventListener("pointerup", up);
      self.stage.addEventListener("pointercancel", up);
      move(ev);
    };
    this.stage.addEventListener("pointerdown", this._onDown);

    /* keyboard on the divider */
    this._onKey = function (ev) {
      if (ev.key === "ArrowLeft") { self.setFrac(self._frac - 0.03); ev.preventDefault(); }
      else if (ev.key === "ArrowRight") { self.setFrac(self._frac + 0.03); ev.preventDefault(); }
    };
    this.divider.addEventListener("keydown", this._onKey);

    /* controls (event delegation on the container) */
    this._onClick = function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-rs-paint],[data-rs-floor]") : null;
      if (!btn || !self.container.contains(btn)) return;
      var pi = btn.getAttribute("data-rs-paint");
      var fi = btn.getAttribute("data-rs-floor");
      if (pi !== null) {
        var pk = parseInt(pi, 10);
        if (PAINTS[pk] && PAINTS[pk] !== self.paint) {
          self.paint = PAINTS[pk];
          self.markActive();
          self.syncSelection();
          self.scheduleRender();
          self.fireChange();
        }
      } else if (fi !== null) {
        var fk = parseInt(fi, 10);
        if (FLOORS[fk] && FLOORS[fk] !== self.floor) {
          self.floor = FLOORS[fk];
          self.markActive();
          self.syncSelection();
          self.scheduleRender();
          self.fireChange();
        }
      }
    };
    this.container.addEventListener("click", this._onClick);

    /* re-render when the stage resizes */
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(function () { self.scheduleRender(); });
      this._ro.observe(this.stage);
    } else {
      this._onWinResize = function () { self.scheduleRender(); };
      window.addEventListener("resize", this._onWinResize);
    }
  };

  /* the instance the user last touched becomes the one getState() reads */
  Instance.prototype.markActive = function () {
    activeInstance = this;
  };

  Instance.prototype.syncSelection = function () {
    var self = this;
    var sw = this.container.querySelectorAll("[data-rs-paint]");
    var fc = this.container.querySelectorAll("[data-rs-floor]");
    Array.prototype.forEach.call(sw, function (b) {
      var on = PAINTS[parseInt(b.getAttribute("data-rs-paint"), 10)] === self.paint;
      b.classList.toggle("rs-p-sel", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(fc, function (b) {
      var on = FLOORS[parseInt(b.getAttribute("data-rs-floor"), 10)] === self.floor;
      b.classList.toggle("rs-p-sel", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  };

  Instance.prototype.setFrac = function (f) {
    this._frac = clamp(f, 0.06, 0.94);
    var pct = (this._frac * 100).toFixed(2) + "%";
    this.divider.style.left = pct;
    this.afterCv.style.clipPath = "inset(0 0 0 " + pct + ")";
    this.afterCv.style.webkitClipPath = "inset(0 0 0 " + pct + ")";
    this.divider.setAttribute("aria-valuenow", String(Math.round(this._frac * 100)));
  };

  Instance.prototype.loadPhoto = function (dataUrl) {
    if (!dataUrl || typeof dataUrl !== "string") return;
    var self = this;
    var img = new Image();
    img.onload = function () {
      if (self._dead) return;
      if (!img.naturalWidth || !img.naturalHeight) { fail(); return; }
      self.photoImg = img;
      self.photoFailed = false;
      self.noteEl.hidden = true;
      self.scheduleRender();
    };
    function fail() {
      if (self._dead) return;
      self.photoImg = null;
      self.photoFailed = true;
      self.noteEl.textContent = "photo failed to load — demo room shown";
      self.noteEl.hidden = false;
      self.scheduleRender();
    }
    img.onerror = fail;
    try { img.src = dataUrl; } catch (e) { fail(); }
  };

  Instance.prototype.fireChange = function () {
    if (typeof this.onChange === "function") {
      try { this.onChange(this.getState()); } catch (e) { /* consumer error must not break the module */ }
    }
  };

  Instance.prototype.getState = function () {
    return {
      paintName: this.paint.name,
      paintHex: this.paint.hex,
      floorName: this.floor.name,
      floorSku: this.floor.sku
    };
  };

  /* ---------- rendering ---------- */
  Instance.prototype.scheduleRender = function () {
    if (this._raf || this._dead) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      if (!self._dead) self.renderNow();
    });
  };

  Instance.prototype.renderNow = function () {
    var rect = this.stage.getBoundingClientRect();
    var cssW = rect.width || this.stage.clientWidth || 0;
    if (cssW < 10) return; /* hidden — ResizeObserver re-triggers when visible */
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(320, Math.min(1400, Math.round(cssW * dpr)));
    var H = Math.round(W * 0.75);

    if (this.baseCv.width !== W || this.baseCv.height !== H) {
      this.baseCv.width = W; this.baseCv.height = H;
      this.afterCv.width = W; this.afterCv.height = H;
    }
    var bc = this.baseCv.getContext("2d");
    var ac = this.afterCv.getContext("2d");
    if (!bc || !ac) return;

    bc.clearRect(0, 0, W, H);
    this.drawBefore(bc, W, H);

    ac.clearRect(0, 0, W, H);
    this.drawBefore(ac, W, H);
    this.drawWallTint(ac, W, H);
    this.drawFloorOverlay(ac, W, H);
  };

  Instance.prototype.drawBefore = function (ctx, W, H) {
    if (this.photoImg) {
      var img = this.photoImg;
      var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      drawRoomIllustration(ctx, W, H);
    }
  };

  /* walls: multiply-blend the paint over the top ~62% with soft vertical falloff */
  Instance.prototype.drawWallTint = function (ctx, W, H) {
    var rgb = hexToRgb(this.paint.hex);
    var wallBottom = H * 0.68;
    ctx.save();

    ctx.globalCompositeOperation = "multiply";
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(rgb, 0.45));
    g.addColorStop(0.46, rgba(rgb, 0.45));
    g.addColorStop(0.66, rgba(rgb, 0));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, wallBottom);

    /* faint straight tint so the hue reads on dark photos too */
    ctx.globalCompositeOperation = "source-over";
    var g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, rgba(rgb, 0.10));
    g2.addColorStop(0.46, rgba(rgb, 0.10));
    g2.addColorStop(0.64, rgba(rgb, 0));
    g2.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, wallBottom);

    ctx.restore();
  };

  /* floor: perspective plank pattern over the bottom ~38%, soft top blend edge */
  Instance.prototype.drawFloorOverlay = function (ctx, W, H) {
    var horizon = H * 0.62;
    if (!this._off) this._off = document.createElement("canvas");
    var off = this._off;
    if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
    var o = off.getContext("2d");
    if (!o) return;
    o.save();
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "source-over";
    o.clearRect(0, 0, W, H);

    drawPlanks(o, W, H, horizon, hexToRgb(this.floor.hex));

    /* soft blend edge where floor meets walls */
    o.globalCompositeOperation = "destination-in";
    var mg = o.createLinearGradient(0, horizon - H * 0.012, 0, horizon + H * 0.055);
    mg.addColorStop(0, "rgba(0,0,0,0)");
    mg.addColorStop(1, "rgba(0,0,0,1)");
    o.fillStyle = mg;
    o.fillRect(0, 0, W, H);
    o.restore();

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  };

  function drawPlanks(o, W, H, horizon, rgb) {
    var top = horizon - H * 0.015;
    var vpX = W * 0.5, vpY = horizon - H * 0.45;
    var x0 = -W * 0.55, bw = W * 2.1, cols = 11;
    var lw = Math.max(1, W * 0.0013);

    function xAt(bx, y) {
      var k = (y - vpY) / (H - vpY);
      return vpX + (bx - vpX) * k;
    }

    /* safety base fill so corners are always covered */
    o.fillStyle = rgba(shade(rgb, 0.92), 1);
    o.fillRect(0, top, W, H - top);

    for (var i = 0; i < cols; i++) {
      var bA = x0 + bw * i / cols;
      var bB = x0 + bw * (i + 1) / cols;
      var lum = 1 + (hash(i * 17 + 3) - 0.5) * 0.2; /* subtle per-plank variation */

      o.beginPath();
      o.moveTo(xAt(bA, top), top);
      o.lineTo(xAt(bB, top), top);
      o.lineTo(xAt(bB, H), H);
      o.lineTo(xAt(bA, H), H);
      o.closePath();
      o.fillStyle = rgba(shade(rgb, lum), 1);
      o.fill();

      /* thin dark seam along the right edge (converging to the vanishing point) */
      o.strokeStyle = "rgba(24,16,8,0.5)";
      o.lineWidth = lw;
      o.beginPath();
      o.moveTo(xAt(bB, top), top);
      o.lineTo(xAt(bB, H), H);
      o.stroke();

      /* staggered butt joints inside the plank */
      var joints = 2 + Math.floor(hash(i * 31 + 7) * 2);
      for (var j = 1; j <= joints; j++) {
        var s = hash(i * 57 + j * 23 + 11);
        var e = Math.pow(0.12 + 0.82 * s, 1.6); /* perspective-compressed spacing */
        var y = top + (H - top) * e;
        var xl = xAt(bA, y), xr = xAt(bB, y);
        o.strokeStyle = "rgba(24,16,8,0.4)";
        o.lineWidth = lw;
        o.beginPath();
        o.moveTo(xl + lw, y);
        o.lineTo(xr - lw, y);
        o.stroke();
      }
    }
    /* leftmost seam */
    o.strokeStyle = "rgba(24,16,8,0.5)";
    o.lineWidth = lw;
    o.beginPath();
    o.moveTo(xAt(x0, top), top);
    o.lineTo(xAt(x0, H), H);
    o.stroke();

    /* depth shading: darker toward the wall line */
    var sg = o.createLinearGradient(0, top, 0, H);
    sg.addColorStop(0, "rgba(0,0,0,0.32)");
    sg.addColorStop(0.5, "rgba(0,0,0,0.06)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = sg;
    o.fillRect(0, top, W, H - top);

    /* faint sheen near the viewer */
    var hg = o.createLinearGradient(0, top, 0, H);
    hg.addColorStop(0, "rgba(255,255,255,0)");
    hg.addColorStop(1, "rgba(255,255,255,0.05)");
    o.fillStyle = hg;
    o.fillRect(0, top, W, H - top);
  }

  /* built-in flat illustration: back wall rectangle + floor trapezoid (landing wireframe style) */
  function drawRoomIllustration(ctx, W, H) {
    var bwX0 = W * 0.20, bwX1 = W * 0.80, bwY0 = H * 0.14, bwY1 = H * 0.62;

    /* ceiling */
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(bwX1, bwY0); ctx.lineTo(bwX0, bwY0);
    ctx.closePath(); ctx.fillStyle = "#d9d6cd"; ctx.fill();
    /* left wall */
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(bwX0, bwY0); ctx.lineTo(bwX0, bwY1); ctx.lineTo(0, H);
    ctx.closePath(); ctx.fillStyle = "#bbb8af"; ctx.fill();
    /* right wall */
    ctx.beginPath();
    ctx.moveTo(W, 0); ctx.lineTo(bwX1, bwY0); ctx.lineTo(bwX1, bwY1); ctx.lineTo(W, H);
    ctx.closePath(); ctx.fillStyle = "#b0ada4"; ctx.fill();
    /* back wall */
    ctx.fillStyle = "#c8c5bc";
    ctx.fillRect(bwX0, bwY0, bwX1 - bwX0, bwY1 - bwY0);
    /* floor trapezoid */
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(bwX0, bwY1); ctx.lineTo(bwX1, bwY1); ctx.lineTo(W, H);
    ctx.closePath(); ctx.fillStyle = "#94908a"; ctx.fill();

    /* room edges */
    var lw = Math.max(1, W * 0.0018);
    ctx.strokeStyle = "rgba(40,38,34,0.5)";
    ctx.lineWidth = lw;
    ctx.strokeRect(bwX0, bwY0, bwX1 - bwX0, bwY1 - bwY0);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(bwX0, bwY0);
    ctx.moveTo(W, 0); ctx.lineTo(bwX1, bwY0);
    ctx.moveTo(0, H); ctx.lineTo(bwX0, bwY1);
    ctx.moveTo(W, H); ctx.lineTo(bwX1, bwY1);
    ctx.stroke();

    /* baseboard */
    ctx.strokeStyle = "rgba(70,66,60,0.55)";
    ctx.lineWidth = lw * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(bwX0, bwY1); ctx.lineTo(bwX1, bwY1); ctx.lineTo(W, H);
    ctx.stroke();

    /* window on the back wall */
    var wx = bwX0 + (bwX1 - bwX0) * 0.14;
    var wy = bwY0 + (bwY1 - bwY0) * 0.14;
    var ww = (bwX1 - bwX0) * 0.30;
    var wh = (bwY1 - bwY0) * 0.46;
    ctx.fillStyle = "#dde4e8";
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = "#5a574f";
    ctx.lineWidth = lw * 1.6;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

    /* picture frame on the right side of the back wall */
    var fx = bwX0 + (bwX1 - bwX0) * 0.62;
    var fy = bwY0 + (bwY1 - bwY0) * 0.20;
    var fw = (bwX1 - bwX0) * 0.16;
    var fh = (bwY1 - bwY0) * 0.24;
    ctx.fillStyle = "#a8a49b";
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = "#5a574f";
    ctx.lineWidth = lw * 1.4;
    ctx.strokeRect(fx, fy, fw, fh);

    /* soft vignette */
    var vg = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.25, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.20)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- teardown ---------- */
  Instance.prototype.destroy = function () {
    this._dead = true;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._ro) { try { this._ro.disconnect(); } catch (e) {} this._ro = null; }
    if (this._onWinResize) { window.removeEventListener("resize", this._onWinResize); this._onWinResize = null; }
    if (this.stage && this._onDown) this.stage.removeEventListener("pointerdown", this._onDown);
    if (this.divider && this._onKey) this.divider.removeEventListener("keydown", this._onKey);
    if (this.container && this._onClick) this.container.removeEventListener("click", this._onClick);
  };

  /* ============================================================
     Public API — the single global
     ============================================================ */
  var instances = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
  var activeInstance = null;

  window.RoomscopePreview = {
    /**
     * mount(containerEl, { photoDataUrl, floorDefault, onChange })
     * Re-mounting on the same container replaces its content.
     */
    mount: function (containerEl, opts) {
      if (!containerEl || containerEl.nodeType !== 1) return;
      injectStyle();
      if (instances) {
        var prev = instances.get(containerEl);
        if (prev) prev.destroy();
      } else if (activeInstance && activeInstance.container === containerEl) {
        activeInstance.destroy();
      }
      var inst = new Instance(containerEl, opts || {});
      if (instances) instances.set(containerEl, inst);
      activeInstance = inst;
    },

    /** getState() -> { paintName, paintHex, floorName, floorSku } */
    getState: function () {
      if (activeInstance && !activeInstance._dead) return activeInstance.getState();
      return {
        paintName: PAINTS[0].name,
        paintHex: PAINTS[0].hex,
        floorName: FLOORS[0].name,
        floorSku: FLOORS[0].sku
      };
    }
  };
})();
