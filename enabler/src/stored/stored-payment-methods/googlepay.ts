import {
  CocoStoredPaymentMethod,
  OnComplete,
  PaymentMethod,
  StoredComponent,
  StoredComponentBuilder,
  StoredComponentOptions,
} from "../../payment-enabler/payment-enabler";
import { BaseOptions, StoredPaymentMethodsConfig } from "../../payment-enabler/adyen-payment-enabler";
import { ProcessorApiClient } from "../../api/processor-api.client";

/**
 * Stored Google Pay "component".
 *
 * A previously tokenized Google Pay payment is charged by Adyen as a plain scheme (card) token —
 * there is no wallet UI to show again for a repeat charge. This renders no Adyen component; the
 * host app's existing "Pay now" button triggers submit(), which charges the stored token directly
 * with `{ type: "googlepay", storedPaymentMethodId }`.
 */
export class StoredGooglePayBuilder implements StoredComponentBuilder {
  public componentHasSubmit = true;

  private sessionId: string;
  private processorUrl: string;
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private onComplete?: OnComplete;

  constructor(baseOptions: BaseOptions) {
    this.sessionId = baseOptions.sessionId;
    this.processorUrl = baseOptions.processorUrl;
    this.storedPaymentMethodsConfig = baseOptions.storedPaymentMethodsConfig;
    this.onComplete = baseOptions.onComplete;
  }

  build(config: StoredComponentOptions): StoredComponent {
    const cocoStoredPaymentMethod = this.storedPaymentMethodsConfig.storedPaymentMethods.find(
      (spm) => spm.id === config.id,
    );

    if (!cocoStoredPaymentMethod) {
      throw new Error(
        `Received stored payment method id "${config.id}" however that is not an available id to use. Available ones are: [${this.storedPaymentMethodsConfig.storedPaymentMethods.map((spm) => spm.id).join(", ")}]`,
      );
    }

    return new StoredGooglePayComponent({
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      cocoStoredPaymentMethod,
      onComplete: this.onComplete,
    });
  }
}

class StoredGooglePayComponent implements StoredComponent {
  private apiClient: ProcessorApiClient;
  private cocoStoredPaymentMethod: CocoStoredPaymentMethod;
  private onComplete?: OnComplete;

  constructor(opts: {
    sessionId: string;
    processorUrl: string;
    cocoStoredPaymentMethod: CocoStoredPaymentMethod;
    onComplete?: OnComplete;
  }) {
    this.apiClient = new ProcessorApiClient({ processorUrl: opts.processorUrl, sessionId: opts.sessionId });
    this.cocoStoredPaymentMethod = opts.cocoStoredPaymentMethod;
    this.onComplete = opts.onComplete;
  }

  async mount(selector: string | HTMLElement): Promise<void> {
    const node = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (node) {
      node.innerHTML = "<div>Pay with the saved Google Pay method</div>";
    }
  }

  async submit(): Promise<void> {
    let paymentReference = "";
    let reported = false;

    const report = (isSuccess: boolean) => {
      if (reported) return;
      reported = true;
      this.onComplete?.({ isSuccess, paymentReference, method: { type: PaymentMethod.googlepay } });
    };

    try {
      const data = await this.apiClient.createPayment({
        paymentMethod: {
          type: PaymentMethod.googlepay,
          storedPaymentMethodId: this.cocoStoredPaymentMethod.token,
        },
      });

      paymentReference = data.paymentReference;

      if (data.action) {
        throw new Error("Received an unexpected additional action while paying with a stored Google Pay token");
      }

      const isSuccess = data.resultCode === "Authorised" || data.resultCode === "Pending";
      report(isSuccess);

      if (!isSuccess) {
        throw new Error(`Payment was not authorised: ${data.resultCode}`);
      }
    } catch (error) {
      report(false);
      throw error;
    }
  }

  async remove(): Promise<void> {
    await this.apiClient.deleteStoredPaymentMethod(this.cocoStoredPaymentMethod.id);
  }
}
