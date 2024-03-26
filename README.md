# connect-payment-integration-adyen
This repository provides a [connect](https://docs.commercetools.com/connect) for integration to Adyen payment service provider (PSP).

## Template Features
- Typescript language supported.
- Uses Fastify as web server framework.
- Uses [commercetools SDK](https://docs.commercetools.com/sdk/js-sdk-getting-started) for the commercetools-specific communication.
- Uses [connect payment SDK](https://github.com/commercetools/connect-payments-sdk) to manage request context, sessions and JWT authentication.
- Includes local development utilities in npm commands to build, start, test, lint & prettify code.

## Prerequisite
#### 1. commercetools composable commerce API client
Users are expected to create API client responsible for payment management in composable commerce project. Details of the API client are taken as input as environment variables/ configuration for connect such as `CTP_PROJECT_KEY` , `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPE`, `CTP_REGION`. For details, please read [Deployment Configuration](./README.md#deployment-configuration).
In addition, please make sure the API client should have enough scope to be able to manage payment. For details, please refer to [Running Application](./processor/README.md#running-application)

#### 2. various URLs from commercetools composable commerce
Various URLs from commercetools platform are required to be configured so that the connect application can handle session and authentication process for endpoints.
Their values are taken as input as environment variables/ configuration for connect with variable names `CTP_API_URL`, `CTP_AUTH_URL` and `CTP_SESSION_URL`.

#### 3. Adyen account credentials
Various account data provided by Adyen are necessary to be configured so that the requests from the connect application can be authenticated by Adyen platform within the integration.
Their values are taken as input as environment variables/ configuration for connect with variable names `ADYEN_API_KEY`, `ADYEN_NOTIFICATION_HMAC_KEY`, `ADYEN_MERCHANT_ACCOUNT`, `ADYEN_CLIENT_KEY`, `ADYEN_LIVE_URL_PREFIX` and `ADYEN_ENVIRONMENT`.

## Getting started
The template contains two modules :  
- Enabler: Acts as a wrapper implementation in which frontend components from Adyen embedded. It gives control to checkout product on when and how to load the connector frontend based on business configuration. In cases connector is used directly and not through Checkout product, the connector library can be loaded directly on frontend than the PSP one.
- Processor : Acts as backend services which is middleware to integrate with Adyen platform. It is mainly responsible for managing transactions with Adyen and updating payment entity in composable commerce.  `connect-payment-sdk` will be offered to be used in connector to manage request context, sessions and other tools necessary to transact.

Regarding the development of processor module, please refer to the following documentations:
- [Development of Processor](./processor/README.md)

#### 1. Register as connector in commercetools Connect
Follow guidelines [here](https://docs.commercetools.com/connect/getting-started) to register the connector for public/private use.

## Deployment Configuration
In order to deploy your customized connector application on commercetools Connect, it needs to be published. For details, please refer to [documentation about commercetools Connect](https://docs.commercetools.com/connect/concepts)
In addition, in order to support connect, the tax integration connector template has a folder structure as listed below
```
├── enabler
│   ├── src
│   ├── test
│   └── package.json
├── processor
│   ├── src
│   ├── test
│   └── package.json
└── connect.yaml
```

Connect deployment configuration is specified in `connect.yaml` which is required information needed for publishing of the application. Following is the deployment configuration used by full ingestion and incremental updater modules
```
deployAs:
  - name: processor
    applicationType: service
    endpoint: /
    configuration:
      standardConfiguration:
        - key: CTP_PROJECT_KEY
          description: Commercetools project key
          required: true
        - key: CTP_REGION
          description: Region of Commercetools project
          required: true
        - key: CTP_AUTH_URL
          description: Commercetools Auth URL
          required: true
        - key: CTP_API_URL
          description: Commercetools API URL
          required: true
        - key: CTP_SESSION_URL
          description: Session API URL
          required: true
        - key: ADYEN_ENVIRONMENT
          description: Adyen environment
          required: true
          default: TEST
        - key: ADYEN_MERCHANT_ACCOUNT
          description: Adyen merchant account
          required: true
        - key: ADYEN_CLIENT_KEY
          description: Adyen client key
          required: true
        - key: ADYEN_LIVE_URL_PREFIX
          description: Adyen live URL prefix
        - key: MERCHANT_RETURN_URL
          description: Merchant return URL
        - key: CTP_JWKS_URL
          description: JWKs url
        - key: CTP_JWT_ISSUER
          description: JWT Issuer for jwt validation
      securedConfiguration:
        - key: CTP_CLIENT_ID
          description: Commercetools client ID
          required: true
        - key: CTP_CLIENT_SECRET
          description: Commercetools client secret
          required: true
        - key: ADYEN_API_KEY
          description: Adyen API key
          required: true
        - key: ADYEN_NOTIFICATION_HMAC_KEY
          description: Adyen HMAC key
          required: true
  - name: enabler
    applicationType: service
    endpoint: /
    configuration:
      securedConfiguration:
        - key: CTP_REGION
          description: Region of Commercetools project
```

Here you can see the details about various variables in configuration
- CTP_PROJECT_KEY: The key of commercetools composable commerce project.
- CTP_CLIENT_ID: The client ID of your commercetools composable commerce user account. It is used in commercetools client to communicate with commercetools composable commerce via SDK.
- CTP_CLIENT_SECRET: The client secret of commercetools composable commerce user account. It is used in commercetools client to communicate with commercetools composable commerce via SDK.
- CTP_SCOPE: The scope constrains the endpoints to which the commercetools client has access, as well as the read/write access right to an endpoint.
- CTP_REGION: As the commercetools composable commerce APIs are provided in six different region, it defines the region which your commercetools composable commerce user account belongs to.
- CTP_AUTH_URL: The URL for authentication in commercetools platform. It is used to generate OAuth 2.0 token which is required in every API call to commercetools composable commerce. The default value is `https://auth.europe-west1.gcp.commercetools.com`. For details, please refer to documentation [here](https://docs.commercetools.com/tutorials/api-tutorial#authentication).
- CTP_API_URL: The URL for commercetools composable commerce API. Default value is `https://api.europe-west1.gcp.commercetools.com`.
- CTP_SESSION_URL: The URL for session creation in commercetools platform. Connectors relies on the session created to be able to share information between enabler and processor. The default value is `https://session.europe-west1.gcp.commercetools.com`.
- CTP_JWKS_URL: The URL which provides JSON Web Key Set.
- CTP_JWT_ISSUER: The issuer inside JSON Web Token which is required in JWT validation process.
- ADYEN_ENVIRONMENT: The indicator of adyen environment.  Default value is `TEST`. It can be configured either as `LIVE` or `TEST`.
- ADYEN_MERCHANT_ACCOUNT: The name of adyen merchant account.
- ADYEN_CLIENT_KEY: Client key provided by Adyen for client-side authentication. For details, please refer to [Adyen client-side authentication](https://docs.adyen.com/development-resources/client-side-authentication).
- ADYEN_LIVE_URL_PREFIX: It represents live endpoint prefix used by Adyen platform. For details, please refer to [Adyen live endpoints](https://docs.adyen.com/development-resources/live-endpoints/).
- MERCHANT_RETURN_URL: The return URL located in merchant platform.
- ADYEN_API_KEY: It represents the API Key used for Ayden request authentication. For details, please refer to [Ayden API key authentication](https://docs.adyen.com/development-resources/api-authentication/#api-key-authentication).
- ADYEN_NOTIFICATION_HMAC_KEY: It represents a hash-based signature within Ayden webhook event. It aims at protecting the connector from any unauthorized webhook event. For details, please refer to [Verify HMAC signatures](https://docs.adyen.com/development-resources/webhooks/verify-hmac-signatures).