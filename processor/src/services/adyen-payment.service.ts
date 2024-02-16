import { CommercetoolsCartService, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';

import { PaymentNotification } from './types/adyen-payment.type';

export type MockPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export class MockPaymentService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;

  constructor(opts: MockPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
  }

  public async processNotification(opts: PaymentNotification): Promise<void> {
    // TODO
  }
}
