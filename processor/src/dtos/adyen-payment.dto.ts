import { CreateCheckoutSessionRequest } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionRequest';
import { CreateCheckoutSessionResponse } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionResponse';
import { PaymentDetailsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsRequest';
import { PaymentDetailsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsResponse';
import { PaymentMethodsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsRequest';
import { PaymentMethodsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentMethodsResponse';
import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { Notification } from '@adyen/api-library/lib/src/typings/notification/notification';
import { GenericWebhook } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationWebhooksHandler';
import { ConfigResponseSchemaDTO } from './operations/config.dto';
import { PaymentMethod } from '@adyen/api-library/lib/src/typings/checkout/paymentMethod';

export type PaymentMethodsRequestDTO = Omit<PaymentMethodsRequest, 'amount' | 'merchantAccount'>;
export type PaymentMethodsResponseDTO = PaymentMethodsResponse;

export type GetExpressConfigResponseDTO = {
  config: Omit<ConfigResponseSchemaDTO, 'storedPaymentMethodsConfig'>;
  methods: PaymentMethod[] | undefined;
};

export type GetExpressConfigRequestDTO = {
  countryCode: string;
  allowedPaymentMethods: string[];
};

export type CreateSessionRequestDTO = Omit<
  CreateCheckoutSessionRequest,
  | 'amount'
  | 'merchantAccount'
  | 'countryCode'
  | 'returnUrl'
  | 'reference'
  | 'storePaymentMethod'
  | 'shopperReference'
  | 'recurringProcessingModel'
  | 'storePaymentMethodMode'
>;

export type CreateSessionResponseDTO = {
  sessionData: CreateCheckoutSessionResponse;
  paymentReference: string;
};

export type CreatePaymentRequestDTO = Omit<
  PaymentRequest,
  | 'amount'
  | 'additionalAmount'
  | 'merchantAccount'
  | 'countryCode'
  | 'returnUrl'
  | 'lineItems'
  | 'reference'
  | 'shopperReference'
  | 'recurringProcessingModel'
> & {
  paymentReference?: string;
};

export type CreatePaymentResponseDTO = Pick<
  PaymentResponse,
  'action' | 'resultCode' | 'threeDS2ResponseData' | 'threeDS2Result' | 'threeDSPaymentData'
> & {
  paymentReference: string;
  merchantReturnUrl?: string;
};

export type ConfirmPaymentRequestDTO = PaymentDetailsRequest & {
  paymentReference: string;
};

export type ConfirmPaymentResponseDTO = Pick<
  PaymentDetailsResponse,
  'resultCode' | 'threeDS2ResponseData' | 'threeDS2Result' | 'threeDSPaymentData'
> & {
  paymentReference: string;
  merchantReturnUrl: string;
};

export type NotificationRequestDTO = Notification;

export type NotificationTokenizationDTO = GenericWebhook;

export type CreateApplePaySessionRequestDTO = {
  validationUrl: string;
};

export type CreateApplePaySessionResponseDTO = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type ExpressLineItemData = {
  name: string;
  amount: {
    centAmount: number;
    currencyCode: string;
  };
  type: string;
};

export type GetExpressPaymentDataResponseDTO = {
  totalPrice: {
    centAmount: number;
    currencyCode: string;
  };
  lineItems: ExpressLineItemData[];
  currencyCode: string;
};
