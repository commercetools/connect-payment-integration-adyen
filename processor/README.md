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
$ npm install <psp-sdk>
```
#### Install dependencies
```
$ npm install
```
#### Build the application in local environment. NodeJS source codes are then generated under dist folder
```
$ npm run build
```
#### Run automation test
```
$ npm run test
```
#### Run the application in local environment. Remind that the application has been built before it runs
```
$ npm run start
```
#### Fix the code style
```
$ npm run lint:fix
```
#### Verify the code style
```
$ npm run lint
```
#### Run post-deploy script in local environment
```
$ npm run connector:post-deploy
```
#### Run pre-undeploy script in local environment
```
$ npm run connector:pre-undeploy
```

## Running application

Setup correct environment variables: check `processor/src/config/config.ts` for default values.

Make sure commercetools client credential have at least the following permissions:

* `manage_payments`
* `manage_checkout_payment_intents`
* `view_sessions`
* `introspect_oauth_tokens`

```
npm run dev
```

## Authentication

Some of the services have authentication mechanism. 

* `oauth2`: Relies on commercetools OAuth2 server
* `session`: Relies on commercetools session service
* `jwt`: Relies on the jwt token injected by the merchant center via the forward-to proxy

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

####Set environment variable to point to the jwksUrl
```
export CTP_JWKS_URL="http://localhost:9000/jwt/.well-known/jwks.json"
```
####Run the jwt server
```
docker compose up -d
```

####Obtain JWT
```
# Request token
curl --location 'http://localhost:9000/jwt/token' \
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

## APIs
The processor exposes following endpoints to execute various operations with Adyen platform:

### Get payment methods
TBC

### Create payment session
It creates payment resource in composable commerce and create Adyen payment session in payment service provider.
#### Endpoint
`POST /sessions`

#### Request Parameters
The request body is same as [adyen checkout create session request](https://docs.adyen.com/api-explorer/Checkout/69/post/sessions#request) except following parameters are not required
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
- sessionData: The [adyen checkout create session response](https://docs.adyen.com/api-explorer/Checkout/69/post/sessions#responses) returned by Adyen platform after Adyen session created. 
- paymentReference : It represents the unique identifier of payment resource created in composable commerce platform. 

### Create payment
It mainly starts an Ayden payment transaction in payment services provider. If payment reference is absent in request parameters, the endpoint creates payment resource in composable commerce based on data from the cart.
#### Endpoint
`POST /payments`

#### Request Parameters
The request body is same as [adyen checkout create payment request](https://docs.adyen.com/api-explorer/Checkout/69/post/payments#request) except following parameters are not required
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
TBC 

### Get supported payment components
TBC

### Get status
TBC

### Get config
TBC

### Modify payment
TBC