# Adyen Giving (donations)

Adyen Giving lets a shopper donate to a charity **after checkout is already complete**, on top of a
payment that was already paid. It is not part of the checkout flow: the typical place to offer it is
an order-confirmation / "thank you" page, once the commercetools `payment` for the order exists and
carries a donation token.

This page covers how to integrate the donation UI on the frontend, how to create the checkout session
it runs on, and the errors it can raise. For how the connector configures and enables the feature
itself (webhook setup, custom type, state persisted on the payment), see the
[Adyen Giving section](../README.md#adyen-giving-donations) in the main README.

## 1. Create a checkout session for sharing information and authenticating requests

The donation component is not tied to a cart. It runs against an existing commercetools `payment`
(the one the shopper already paid), so the checkout session must be created with that `paymentId`.

The session exists so this binding happens server to server: the merchant backend is the one that
tells commercetools which `paymentId` the shopper is allowed to donate against, over an authenticated
call.

```bash
# 1. Get an OAuth token for the commercetools API client
TOKEN=$(curl -s -u "$CTP_CLIENT_ID:$CTP_CLIENT_SECRET" \
  -d grant_type=client_credentials \
  "$CTP_AUTH_URL/oauth/token" | jq -r .access_token)

# 2. Open a session bound to the payment (no `cart`)
curl -s -X POST "$CTP_SESSION_URL/$CTP_PROJECT_KEY/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "processorUrl": "https://<processor-host>",
      "merchantReturnUrl": "https://shop.example.com/return",
      "paymentId": "<commercetools payment id>"
    }
  }'
```

The response's `id` is the `sessionId` the enabler needs below.

## 2. Load the enabler and mount the donation form

The enabler is distributed as a static bundle served by the connector's `enabler` module (see
[Development of Enabler](../enabler/README.md)), not as an npm package. Import it from wherever that
bundle is served (e.g. `<script type="module">` pointing at the connector's enabler URL, or a bundler
alias in dev).

The donation has its own entry point, `DonationEnabler`, separate from the `Enabler` used to take the
payment: it runs after the payment is done, so it takes neither the payment method configuration nor
the payment callbacks.

```ts
import { DonationEnabler, DonationErrorCode } from "<enabler bundle>";

const enabler = new DonationEnabler({
  processorUrl,            // same processor base URL used in the session metadata above
  sessionId,               // the session id from step 1
  countryCode,             // optional; see note below
  onComplete: ({ isSuccess, reason, paymentReference }) => {
    // `isSuccess` indicates the result of the donation.
    // `reason` tells the outcomes apart: "donated", "rejected" or "cancelled".
  },
  onError: (error, context) => showMessage(error.code, context?.paymentReference),
});

try {
  const builder = await enabler.createDonationBuilder();
  const component = builder.build({
    showCancelButton: true, // default; set false to hide the "no thanks" button
  });

  await component.mount("#donation"); // CSS selector string
} catch (error) {
  // No donation can be offered for this payment at all: render nothing.
  if (error.code === DonationErrorCode.NoActiveCampaign) hideDonationSection();
}

```

Notes:

- `createDonationBuilder()` does the setup work (fetching the donation config from the processor,
  initializing the Adyen Web SDK) and is where most failures surface — see the error table below.
- `onError` catches every failure of the donation flow, both during setup and once the form is on
  screen (e.g. the donation call failing).
- `onComplete` is **not** called on error, it indicates the final result of the donation.
- `countryCode` is optional. The Adyen Web SDK requires one to initialize, so if it's not passed, it
  is inferred from the cart associated with the payment.

A complete, runnable example of this flow (including creating the session) lives in the enabler's dev
tools: [`enabler/dev-utils/commercestore/src/DonationApp.tsx`](../enabler/dev-utils/commercestore/src/DonationApp.tsx).

## 3. Known errors

Every failure of the donation flow is a `DonationError`, carrying a `code` from `DonationErrorCode` —
match on that instead of the error message.

| Code | Raised by | Meaning | Suggested handling |
|---|---|---|---|
| `giving_not_enabled` | `createDonationBuilder()` | `ADYEN_GIVING_ENABLED` is not set on the connector. | Do not render the donation area. |
| `payment_not_eligible` | `createDonationBuilder()` | The payment of the session carries no Adyen `donationToken`, so no donation can ever be charged against it, or a donation has already been charged against it. | Do not render the donation area. |
| `no_active_campaign` | `createDonationBuilder()` | Adyen returned no active campaign for the merchant account and the currency of the payment. | Do not render the donation area. |
| `initialization_failed` | `createDonationBuilder()` | The donation configuration could not be fetched, or the Adyen web SDK could not be initialized. | Transient: the page can be retried. |
| `general` | `onError` | Anything else: a network failure, an error raised by the Adyen element, an unexpected processor error. | Show an error; do not silently retry. |
