// import {
//   TokenizationWebhooksHandler,
//   GenericWebhook,
// } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationWebhooksHandler';
// import { TokenizationCreatedDetailsNotificationRequest } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/tokenizationCreatedDetailsNotificationRequest';
// import { TokenizationNotificationResponse } from '@adyen/api-library/lib/src/typings/tokenizationWebhooks/models';
import { NotificationTokenizationDTO } from '../../dtos/adyen-payment.dto';

// TODO: SCC-3447: add support for the recurring.token.created event. This is part of a new webhook called "Recurring tokens life cycle events". Which is different from the standard one.
// TODO: SCC-3447: The token and the rest of the payment details must be stored in the commercetools Payment entity. This must be copied over from the CoCo payment-method using the update action "setMethodInfo"
// TODO: SCC-3447: during the handeling of the recurring.token.created event retrieve the displayable information and store it as a custom type. Specifically: name, endDigits, brand, expireMonth, expireYear and logoUrl

// TODO: SCC-3447: implement NotificationRecurringConverter
export class NotificationTokenizationConverter {
  public async convert(opts: { data: NotificationTokenizationDTO }): Promise<void> {}
}
