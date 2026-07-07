/* ============================================================
   Roomscope — feedback.js
   Central feedback + waitlist delivery (Web3Forms) and cookieless
   analytics (GoatCounter). No backend. Reads window.ROOMSCOPE_CONFIG.
   Global: window.RoomscopeFeedback  ·  class prefix: rs-f-
   Degrades silently when keys are empty — no dead UI, no errors.
   ============================================================ */
(function () {
  "use strict";
  if (window.RoomscopeFeedback) return;

  function cfg() { return window.ROOMSCOPE_CONFIG || {}; }
  function trimmed(v) { return (typeof v === "string" && v.trim()) ? v.trim() : ""; }
  function key() { return trimmed(cfg().WEB3FORMS_KEY); }

  // ---- Web3Forms POST (feedback + waitlist) ----
  function post(payload) {
    var k = key();
    if (!k) return Promise.resolve({ ok: false, skipped: true });
    var body = { access_key: k };
    for (var p in payload) if (Object.prototype.hasOwnProperty.call(payload, p)) body[p] = payload[p];
    body.from_name = "Roomscope";
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { return { ok: !!(j && j.success) }; })
      .catch(function () { return { ok: false }; });
  }

  // ---- GoatCounter (cookieless analytics) ----
  function initAnalytics() {
    var code = trimmed(cfg().GOATCOUNTER_CODE);
    if (!code) return;                                   // no code -> no analytics load
    if (document.getElementById("rs-f-gc")) return;      // once only
    window.goatcounter = window.goatcounter || {};
    var s = document.createElement("script");
    s.id = "rs-f-gc";
    s.async = true;
    s.setAttribute("data-goatcounter", "https://" + code + ".goatcounter.com/count");
    s.src = "https://gc.zgo.at/count.js";
    (document.body || document.documentElement).appendChild(s);
  }
  function event(name) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === "function") {
        window.goatcounter.count({ path: name, title: name, event: true });
      }
    } catch (e) { /* analytics must never break the app */ }
  }

  // ---- waitlist form wiring ----
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function wireWaitlist(form, statusEl, source) {
    if (!form || form.dataset.rsfWired) return;
    form.dataset.rsfWired = "1";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = input ? input.value.trim() : "";
      var hp = form.querySelector('input[name="botcheck"]');
      if (hp && hp.value) return;                        // honeypot tripped -> ignore
      if (!EMAIL_RE.test(email)) { if (statusEl) statusEl.textContent = "Enter a valid email."; return; }
      if (statusEl) statusEl.textContent = "Adding you…";
      event("waitlist-signup");
      post({ subject: "Roomscope waitlist signup", type: "waitlist", email: email, source: source || "site" })
        .then(function (res) {
          if (res.skipped) { if (statusEl) statusEl.textContent = "Thanks — you're noted. (launch alerts activate shortly)"; form.reset(); }
          else if (res.ok) { if (statusEl) statusEl.textContent = "You're on the list — thanks!"; form.reset(); }
          else { if (statusEl) statusEl.textContent = "That didn't send — please try again later."; }
        });
    });
  }

  window.RoomscopeFeedback = { post: post, event: event, initAnalytics: initAnalytics, wireWaitlist: wireWaitlist, key: key };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAnalytics, { once: true });
  else initAnalytics();
})();
