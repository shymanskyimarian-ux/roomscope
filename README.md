# Roomscope — AI renovation planner (MVP)

Snap a room. Get a priced plan.

- `index.html` — landing page with a public reviews wall (top-rated reviews only)
- `app.html` — working MVP estimator: deterministic quantity math + seed price catalog run fully client-side; before/after styled photo preview (canvas, honestly labeled — not generative AI); human-in-the-loop scope confirmation; "verify locally" fallback for unmatched prices; Free/Pro gating
- `billing.js` — client-side plan state + Stripe Payment Link checkout (`config.js` holds the link)
- `preview.js` — before/after preview: wall repaint + new floor over the uploaded photo, synced to the estimate
- `reviews.js` — reviews with a 4★+ public wall (seeded entries are labeled BETA TESTER)
- `privacy.html` / `terms.html` — photos never leave the browser; payments handled by Stripe

Live: https://shymanskyimarian-ux.github.io/roomscope/

MVP honesty notes: vision is mocked, prices come from a seed catalog, plan state lives in localStorage (no backend). The estimator math itself is real and deterministic.
