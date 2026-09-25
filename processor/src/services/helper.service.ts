import {
  CustomFieldsDraft,
  FieldContainer,
  GenerateInterfaceInteractionCustomFieldsDraft,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { Money } from '@commercetools/platform-sdk';
import { getConfig } from '../config/config';
import {
  AdyenDonationState,
  AdyenPaymentDetailsFields,
  AdyenPaymentDetailsTypeDraft,
  AdyenPaymentDetailsTypeKey,
  GenerateAdyenPaymentDetailsCustomFieldsDraft,
} from '../custom-types/adyen-payment-details';
import { paymentSDK } from '../payment-sdk';
import { PaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRequest';
import { PaymentDetailsRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsRequest';
import { PaymentCaptureRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureRequest';
import { PaymentRefundRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundRequest';
import { PaymentCancelRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelRequest';
import { PaymentReversalRequest } from '@adyen/api-library/lib/src/typings/checkout/paymentReversalRequest';
import { PaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentResponse';
import { PaymentDetailsResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentDetailsResponse';
import { PaymentCaptureResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCaptureResponse';
import { PaymentRefundResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentRefundResponse';
import { PaymentCancelResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentCancelResponse';
import { PaymentReversalResponse } from '@adyen/api-library/lib/src/typings/checkout/paymentReversalResponse';
import { DonationPaymentRequest } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentRequest';
import { DonationPaymentResponse } from '@adyen/api-library/lib/src/typings/checkout/donationPaymentResponse';
import { randomUUID } from 'node:crypto';
import { NotificationRequestDTO } from '../dtos/adyen-payment.dto';

export type AdyenRequestPayload =
  | PaymentRequest
  | PaymentDetailsRequest
  | PaymentCaptureRequest
  | PaymentRefundRequest
  | PaymentCancelRequest
  | PaymentReversalRequest
  | DonationPaymentRequest
  | NotificationRequestDTO;

export type AdyenResponsePayload =
  | PaymentResponse
  | PaymentDetailsResponse
  | PaymentCaptureResponse
  | PaymentRefundResponse
  | PaymentCancelResponse
  | PaymentReversalResponse
  | DonationPaymentResponse;

export type InterfaceInteractionData = {
  interactionId: string;
  type: string;
  createdAt: string;
  request?: AdyenRequestPayload;
  response?: AdyenResponsePayload;
};

const MASKED_FIELDS = new Set([
  // PII — can appear at any depth outside paymentMethod
  'shopperEmail',
  'shopperIP',
  'holderName',
  'storedPaymentMethodId',
  // Noise / opaque blobs
  'riskData',
  'sdkData',
  'checkoutAttemptId',
  'clientData',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Masks every sub-field except `type` since the request paymentMethod block can contain
// raw card data whose field names vary by payment method (encryptedCardNumber, applePayToken, etc.).
function maskPaymentMethod(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'type' ? v : '***']));
}

// Matches dotted keys used in Adyen's additionalData (e.g. "tokenization.storedPaymentMethodId")
// by checking each segment against MASKED_FIELDS.
function shouldMask(key: string): boolean {
  return MASKED_FIELDS.has(key) || (key.includes('.') && key.split('.').some((segment) => MASKED_FIELDS.has(segment)));
}

// Recursively walks the payload and replaces sensitive values with '***'.
// maskPaymentMethodBlock controls whether the paymentMethod object is fully masked — true for
// requests (which carry raw card data) and false for responses (which only carry brand/type metadata).
function maskFields(obj: unknown, maskPaymentMethodBlock: boolean): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => maskFields(item, maskPaymentMethodBlock));
  }
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        if (key === 'paymentMethod' && maskPaymentMethodBlock && isPlainObject(value)) {
          return [key, maskPaymentMethod(value)];
        }
        if (shouldMask(key)) {
          return [key, '***'];
        }
        return [key, maskFields(value, maskPaymentMethodBlock)];
      }),
    );
  }
  return obj;
}

export function maskRequest<T extends AdyenRequestPayload>(req: T): T {
  return maskFields(req, true) as T;
}

export function maskResponse<T extends AdyenResponsePayload>(res: T): T {
  return maskFields(res, false) as T;
}

// Returns a CT CustomFieldsDraft array ready to be appended to `pspInteractions`,
// or undefined when the feature is disabled (ADYEN_SAVE_INTERFACE_INTERACTIONS != "true").
// Both request and response are masked before serialization.
export const populateInterfaceInteraction = (data: InterfaceInteractionData): CustomFieldsDraft[] | undefined => {
  if (!getConfig().saveInterfaceInteractions) {
    return undefined;
  }

  return [
    GenerateInterfaceInteractionCustomFieldsDraft({
      interactionId: data.interactionId,
      type: data.type,
      createdAt: data.createdAt,
      request: data.request !== undefined ? JSON.stringify(maskRequest(data.request)) : undefined,
      response: data.response !== undefined ? JSON.stringify(maskResponse(data.response)) : undefined,
    }),
  ];
};

/** Whether the payment was approved and not reverted afterwards. */
export const isPaymentApproved = (payment: Payment): boolean => {
  const wasReverted = payment.transactions.some(
    (tx) =>
      (tx.type === 'CancelAuthorization' || tx.type === 'Refund') && (tx.state === 'Success' || tx.state === 'Pending'),
  );
  if (wasReverted) return false;

  return payment.transactions.some(
    (tx) => (tx.state === 'Success' || tx.state === 'Pending') && (tx.type === 'Authorization' || tx.type === 'Charge'),
  );
};

/** Ready to be assigned to `pspInteractions`; undefined when the feature is disabled. */
export const buildInterfaceInteraction = (
  type: string,
  request: AdyenRequestPayload,
  response: AdyenResponsePayload | undefined,
): CustomFieldsDraft[] | undefined =>
  populateInterfaceInteraction({
    interactionId: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    request,
    response,
  });

/** Ready to be spread into `ctPaymentService.updatePayment`; the two keys are mutually exclusive. */
export type AdyenPaymentCustomFieldsUpdate = {
  customFields?: CustomFieldsDraft;
  customFieldValues?: FieldContainer;
};

export const getAdyenPaymentCustomFields = (ctPayment: Payment): AdyenPaymentDetailsFields => {
  const fields = ctPayment.custom?.fields ?? {};

  return {
    adyenOrderData: fields['adyenOrderData'] as string | undefined,
    adyenOrderPspReference: fields['adyenOrderPspReference'] as string | undefined,
    adyenDonationToken: fields['adyenDonationToken'] as string | undefined,
    adyenDonationAmount: fields['adyenDonationAmount'] as Money | undefined,
    adyenDonationState: fields['adyenDonationState'] as AdyenDonationState | undefined,
  };
};

/**
 * A payment without a custom type gets the connector's own type assigned. Once a type is in place — the
 * connector's own or a merchant-owned one, in which case the field definitions are added to it — only the values
 * are set, so that neither the type nor any field outside {@link AdyenPaymentDetailsFields} is replaced.
 *
 */
export const buildAdyenPaymentCustomFields = async (
  ctPayment: Payment,
  fields: AdyenPaymentDetailsFields,
): Promise<AdyenPaymentCustomFieldsUpdate> => {
  if (!ctPayment.custom) {
    return {
      customFields: GenerateAdyenPaymentDetailsCustomFieldsDraft(fields),
    };
  }

  const existingType = await paymentSDK.ctCustomTypeService.getById(ctPayment.custom.type.id);

  if (existingType.key !== AdyenPaymentDetailsTypeKey) {
    await paymentSDK.ctCustomTypeService.createOrUpdate({
      ...AdyenPaymentDetailsTypeDraft,
      key: existingType.key,
    });
  }

  // setCustomField only touches the fields given; setCustomType would replace the whole container, dropping
  // every field the caller did not pass — the donation token and the order data among them.
  return {
    customFieldValues: fields as FieldContainer,
  };
};
