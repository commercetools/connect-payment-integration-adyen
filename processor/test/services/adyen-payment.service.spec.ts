import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import { ConfigResponse, ModifyPayment, StatusResponse } from '../../src/services/types/operation.type';
import { paymentSDK } from '../../src/payment-sdk';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import {
    mockGetPaymentResult,
    mockUpdatePaymentResult,
    mockAdyenPaymentMethodsResponse,
    mockAdyenCancelPaymentResponse,
    mockAdyenCapturePaymentResponse,
    mockAdyenRefundPaymentResponse
} from '../utils/mock-payment-data';
import * as Config from '../../src/config/config';
import { AbstractPaymentService } from '../../src/services/abstract-payment.service';
import { AdyenPaymentService } from '../../src/services/adyen-payment.service';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import { PaymentsApi } from '@adyen/api-library/lib/src/services/checkout/paymentsApi';
import { ModificationsApi } from '@adyen/api-library/lib/src/services/checkout/modificationsApi';



import {
    CommercetoolsCartService,
    CommercetoolsPaymentService,
    HealthCheckResult
} from '@commercetools/connect-payments-sdk';
import {SupportedPaymentComponentsSchemaDTO} from "../../src/dtos/operations/payment-componets.dto";


interface FlexibleConfig {
    [key: string]: string; // Adjust the type according to your config values
}

export type AdyenPaymentServiceOptions = {
    ctCartService: CommercetoolsCartService;
    ctPaymentService: CommercetoolsPaymentService;
};

function setupMockConfig(keysAndValues: Record<string, string>) {
    const mockConfig: FlexibleConfig = {};
    Object.keys(keysAndValues).forEach((key) => {
        mockConfig[key] = keysAndValues[key];
    });

    jest.spyOn(Config, 'getConfig').mockReturnValue(mockConfig as any);
}

describe('adyen-payment.service', () => {
    const opts: AdyenPaymentServiceOptions = {
        ctCartService: paymentSDK.ctCartService,
        ctPaymentService: paymentSDK.ctPaymentService,
    };

    const paymentService: AbstractPaymentService = new AdyenPaymentService(opts);

    beforeEach(() => {
        jest.setTimeout(10000);
        jest.resetAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('getConfig', async () => {
        // Setup mock config for a system using `clientKey`
        setupMockConfig({ mockClientKey: '', mockEnvironment: 'test' });

        const result: ConfigResponse = await paymentService.config();

        // Assertions can remain the same or be adapted based on the abstracted access
        expect(result?.clientKey).toStrictEqual('');
        expect(result?.environment).toStrictEqual('');
    });

    test('getSupportedPaymentComponents', async () => {
        const result: SupportedPaymentComponentsSchemaDTO = await paymentService.getSupportedPaymentComponents();
        expect(result?.components).toHaveLength(4);
        expect(result?.components[0]?.type).toStrictEqual('card');
        expect(result?.components[1]?.type).toStrictEqual('ideal');
        expect(result?.components[2]?.type).toStrictEqual('paypal');
        expect(result?.components[3]?.type).toStrictEqual('sofort');
    });

    test('getStatus', async () => {
        const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => {
            const result: HealthCheckResult = {
                name: 'CoCo Permissions',
                status: 'DOWN',
                details: {},
            };
            return result;
        };

        jest.spyOn(PaymentsApi.prototype, 'paymentMethods').mockResolvedValue(mockAdyenPaymentMethodsResponse);
        jest.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
        const result: StatusResponse = await paymentService.status();

        expect(result?.status).toBeDefined();
        expect(result?.checks).toHaveLength(2);
        expect(result?.status).toStrictEqual('Partially Available');
        expect(result?.checks[0]?.name).toStrictEqual('CoCo Permissions');
        expect(result?.checks[0]?.status).toStrictEqual('DOWN');
        expect(result?.checks[0]?.details).toStrictEqual({});
        expect(result?.checks[1]?.name).toStrictEqual('Adyen Status check');
        expect(result?.checks[1]?.status).toStrictEqual('UP');
        expect(result?.checks[1]?.details).toBeDefined();
    });

    test('cancelPayment', async () => {
        const modifyPaymentOpts: ModifyPayment = {
            paymentId: 'dummy-paymentId',
            data: {
                actions: [
                    {
                        action: 'cancelPayment',
                    },
                ],
            },
        };

        jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(ModificationsApi.prototype, 'cancelAuthorisedPaymentByPspReference').mockResolvedValue(mockAdyenCancelPaymentResponse);

        const result = await paymentService.modifyPayment(modifyPaymentOpts);
        expect(result?.outcome).toStrictEqual('received');
    });

    test('capturePayment', async () => {
        const modifyPaymentOpts: ModifyPayment = {
            paymentId: 'dummy-paymentId',
            data: {
                actions: [
                    {
                        action: 'capturePayment',
                        amount: {
                            centAmount: 150000,
                            currencyCode: 'USD',
                        },
                    },
                ],
            },
        };

        jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(ModificationsApi.prototype, 'captureAuthorisedPayment').mockResolvedValue(mockAdyenCapturePaymentResponse);

        const result = await paymentService.modifyPayment(modifyPaymentOpts);
        expect(result?.outcome).toStrictEqual('received');
    });

    test('refundPayment', async () => {
        const modifyPaymentOpts: ModifyPayment = {
            paymentId: 'dummy-paymentId',
            data: {
                actions: [
                    {
                        action: 'refundPayment',
                        amount: {
                            centAmount: 150000,
                            currencyCode: 'USD',
                        },
                    },
                ],
            },
        };

        jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(mockGetPaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(DefaultPaymentService.prototype, 'updatePayment').mockResolvedValue(mockUpdatePaymentResult);
        jest.spyOn(ModificationsApi.prototype, 'refundCapturedPayment').mockResolvedValue(mockAdyenRefundPaymentResponse);

        const result = await paymentService.modifyPayment(modifyPaymentOpts);
        expect(result?.outcome).toStrictEqual('received');
    });
});
