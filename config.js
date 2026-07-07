// Roomscope runtime config.
// PAYMENT_LINK: paste your hosted checkout / payment-link URL here.
//   Works with any provider that gives a payment page URL with recurring billing:
//   Stripe Payment Link, Paddle checkout link, WayForPay button link, LiqPay,
//   Gumroad membership, etc.
// While empty, the upgrade modal shows a "checkout is being activated" notice
// instead of a dead button.
// If your provider supports an after-payment redirect/return URL, set it to:
//   https://shymanskyimarian-ux.github.io/roomscope/app.html?upgraded=1
// (that is what flips the plan to Pro on the buyer's device)
// PADDLE SETUP (chosen provider):
//   1. Create the product "Roomscope Pro" with a $12/month recurring price in Paddle
//   2. Copy its hosted checkout link into PAYMENT_LINK below
//   3. In Paddle checkout settings, set the success/redirect URL to:
//      https://shymanskyimarian-ux.github.io/roomscope/app.html?upgraded=1
window.ROOMSCOPE_CONFIG = {
  PAYMENT_LINK: "",
  PRO_PRICE_LABEL: "$12 / month",
  PAYMENT_PROVIDER_LABEL: "Paddle", // shown in the upgrade-modal footnote
};
