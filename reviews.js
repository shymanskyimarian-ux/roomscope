/* ============================================================
   Roomscope Reviews — self-contained wall + submission modal.
   - Exposes exactly ONE global: window.RoomscopeReviews
   - Storage: localStorage["roomscope_reviews"]
   - All class names prefixed rs-r- ; injects its own <style>.
   - Reuses host CSS vars (--bg-2, --card, --line, --green, ...)
     and host .btn / .btn-primary / .btn-ghost button classes.
   ============================================================ */
(function () {
  "use strict";

  // Guard: loading/mounting the script twice must not break anything.
  if (window.RoomscopeReviews) return;

  var LS_KEY = "roomscope_reviews";
  var STYLE_ID = "rs-r-styles";
  var ROOMS = ["living room", "bedroom", "office", "dining room", "hallway", "other"];
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  var memStore = null;   // in-memory fallback when localStorage is unavailable
  var walls = [];        // mounted walls: [{el, opts}]
  var lastMinStars = 4;  // wall threshold, drives honest toast wording
  var M = null;          // modal refs, built lazily
  var toastEl = null;
  var toastTimer = 0;

  /* ---------------- utils ---------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function clampStars(v) {
    v = Math.round(Number(v) || 0);
    return Math.max(1, Math.min(5, v));
  }

  function currentYM() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function fmtDate(d) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(d || ""));
    if (!m) return esc(String(d || ""));
    var mi = parseInt(m[2], 10) - 1;
    return (MONTHS[mi] || esc(m[2])) + " " + m[1];
  }

  function sanitizeRecord(rec) {
    rec = rec || {};
    return {
      stars: clampStars(rec.stars),
      name: String(rec.name || "").replace(/\s+/g, " ").trim().slice(0, 40),
      text: String(rec.text || "").trim().slice(0, 400),
      room: ROOMS.indexOf(rec.room) !== -1 ? rec.room : "other",
      date: /^\d{4}-\d{2}$/.test(String(rec.date || "")) ? rec.date : currentYM(),
      beta: !!rec.beta
    };
  }

  function normRoom(v) {
    v = String(v || "").toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (v === "home office") v = "office";
    return ROOMS.indexOf(v) !== -1 ? v : "";
  }

  /* ---------------- storage ---------------- */

  function seedData() {
    // Honest pre-launch feedback from beta testers (beta:true → labeled
    // "BETA TESTER" on every card so nobody mistakes these for customers).
    return [
      { stars: 5, name: "Dana K.", room: "living room", date: "2026-05",
        text: "I typed in real measurements, dropped a photo, and had a materials list with actual quantities in about two minutes. The paint math landed within a gallon of what my contractor quoted.", beta: true },
      { stars: 4, name: "Marcus T.", room: "office", date: "2026-05",
        text: "Solid first pass. I like that the flooring waste assumption is printed right on the estimate instead of hidden. Would love labor pricing too — it is materials-only for now.", beta: true },
      { stars: 5, name: "Priya S.", room: "bedroom", date: "2026-06",
        text: "Ran it on two bedrooms before repainting. Printing the plan and handing it to my painter was the killer feature.", beta: true },
      { stars: 4, name: "Jon B.", room: "hallway", date: "2026-06",
        text: "Scanned our hallway on a whim. Quantities were sane, and the step-by-step playbook saved me a second trip to the hardware store for spackle I would have forgotten.", beta: true },
      { stars: 5, name: "Elena R.", room: "dining room", date: "2026-06",
        text: "I have never renovated anything, and the confirm-the-scope step kept me from over-buying. It is upfront about what is mocked versus computed, which honestly builds more trust than a polished black box would.", beta: true }
    ];
  }

  function save(arr) {
    memStore = arr;
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { /* private mode / quota — keep in-memory */ }
  }

  function readAll() {
    var arr = null, raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; }
    if (raw != null) {
      try { arr = JSON.parse(raw); } catch (e) { arr = null; }
    }
    if (Array.isArray(arr)) {
      memStore = arr;
      return arr;
    }
    if (Array.isArray(memStore)) return memStore;
    // First load (key missing or unreadable): seed with labeled beta feedback.
    arr = seedData();
    save(arr);
    return arr;
  }

  // Newest first: by date desc, then by insertion order desc within a month.
  function sorted(list) {
    return list
      .map(function (r, i) { return { r: r, i: i }; })
      .sort(function (a, b) {
        var d = String(b.r.date || "").localeCompare(String(a.r.date || ""));
        return d !== 0 ? d : (b.i - a.i);
      })
      .map(function (x) { return x.r; });
  }

  /* ---------------- styles ---------------- */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = "" +
      /* ---- wall ---- */
      ".rs-r-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}" +
      "@media(max-width:1000px){.rs-r-grid{grid-template-columns:repeat(2,1fr)}}" +
      "@media(max-width:640px){.rs-r-grid{grid-template-columns:1fr}}" +
      ".rs-r-card{background:var(--card);border:1px solid var(--line);border-radius:3px;padding:1.15rem 1.2rem 1rem;display:flex;flex-direction:column;gap:.65rem;transition:border-color .15s ease}" +
      ".rs-r-card:hover{border-color:var(--line-2)}" +
      ".rs-r-starrow{display:flex;gap:5px;align-items:center;min-height:11px}" +
      ".rs-r-sq{display:inline-block;width:13px;height:9px;background:var(--green);transform:skewX(-20deg);box-shadow:0 0 10px var(--green-glow)}" +
      ".rs-r-sq.rs-r-off{background:rgba(255,255,255,.1);box-shadow:none}" +
      ".rs-r-text{font-family:var(--font-body);font-size:.95rem;color:var(--muted);line-height:1.55;flex:1;margin:0}" +
      ".rs-r-cfoot{display:flex;align-items:baseline;justify-content:space-between;gap:.6rem .8rem;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:.7rem}" +
      ".rs-r-name{font-family:var(--font-display);font-weight:700;font-size:.92rem;letter-spacing:.01em;color:var(--text)}" +
      ".rs-r-meta{display:inline-flex;gap:.6rem;align-items:baseline;flex-wrap:wrap;font-family:var(--font-mono);font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2)}" +
      ".rs-r-beta{color:var(--green);border:1px solid rgba(118,185,0,.4);padding:.12rem .42rem;letter-spacing:.14em;white-space:nowrap}" +
      ".rs-r-note{margin-top:1.1rem;text-align:center;font-family:var(--font-mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2)}" +
      ".rs-r-empty{border:1px dashed var(--line-2);border-radius:3px;padding:2rem 1rem;text-align:center;font-family:var(--font-mono);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2)}" +
      /* ---- modal ---- */
      ".rs-r-overlay{position:fixed;inset:0;z-index:220;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1.25rem;opacity:0;transition:opacity .18s ease}" +
      ".rs-r-overlay[hidden]{display:none}" +
      ".rs-r-overlay.rs-r-open{opacity:1}" +
      ".rs-r-modal{background:var(--card);border:1px solid var(--line-2);border-radius:3px;width:100%;max-width:480px;max-height:calc(100vh - 3rem);overflow:auto;padding:1.5rem 1.5rem 1.4rem;transform:translateY(12px);transition:transform .18s ease}" +
      ".rs-r-overlay.rs-r-open .rs-r-modal{transform:none}" +
      ".rs-r-mhead{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.4rem}" +
      ".rs-r-mtitle{font-family:var(--font-display);font-weight:800;font-size:1.25rem;letter-spacing:-.01em;margin:0;display:flex;align-items:center;gap:.55rem}" +
      ".rs-r-mtitle::before{content:\"\";width:14px;height:9px;background:var(--green);transform:skewX(-20deg);box-shadow:0 0 12px var(--green-glow);flex:0 0 auto}" +
      ".rs-r-x{appearance:none;background:transparent;border:1px solid var(--line-2);color:var(--muted);width:30px;height:30px;border-radius:2px;cursor:pointer;font-size:1rem;line-height:1;display:inline-flex;align-items:center;justify-content:center;transition:border-color .15s ease,color .15s ease;flex:0 0 auto}" +
      ".rs-r-x:hover{border-color:var(--green);color:var(--green)}" +
      ".rs-r-x:focus-visible{outline:2px solid var(--green-bright);outline-offset:2px}" +
      ".rs-r-mnote{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.08em;color:var(--muted-2);margin:0 0 1.2rem;text-transform:uppercase;line-height:1.8}" +
      ".rs-r-fld{margin-bottom:1.05rem}" +
      ".rs-r-form label{display:block;font-family:var(--font-mono);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);margin:0 0 .45rem}" +
      ".rs-r-form input[type=text],.rs-r-form select,.rs-r-form textarea{width:100%;background:var(--bg-2);border:1px solid var(--line-2);color:var(--text);font-family:var(--font-mono);font-size:.92rem;padding:.65rem .8rem;border-radius:2px;outline:none;box-sizing:border-box;transition:border-color .18s ease,box-shadow .18s ease}" +
      ".rs-r-form textarea{font-family:var(--font-body);font-size:.92rem;line-height:1.55;min-height:110px;resize:vertical}" +
      ".rs-r-form input:focus,.rs-r-form select:focus,.rs-r-form textarea:focus{border-color:var(--green);box-shadow:0 0 0 1px var(--green)}" +
      ".rs-r-form select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 18px) 55%,calc(100% - 13px) 55%;background-size:5px 5px;background-repeat:no-repeat}" +
      ".rs-r-starin{display:flex;gap:.4rem}" +
      ".rs-r-star{appearance:none;background:transparent;border:none;padding:.3rem .18rem;margin:0;cursor:pointer;display:inline-flex;border-radius:2px}" +
      ".rs-r-star i{display:block;width:24px;height:16px;background:rgba(255,255,255,.1);transform:skewX(-20deg);transition:background .12s ease,box-shadow .12s ease}" +
      ".rs-r-star.rs-r-lit i{background:var(--green);box-shadow:0 0 10px var(--green-glow)}" +
      ".rs-r-star:focus-visible{outline:2px solid var(--green-bright);outline-offset:2px}" +
      ".rs-r-count{margin-top:.35rem;font-family:var(--font-mono);font-size:.66rem;letter-spacing:.1em;color:var(--muted-2);text-align:right}" +
      ".rs-r-err{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--red,#e5533d);border:1px solid rgba(229,83,61,.35);background:rgba(229,83,61,.06);padding:.55rem .75rem;border-radius:2px;margin-bottom:1.05rem}" +
      ".rs-r-err[hidden]{display:none}" +
      ".rs-r-actions{display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1.2rem}" +
      /* ---- toast ---- */
      ".rs-r-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,12px);z-index:300;background:#0b0c0e;border:1px solid var(--green);color:var(--text);font-family:var(--font-mono);font-size:.72rem;letter-spacing:.08em;padding:.7rem 1.05rem;border-radius:2px;box-shadow:0 8px 30px rgba(0,0,0,.5),0 0 14px var(--green-glow);opacity:0;transition:opacity .2s ease,transform .2s ease;max-width:min(92vw,480px);text-align:center;pointer-events:none}" +
      ".rs-r-toast.rs-r-on{opacity:1;transform:translate(-50%,0)}" +
      "@media(prefers-reduced-motion:reduce){.rs-r-overlay,.rs-r-modal,.rs-r-toast,.rs-r-card,.rs-r-star i{transition:none!important}}";
    var tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ---------------- wall ---------------- */

  function starRowHTML(n) {
    n = clampStars(n);
    var out = '<span class="rs-r-starrow" role="img" aria-label="' + n + ' out of 5 stars">';
    for (var i = 1; i <= 5; i++) {
      out += '<i class="rs-r-sq' + (i <= n ? "" : " rs-r-off") + '" aria-hidden="true"></i>';
    }
    return out + "</span>";
  }

  function cardHTML(r) {
    var beta = r.beta ? '<span class="rs-r-beta">BETA TESTER</span>' : "";
    return '<article class="rs-r-card">' +
      starRowHTML(r.stars) +
      '<p class="rs-r-text">' + esc(r.text) + "</p>" +
      '<div class="rs-r-cfoot">' +
        '<span class="rs-r-name">' + esc(r.name) + "</span>" +
        '<span class="rs-r-meta">' +
          "<span>" + esc(r.room) + "</span>" +
          "<span>" + fmtDate(r.date) + "</span>" +
          beta +
        "</span>" +
      "</div>" +
    "</article>";
  }

  function renderWall(w) {
    var all = readAll().map(sanitizeRecord);
    var shown = sorted(all).filter(function (r) { return r.stars >= w.opts.minStars; }).slice(0, w.opts.max);
    var foot = '<div class="rs-r-note">showing ' + w.opts.minStars + "★+ reviews · " + all.length + " total</div>";
    w.el.innerHTML = shown.length
      ? '<div class="rs-r-grid">' + shown.map(cardHTML).join("") + "</div>" + foot
      : '<div class="rs-r-empty">No reviews on the wall yet — be the first</div>' + foot;
  }

  function mountWall(el, opts) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el || el.nodeType !== 1) return;
    injectStyles();
    opts = opts || {};
    var o = {
      minStars: Math.max(1, Math.min(5, Math.round(Number(opts.minStars)) || 4)),
      max: Math.max(1, Math.round(Number(opts.max)) || 6)
    };
    lastMinStars = o.minStars;
    var found = null;
    for (var i = 0; i < walls.length; i++) if (walls[i].el === el) { found = walls[i]; break; }
    if (found) found.opts = o; else walls.push(found = { el: el, opts: o });
    el.classList.add("rs-r-wall");
    renderWall(found);
  }

  function refreshWall() {
    // prune walls detached from the document, re-render the rest
    walls = walls.filter(function (w) { return document.contains(w.el); });
    walls.forEach(renderWall);
  }

  /* ---------------- toast ---------------- */

  function toast(msg) {
    injectStyles();
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = 0; }
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    toastEl = document.createElement("div");
    toastEl.className = "rs-r-toast";
    toastEl.setAttribute("role", "status");
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    // force a style flush so the transition runs
    void toastEl.offsetWidth;
    toastEl.classList.add("rs-r-on");
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.classList.remove("rs-r-on");
      toastTimer = setTimeout(function () {
        if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        toastEl = null;
        toastTimer = 0;
      }, 260);
    }, 3600);
  }

  /* ---------------- modal ---------------- */

  function buildModal() {
    if (M) return;
    injectStyles();

    var ov = document.createElement("div");
    ov.className = "rs-r-overlay";
    ov.hidden = true;
    ov.innerHTML =
      '<div class="rs-r-modal" role="dialog" aria-modal="true" aria-labelledby="rs-r-mtitle">' +
        '<div class="rs-r-mhead">' +
          '<h3 class="rs-r-mtitle" id="rs-r-mtitle">Leave a review</h3>' +
          '<button type="button" class="rs-r-x" aria-label="Close">×</button>' +
        "</div>" +
        '<p class="rs-r-mnote"></p>' +
        '<form class="rs-r-form" novalidate>' +
          '<div class="rs-r-fld">' +
            "<label id=\"rs-r-l-stars\">Rating</label>" +
            '<div class="rs-r-starin" role="radiogroup" aria-labelledby="rs-r-l-stars"></div>' +
          "</div>" +
          '<div class="rs-r-fld">' +
            '<label for="rs-r-f-name">Name</label>' +
            '<input id="rs-r-f-name" type="text" maxlength="40" autocomplete="name" placeholder="e.g. Dana K.">' +
          "</div>" +
          '<div class="rs-r-fld">' +
            '<label for="rs-r-f-room">Room</label>' +
            '<select id="rs-r-f-room">' +
              ROOMS.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + "</option>"; }).join("") +
            "</select>" +
          "</div>" +
          '<div class="rs-r-fld">' +
            '<label for="rs-r-f-text">Your review</label>' +
            '<textarea id="rs-r-f-text" maxlength="400" rows="4" placeholder="What worked? What did not? (20–400 characters)"></textarea>' +
            '<div class="rs-r-count" aria-live="polite">0 / 400 · min 20</div>' +
          "</div>" +
          '<div class="rs-r-err" hidden></div>' +
          '<div class="rs-r-actions">' +
            '<button type="submit" class="btn btn-primary">Post review</button>' +
            '<button type="button" class="btn btn-ghost rs-r-cancel">Cancel</button>' +
          "</div>" +
        "</form>" +
      "</div>";
    document.body.appendChild(ov);

    M = {
      ov: ov,
      dlg: ov.querySelector(".rs-r-modal"),
      note: ov.querySelector(".rs-r-mnote"),
      form: ov.querySelector(".rs-r-form"),
      starin: ov.querySelector(".rs-r-starin"),
      name: ov.querySelector("#rs-r-f-name"),
      room: ov.querySelector("#rs-r-f-room"),
      text: ov.querySelector("#rs-r-f-text"),
      count: ov.querySelector(".rs-r-count"),
      err: ov.querySelector(".rs-r-err"),
      stars: 0,
      open: false,
      lastFocus: null,
      prevOverflow: ""
    };

    // --- star input: 5 skewed squares, hover preview, radiogroup keyboard ---
    for (var i = 1; i <= 5; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rs-r-star";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.setAttribute("aria-label", i + (i === 1 ? " star" : " stars"));
      b.dataset.v = String(i);
      b.innerHTML = "<i></i>";
      M.starin.appendChild(b);
    }
    var starBtns = Array.prototype.slice.call(M.starin.children);

    function paintStars(level) {
      starBtns.forEach(function (b, idx) {
        b.classList.toggle("rs-r-lit", idx < level);
        var checked = (idx + 1) === M.stars;
        b.setAttribute("aria-checked", checked ? "true" : "false");
        b.tabIndex = (M.stars === 0 ? idx === 0 : checked) ? 0 : -1;
      });
    }
    M.paintStars = paintStars;

    function setStars(v, focus) {
      M.stars = clampStars(v);
      paintStars(M.stars);
      hideErr();
      if (focus) starBtns[M.stars - 1].focus();
    }
    M.setStars = setStars;

    starBtns.forEach(function (b, idx) {
      b.addEventListener("click", function () { setStars(idx + 1, false); });
      b.addEventListener("mouseenter", function () { paintStars(idx + 1); });
    });
    M.starin.addEventListener("mouseleave", function () { paintStars(M.stars); });
    M.starin.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowRight" || k === "ArrowUp") { e.preventDefault(); setStars(M.stars === 0 ? 1 : M.stars + 1, true); }
      else if (k === "ArrowLeft" || k === "ArrowDown") { e.preventDefault(); setStars(M.stars === 0 ? 1 : M.stars - 1, true); }
      else if (k === "Home") { e.preventDefault(); setStars(1, true); }
      else if (k === "End") { e.preventDefault(); setStars(5, true); }
      else if (/^[1-5]$/.test(k)) { e.preventDefault(); setStars(parseInt(k, 10), true); }
    });

    // --- live counter ---
    function updateCount() {
      var len = M.text.value.length;
      M.count.textContent = len + " / 400" + (len < 20 ? " · min 20" : "");
    }
    M.updateCount = updateCount;
    M.text.addEventListener("input", updateCount);
    M.name.addEventListener("input", hideErr);
    M.text.addEventListener("input", hideErr);

    function showErr(msg, field) {
      M.err.textContent = msg;
      M.err.hidden = false;
      if (field && field.focus) field.focus();
    }
    function hideErr() {
      if (!M.err.hidden) { M.err.hidden = true; M.err.textContent = ""; }
    }

    // --- close paths: X, cancel, overlay click, Escape ---
    ov.querySelector(".rs-r-x").addEventListener("click", closeModal);
    ov.querySelector(".rs-r-cancel").addEventListener("click", closeModal);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closeModal(); });

    M.onKeydown = function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
      if (e.key === "Tab") {
        // light focus trap
        var f = M.dlg.querySelectorAll("button,input,select,textarea,[tabindex]:not([tabindex='-1'])");
        var focusable = Array.prototype.filter.call(f, function (n) { return !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null; });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    // --- submit ---
    M.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = M.name.value.replace(/\s+/g, " ").trim();
      var text = M.text.value.trim();
      if (M.stars < 1) { showErr("Pick a star rating (1–5).", starBtns[0]); return; }
      if (!name) { showErr("Add your name.", M.name); return; }
      if (name.length > 40) { showErr("Name is limited to 40 characters.", M.name); return; }
      if (text.length < 20) { showErr("Review needs at least 20 characters.", M.text); return; }
      if (text.length > 400) { showErr("Review is limited to 400 characters.", M.text); return; }

      var rec = sanitizeRecord({
        stars: M.stars,
        name: name,
        text: text,
        room: M.room.value,
        date: currentYM(),
        beta: false
      });
      var all = readAll().slice();
      all.push(rec);
      save(all);
      // Deliver to the owner's inbox as real inbound feedback (best-effort; no-op if unconfigured).
      if (window.RoomscopeFeedback) {
        RoomscopeFeedback.event(rec.stars >= lastMinStars ? "review-public" : "review-private");
        RoomscopeFeedback.post({
          subject: "Roomscope review · " + rec.stars + "★ · " + rec.room,
          type: "review",
          stars: rec.stars,
          name: rec.name,
          room: rec.room,
          message: rec.text,
          on_wall: rec.stars >= lastMinStars ? "yes" : "no (private feedback)"
        });
      }
      closeModal();
      refreshWall();
      // Honest wording: low ratings are stored as feedback, not shown on the wall.
      toast(rec.stars >= lastMinStars
        ? "Thanks — your review is on the wall"
        : "Thanks for the honest feedback — it helps us fix things");
    });

    M.hideErr = hideErr;
  }

  function openModal(prefill) {
    buildModal();
    prefill = prefill || {};
    var room = normRoom(prefill.room);
    if (M.open) { if (room) M.room.value = room; return; }

    // fresh form each open
    M.stars = 0;
    M.name.value = "";
    M.text.value = "";
    M.room.value = room || ROOMS[0];
    M.updateCount();
    M.hideErr();
    M.paintStars(0);
    M.note.textContent = "Reviews rated " + lastMinStars + "★+ appear on the wall · lower ratings are stored as private feedback";

    M.lastFocus = document.activeElement;
    M.prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    M.ov.hidden = false;
    void M.ov.offsetWidth; // flush so the fade-in transition runs
    M.ov.classList.add("rs-r-open");
    M.open = true;
    document.addEventListener("keydown", M.onKeydown, true);
    var firstStar = M.starin.firstElementChild;
    if (firstStar) firstStar.focus();
  }

  function closeModal() {
    if (!M || !M.open) return;
    M.open = false;
    document.removeEventListener("keydown", M.onKeydown, true);
    document.body.style.overflow = M.prevOverflow;
    M.ov.classList.remove("rs-r-open");
    setTimeout(function () { if (M && !M.open) M.ov.hidden = true; }, 200);
    if (M.lastFocus && M.lastFocus.focus && document.contains(M.lastFocus)) M.lastFocus.focus();
    M.lastFocus = null;
  }

  function count() {
    return readAll().length;
  }

  /* ---------------- init + export ---------------- */

  function init() {
    injectStyles();
    readAll(); // seed on first load
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.RoomscopeReviews = Object.freeze({
    mountWall: mountWall,
    refreshWall: refreshWall,
    openModal: openModal,
    count: count
  });
})();
