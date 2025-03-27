# Payment Integration Processor

This module provides an application based on [commercetools Connect](https://docs.commercetools.com/connect), which is triggered by HTTP requests from Checkout UI for payment operations.

The corresponding payment, cart or order details would be fetched from composable commerce platform, and then be sent to Adyen payment service for various payment operations such as create session and create/capture/cancel/refund payment.

The module also provides template scripts for post-deployment and pre-undeployment action. After deployment or before undeployment via connect service completed, customized actions can be performed based on users' needs.

## Getting Started

These instructions will get you up and running on your local machine for development and testing purposes.
Please run following npm commands under `processor` folder.

#### Install PSP SDK

In case SDK is provided by payment service provider for communication purpose, you can import the SDK by following commands

```
npm install <psp-sdk>
```

#### Install dependencies

```
npm install
```

#### Build the application in local environment. NodeJS source codes are then generated under dist folder

```
npm run build
```

#### Run automation test

```
npm run test
```

#### Run the application in local environment. Remind that the application has been built before it runs

```
npm run start
```

#### Fix the code style

```
npm run lint:fix
```

#### Verify the code style

```
npm run lint
```

#### Run post-deploy script in local environment

```
npm run connector:post-deploy
```

#### Run pre-undeploy script in local environment

```
npm run connector:pre-undeploy
```

## Running application

Setup correct environment variables: check `processor/src/config/config.ts` for default values.

Make sure commercetools client credential have at least the following permissions:

- `manage_payments`
- `manage_checkout_payment_intents`
- `view_sessions`
- `introspect_oauth_tokens`

```
npm run dev
```

## Authentication

Some of the services have authentication mechanism.

- `oauth2`: Relies on commercetools OAuth2 server
- `session`: Relies on commercetools session service
- `jwt`: Relies on the jwt token injected by the merchant center via the forward-to proxy

### OAuth2

OAuth2 token can be obtained from commercetools OAuth2 server. It requires API Client created beforehand. For details, please refer to [Requesting an access token using the Composable Commerce OAuth 2.0 service](https://docs.commercetools.com/api/authorization#requesting-an-access-token-using-the-composable-commerce-oauth-20-service).

### Session

Payment connectors relies on session to be able to share information between `enabler` and `processor`.
To create session before sharing information between these two modules, please execute following request to commercetools session service

```
POST https://session.<region>.commercetools.com/<commercetools-project-key>/sessions
Authorization: Bearer <oauth token with manage_sessions scope>

{
  "cart": {
    "cartRef": {
      "id": "<cart-id>"
    }
  },
  "metadata": {
    "allowedPaymentMethods": ["card", "ideal", ...],
    "paymentInterface"?: "<payment interface that will be set on payment method info https://docs.commercetools.com/api/projects/payments#ctp:api:type:PaymentMethodInfo>"
  }
}
```

Afterwards, session ID can be obtained from response, which is necessary to be put as `x-session-id` inside request header when sending request to endpoints such as `/operations/config` and `/operations/payments`.

### JSON web token (JWT)

`jwt` needs some workaround to be able to test locally as it depends on the merchant center forward-to proxy.

In order to make easy running the application locally, following commands help to build up a jwt mock server:

#### Set environment variable to point to the jwksUrl

```
export CTP_JWKS_URL="http://localhost:9002/jwt/.well-known/jwks.json"
```

#### Run the jwt server

```
docker compose up -d
```

#### Obtain JWT

```
# Request token
curl --location 'http://localhost:9002/jwt/token' \
--header 'Content-Type: application/json' \
--data '{
    "iss": "https://mc-api.europe-west1.gcp.commercetools.com",
    "sub": "subject",
    "https://mc-api.europe-west1.gcp.commercetools.com/claims/project_key": "<commercetools-project-key>"
}'
```

Token can be found in response

```
{"token":"<token>"}
```

Use the token to authenticate requests protected by JWT: `Authorization: Bearer <token>`.

## Webhooks

Checkout requires a webhook to be configured in Adyen. The following list of `eventCode` are required:

- `AUTHORISATION`
- `EXPIRE`
- `OFFER_CLOSED`
- `CAPTURE`
- `CAPTURE_FAILED`
- `CANCELLATION`
- `REFUND`
- `REFUND_FAILED`
- `CHARGEBACK`

Any other type of event will be silently ignored. For more information see the [Adyen webhook-types](https://docs.adyen.com/development-resources/webhooks/webhook-types/) documentation.

### Configuring the notifications in Adyen

To configure notifications in Adyen, follow this [guide](https://docs.adyen.com/development-resources/webhooks/#set-up-webhooks-in-your-customer-area).

In the webhook server's url, the following value must be set:
`{processorUrl}/notifications` 

`processorUrl` is the url of the connector once it has been installed. It can be retrieved from the Merchant Center, inside the installation details of the processor.
The url looks like `https://service-[id].[region].commercetools.app`.

## APIs

The processor exposes following endpoints to execute various operations with Adyen platform:

### Create payment session

It creates payment resource in composable commerce and create Adyen payment session in payment service provider.

#### Endpoint

`POST /sessions`

#### Request Parameters

The request body is same as [adyen checkout create session request](https://docs.adyen.com/api-explorer/Checkout/71/post/sessions#request) except following parameters are not required

- amount
- merchantAccount
- countryCode
- returnUrl
- reference
- storePaymentMethod
- shopperReference
- recurringProcessingModel
- storePaymentMethodMode

These parameters are already provided by the cart created in composable commerce platform, therefore they are not required to be provided when calling the endpoint.

#### Response Parameters

- sessionData: The [adyen checkout create session response](https://docs.adyen.com/api-explorer/Checkout/71/post/sessions#responses) returned by Adyen platform after Adyen session created.
- paymentReference : It represents the unique identifier of payment resource created in composable commerce platform.

### Create payment

It mainly starts an Ayden payment transaction in payment services provider. If payment reference is absent in request parameters, the endpoint creates payment resource in composable commerce based on data from the cart.

#### Endpoint

`POST /payments`

#### Request Parameters

The request body is same as [adyen checkout create payment request](https://docs.adyen.com/api-explorer/Checkout/71/post/payments#request) except following parameters are not required

- amount
- additionalAmount
- merchantAccount
- countryCode
- returnUrl
- lineItems
- reference
- shopperReference
- recurringProcessingModel

These parameters are already provided by the cart created in composable commerce platform, therefore they are not required to be provided when calling the endpoint.

#### Response Parameters

- action: The [action](https://docs.adyen.com/api-explorer/Checkout/69/post/payments#responses-200-action) to be taken in Adyen platform to complete the payment.
- resultCode: It represents the [resultCode](https://docs.adyen.com/api-explorer/Checkout/69/post/payments#responses-200-resultCode) of the payment in Adyen platform.
- threeDS2ResponseData: Response of the 3D Secure 2 authentication.
- threeDS2Result: Result of the 3D Secure 2 authentication.
- threeDSPaymentData: Returned by Adyen platform. When it is non-empty, it contains a value that is mandatory parameter as paymentData for payment confirmation in next step.
- paymentReference: It represents the unique identifier of the update payment resource in composable commerce.
- merchantReturnUrl:

### Confirm payment

Submits details for a payment to Adyen platform to confirm a payment. It is only necessary when the payment is initialized through [create payment](#create-payment)

#### Endpoint

`POST /payments/details`

#### Request Parameters

The request body is same as [adyen checkout create payment details request](The request body is same as [adyen checkout create payment request](https://docs.adyen.com/api-explorer/Checkout/71/post/payments#request)) with following parameters :

- authenticationData: Data for 3DS authentication.
- details: A collection of result returned from the `/payments` call.
- paymentData: Encoded payment data returned from the `/payments` call. If `AuthenticationNotRequired` is received as `resultCode` in the `/payments` response, use the `threeDSPaymentData` from the same response. If the `resultCode` is `AuthenticationFinished`, use the `action.paymentData` from the same response.

#### Response Parameters

It returns following attributes in response

- paymentReference: Unique identifier of payment resources updated in commercetools composable commerce.

### Notifications

Receives Adyen's notifications so that the commercetools payment can be updated to reflect the latest payment status.

#### Endpoint

`POST /notifications`

#### Request Parameters

The request body an [Adyen Webhook](https://docs.adyen.com/development-resources/webhooks/webhook-types/#webhook-structure).
The requests are authenticated by validating the HMAC signature using the `ADYEN_NOTIFICATION_HMAC_KEY` environment variable.

#### Response Parameters

It returns a 200 `[accepted]` response to Adyen to indicate that the notification has been processed.

### Get supported payment components

Private endpoint protected by JSON Web Token that exposes the payment methods supported by the connector so that checkout application can retrieve the available payment components.

#### Endpoint

`GET /operations/payment-components`

#### Request Parameters

N/A

#### Response Parameters

Now the connector supports payment methods such as `card`, `iDEAL`, `PayPal`

```
{
    components: [
        {
          type: 'card',
        },
        {
          type: 'ideal',
        },
        {
          type: 'paypal',
        },
    ],
}
```

### Get config

Exposes configuration to the frontend such as `clientKey` and `environment`.

#### Endpoint

`GET /operations/config`

#### Request Parameters

N/A

#### Response Parameters

It returns an object with `clientKey` and `environment` as key-value pair as below:

```
{
  clientKey: <clientKey>,
  environment: <environment>,
}
```

### Get status

It provides health check feature for checkout front-end so that the correctness of configurations can be verified.

#### Endpoint

`GET /operations/status`

#### Request Parameters

N/A

#### Response Parameters

It returns following attributes in response:

- status: It indicates the health check status. It can be `OK`, `Partially Available` or `Unavailable`
- timestamp: The timestamp of the status request
- version: Current version of the payment connector.
- checks: List of health check result details. It contains health check result with various external system including commercetools composable commerce and Adyen payment services provider.

```
    [
        {
            name: <name of external system>
            status: <status with indicator UP or DOWN>
            details: <additional information for connection checking>
        }
    ]
```

- metadata: It lists a collection of metadata including the name/description of the connector and the version of SDKs used to connect to external system.

### Modify payment

Private endpoint called by Checkout frontend to support various payment update requests such as cancel/refund/capture payment. It is protected by `manage_checkout_payment_intents` access right of composable commerce OAuth2 token.

#### Endpoint

`POST /operations/payment-intents/{paymentsId}`

#### Request Parameters

The request payload is different based on different update operations:

- Cancel Payment

```
{
    actions: [{
        action: "cancelPayment",
    }]
}
```

- Capture Payment

  - centAmount: Amount in the smallest indivisible unit of a currency. For example, 5 EUR is specified as 500 while 5 JPY is specified as 5.
  - currencyCode: Currency code compliant to [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217)

  ```
  {
      actions: [{
          action: "capturePayment",
          amount: {
              centAmount: <amount>,
              currencyCode: <currecy code>
          }
      }]
  }
  ```

- Refund Payment

  - centAmount: Amount in the smallest indivisible unit of a currency. For example, 5 EUR is specified as 500 while 5 JPY is specified as 5.
  - currencyCode: Currency code compliant to [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217)

  ```
  {
      actions: [{
          action: "refundPayment",
          amount: {
              centAmount: <amount>,
              currencyCode: <currecy code>
          }
      }]
  }
  ```

#### Response Parameters

```
{
    outcome: "approved|rejected|received"
}

```

### Create Apple Pay payment session

It creates a new Apple Pay payment session. This is used when the merchants use their own Apple Pay certificates instead of the Adyen's Apple Pay certificate as part of the [validate merchant](https://developer.apple.com/documentation/apple_pay_on_the_web/applepaysession/1778021-onvalidatemerchant) process.

#### Endpoint

`POST /applepay-sessions`

#### Request Parameters

```
{
    "validationUrl": "The validation url provided by Adyen"
}
```

#### Response Parameters

It returns an opaque Apple Pay session object as described in the [docs](https://developer.apple.com/documentation/apple_pay_on_the_web/apple_pay_js_api/requesting_an_apple_pay_payment_session#3199963)
