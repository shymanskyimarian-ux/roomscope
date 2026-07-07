// Roomscope runtime config — paste your keys/links here, no code changes needed.
//
// PADDLE (payments): create the "Roomscope Pro" $12/month product in Paddle, copy its
//   hosted checkout link into PAYMENT_LINK, and set Paddle's success/redirect URL to:
//   https://shymanskyimarian-ux.github.io/roomscope/app.html?upgraded=1
//
// WEB3FORMS (feedback + waitlist): sign up free at https://web3forms.com (just an email),
//   copy your Access Key into WEB3FORMS_KEY. Reviews and waitlist signups then arrive in
//   your inbox. While empty, on-site reviews still work locally (nothing is lost).
//
// GOATCOUNTER (analytics): create a free site at https://www.goatcounter.com — your code is
//   the subdomain you pick (e.g. "roomscope" for roomscope.goatcounter.com). Paste just that
//   code into GOATCOUNTER_CODE. Cookieless, no consent banner. While empty, no analytics load.
window.ROOMSCOPE_CONFIG = {
  PAYMENT_LINK: "",
  PRO_PRICE_LABEL: "$12 / month",
  PAYMENT_PROVIDER_LABEL: "Paddle", // shown in the upgrade-modal footnote
  WEB3FORMS_KEY: "e5274a11-49e4-46c5-9131-887c2124f4ae",  // feedback + waitlist delivery
  GOATCOUNTER_CODE: "marian",                            // marian.goatcounter.com
};
