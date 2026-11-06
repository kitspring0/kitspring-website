# Checkout provider assessment — 6 November 2026

## Payhip is a credible candidate for a Nigerian seller
Payhip's current published gateway documentation lists **Paystack for Nigeria** and **Flutterwave for Nigeria**. Payhip's May 2026 announcement lists Nigeria among the supported seller countries for both processors. This is materially better than assuming a Nigerian seller can use Stripe directly: Payhip's own Stripe country list does not list Nigeria.

- Payhip Free Forever: $0/month and 5% Payhip transaction fee. Processor fees are additional.
- Paystack through Payhip: Payhip's help article says Nigerian merchants can connect Paystack; card support includes Visa, Mastercard and Verve, with payment-method availability varying by country. The article quotes standard fees of 1.5% + ₦100 local and 3.9% + ₦100 international. Confirm current pricing with Paystack before launch.
- Payhip says it does not itself hold or pay out seller funds; the connected processor handles funds and payout. Paystack payout timing and bank settlement depend on the merchant's verified Paystack account and current settlement rules.
- Payhip storefront currency must match the Paystack account currency. Payhip says it does not automatically localise the displayed store currency for each buyer; a buyer paying in another currency may incur bank/provider conversion charges.
- Payhip's help centre says gateway options depend on business location and account eligibility. The final confirmation is inside your own Payhip account under Account → Settings → Payment Details → See all payment options.

Sources:
- https://payhip.com/blog/new-feature-payhip-integrates-with-11-new-payment-gateways/
- https://help.payhip.com/article/344-connecting-your-paystack-account
- https://help.payhip.com/article/396-resolve-payment-issues-as-a-seller
- https://payhip.com/pricing

## Recommendation
Start by opening a free Payhip account and checking that Paystack or Flutterwave is actually offered for your account. Complete processor KYC and verify international card acceptance, settlement bank, currency, payout timing and total fees with the provider. Do not set a KitSpring product to Published/available until you have completed a real low-value test transaction and confirmed the buyer delivery flow.

The website intentionally does not pretend to create orders, payment confirmations, webhooks or sales analytics. Checkout URLs are external links configured per product in the CMS. No payment-provider credentials are needed in the website source.
