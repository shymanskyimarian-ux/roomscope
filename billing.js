/* ============================================================
   Roomscope — billing.js
   Client-side subscription / plan module (no backend).
   Global: window.RoomscopeBilling  ·  class prefix: rs-b-
   Reads window.ROOMSCOPE_CONFIG (loaded before this file):
     { STRIPE_PAYMENT_LINK: "", PRO_PRICE_LABEL: "$12 / month" }
   ============================================================ */
(function () {
  "use strict";

  // Guard: safe if the script is mounted twice.
  if (window.RoomscopeBilling) return;

  var LS_PRO = "roomscope_pro";
  var LS_PROJECTS = "roomscope_projects";
  var STYLE_ID = "rs-b-styles";
  var FEATURES = [
    "Unlimited rooms",
    "Real per-item prices for your region",
    "Step-by-step instructions",
    "PDF export via print",
    "Saved home profile"
  ];

  /* ---------------- config / storage helpers ---------------- */

  function cfg() {
    var c = window.ROOMSCOPE_CONFIG || {};
    var link = typeof c.PAYMENT_LINK === "string" ? c.PAYMENT_LINK.trim()
             : typeof c.STRIPE_PAYMENT_LINK === "string" ? c.STRIPE_PAYMENT_LINK.trim() : "";
    if (!/^https?:\/\//i.test(link)) link = ""; // only real URLs count
    var price = (typeof c.PRO_PRICE_LABEL === "string" && c.PRO_PRICE_LABEL.trim()) ? c.PRO_PRICE_LABEL.trim() : "$12 / month";
    var provider = (typeof c.PAYMENT_PROVIDER_LABEL === "string" && c.PAYMENT_PROVIDER_LABEL.trim()) ? c.PAYMENT_PROVIDER_LABEL.trim() : "";
    return { link: link, price: price, provider: provider };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  /* ---------------- styles (injected once) ---------------- */

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = [
      ".rs-b-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:1.25rem;background:rgba(0,0,0,.65);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);animation:rs-b-fade .22s ease}",
      "@keyframes rs-b-fade{from{opacity:0}to{opacity:1}}",
      ".rs-b-card{background:var(--card,#121316);border:1px solid var(--line-2,rgba(255,255,255,.14));border-radius:3px;max-width:420px;width:100%;padding:1.7rem 1.6rem 1.5rem;box-shadow:0 24px 60px rgba(0,0,0,.55);animation:rs-b-rise .28s cubic-bezier(.2,.7,.3,1)}",
      "@keyframes rs-b-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
      ".rs-b-eyebrow{font-family:var(--font-mono,monospace);font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:var(--green,#76B900);display:inline-flex;align-items:center;gap:.6rem}",
      ".rs-b-eyebrow::before{content:\"\";width:18px;height:8px;background:var(--green,#76B900);transform:skewX(-20deg);display:inline-block;box-shadow:0 0 12px var(--green-glow,rgba(118,185,0,.35))}",
      ".rs-b-title{font-family:var(--font-display,sans-serif);font-weight:900;font-size:1.85rem;letter-spacing:-.02em;line-height:1.04;color:var(--text,#F2F3F5);margin:.85rem 0 .55rem}",
      ".rs-b-title .rs-b-accent{color:var(--green,#76B900)}",
      ".rs-b-lead{color:var(--muted,#9a9ea6);font-size:.92rem;line-height:1.6;margin:0 0 1rem}",
      ".rs-b-trigger{display:inline-block;font-family:var(--font-mono,monospace);font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted,#9a9ea6);background:var(--bg-2,#0e0f11);border:1px solid var(--line,rgba(255,255,255,.08));padding:.4rem .65rem;border-radius:2px;margin:0 0 1.05rem}",
      ".rs-b-trigger b{color:var(--green,#76B900);font-weight:700}",
      ".rs-b-list{list-style:none;margin:0 0 1.25rem;padding:0}",
      ".rs-b-list li{display:flex;align-items:flex-start;gap:.75rem;padding:.34rem 0;color:var(--muted,#9a9ea6);font-family:var(--font-body,sans-serif);font-size:.92rem;line-height:1.5}",
      ".rs-b-list li::before{content:\"\";flex:0 0 auto;width:13px;height:8px;margin-top:.42rem;background:var(--green,#76B900);transform:skewX(-20deg);box-shadow:0 0 10px var(--green-glow,rgba(118,185,0,.35))}",
      ".rs-b-list li b{color:var(--text,#F2F3F5);font-weight:600}",
      ".rs-b-actions{display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;margin-top:.2rem}",
      ".rs-b-actions .btn{text-decoration:none}",
      ".rs-b-pending{display:block;font-family:var(--font-mono,monospace);font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;line-height:1.9;color:var(--muted,#9a9ea6);background:var(--bg-2,#0e0f11);border:1px dashed var(--line-2,rgba(255,255,255,.14));border-radius:2px;padding:.75rem .85rem;margin:0 0 .9rem}",
      ".rs-b-pending b{color:var(--green,#76B900);font-weight:700}",
      ".rs-b-foot{margin-top:1.15rem;padding-top:.8rem;border-top:1px solid var(--line,rgba(255,255,255,.08));font-family:var(--font-mono,monospace);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-2,#6b6f77)}",
      "@media(max-width:480px){.rs-b-card{padding:1.4rem 1.2rem 1.2rem}.rs-b-title{font-size:1.55rem}}",
      "@media(prefers-reduced-motion:reduce){.rs-b-overlay,.rs-b-card{animation:none}}"
    ].join("\n");
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------------- modal plumbing ---------------- */

  var openState = null; // { root, onKey, lastFocus }

  function closeModal() {
    if (!openState) return;
    document.removeEventListener("keydown", openState.onKey, true);
    if (openState.root && openState.root.parentNode) openState.root.parentNode.removeChild(openState.root);
    var lf = openState.lastFocus;
    openState = null;
    if (lf && typeof lf.focus === "function") { try { lf.focus(); } catch (e) {} }
  }

  function showModal(cardHtml) {
    injectStyles();
    closeModal(); // only one modal at a time
    var root = document.createElement("div");
    root.className = "rs-b-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "rs-b-title");
    root.innerHTML = '<div class="rs-b-card">' + cardHtml + "</div>";

    root.addEventListener("click", function (ev) {
      if (ev.target === root) closeModal(); // overlay click, not card clicks
    });
    var onKey = function (ev) {
      if (ev.key === "Escape" || ev.key === "Esc") { ev.stopPropagation(); closeModal(); }
    };
    document.addEventListener("keydown", onKey, true);

    var lastFocus = document.activeElement;
    (document.body || document.documentElement).appendChild(root);
    openState = { root: root, onKey: onKey, lastFocus: lastFocus };

    var focusEl = root.querySelector(".rs-b-autofocus");
    if (focusEl) { try { focusEl.focus(); } catch (e) {} }
    return root;
  }

  /* ---------------- modals ---------------- */

  function openUpgrade(featureLabel) {
    var c = cfg();

    var triggerHtml = (typeof featureLabel === "string" && featureLabel.trim())
      ? '<span class="rs-b-trigger">Locked · <b>' + esc(featureLabel.trim()) + "</b></span>"
      : "";

    var listHtml = "<ul class=\"rs-b-list\">" + FEATURES.map(function (f) {
      return "<li>" + esc(f) + "</li>";
    }).join("") + "</ul>";

    var ctaHtml;
    if (c.link) {
      ctaHtml =
        '<div class="rs-b-actions">' +
          '<a class="btn btn-primary rs-b-autofocus" href="' + esc(c.link) + '">Upgrade — ' + esc(c.price) + "</a>" +
          '<button type="button" class="btn btn-ghost" data-rs-b="close">Not now</button>' +
        "</div>";
    } else {
      ctaHtml =
        '<span class="rs-b-pending"><b>Checkout is being activated</b><br>Pro (' + esc(c.price) + ") opens for purchase shortly — check back soon.</span>" +
        '<div class="rs-b-actions">' +
          '<button type="button" class="btn btn-ghost rs-b-autofocus" data-rs-b="close">Not now</button>' +
        "</div>";
    }

    var root = showModal(
      '<span class="rs-b-eyebrow">Roomscope · Plan</span>' +
      '<h2 class="rs-b-title" id="rs-b-title">Go <span class="rs-b-accent">Pro</span></h2>' +
      triggerHtml +
      listHtml +
      ctaHtml +
      '<div class="rs-b-foot">' + (cfg().provider ? "Payments handled by " + esc(cfg().provider) + " · cancel anytime" : "Secure hosted checkout · cancel anytime") + "</div>"
    );

    var closeBtn = root.querySelector('[data-rs-b="close"]');
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
  }

  function showWelcome() {
    var root = showModal(
      '<span class="rs-b-eyebrow">Roomscope · Pro active</span>' +
      '<h2 class="rs-b-title" id="rs-b-title">Welcome to <span class="rs-b-accent">Pro</span></h2>' +
      '<p class="rs-b-lead">Your plan is active on this device. Unlimited rooms, regional per-item prices, step-by-step instructions and export are unlocked.</p>' +
      '<div class="rs-b-actions">' +
        '<button type="button" class="btn btn-primary rs-b-autofocus" data-rs-b="continue">Continue</button>' +
      "</div>" +
      '<div class="rs-b-foot">' + (cfg().provider ? "Payments handled by " + esc(cfg().provider) + " · cancel anytime" : "Secure hosted checkout · cancel anytime") + "</div>"
    );
    var btn = root.querySelector('[data-rs-b="continue"]');
    if (btn) btn.addEventListener("click", closeModal);
  }

  /* ---------------- public API ---------------- */

  function isPro() {
    return lsGet(LS_PRO) === "1";
  }

  function projectsUsed() {
    var n = parseInt(lsGet(LS_PROJECTS) || "0", 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  function recordProject() {
    lsSet(LS_PROJECTS, String(projectsUsed() + 1));
  }

  function canStartProject() {
    return isPro() || projectsUsed() < 1; // Free plan = 1 room total
  }

  function gate(featureLabel) {
    if (isPro()) return true;
    openUpgrade(featureLabel);
    return false;
  }

  function reset() {
    lsDel(LS_PRO);
    lsDel(LS_PROJECTS);
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    injectStyles();
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get("upgraded") === "1") {
        lsSet(LS_PRO, "1");
        url.searchParams["delete"]("upgraded");
        var qs = url.searchParams.toString();
        var clean = url.pathname + (qs ? "?" + qs : "") + url.hash;
        try { window.history.replaceState(null, "", clean); } catch (e) {}
        showWelcome();
      }
    } catch (e) { /* malformed URL / very old browser: billing still works */ }
  }

  window.RoomscopeBilling = {
    init: init,
    isPro: isPro,
    projectsUsed: projectsUsed,
    recordProject: recordProject,
    canStartProject: canStartProject,
    gate: gate,
    openUpgrade: openUpgrade,
    reset: reset
  };

  // Self-init on DOMContentLoaded (or immediately if DOM is already parsed).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
