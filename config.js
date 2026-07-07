// Roomscope runtime config.
// STRIPE_PAYMENT_LINK: paste your Stripe Payment Link URL here (https://buy.stripe.com/...).
// While empty, the upgrade modal shows a "checkout is being activated" notice instead of a dead button.
// In the Stripe Payment Link settings, set the after-payment redirect to:
//   https://shymanskyimarian-ux.github.io/roomscope/app.html?upgraded=1
window.ROOMSCOPE_CONFIG = {
  STRIPE_PAYMENT_LINK: "",
  PRO_PRICE_LABEL: "$12 / month",
};
