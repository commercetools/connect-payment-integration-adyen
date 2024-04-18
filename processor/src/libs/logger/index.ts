import { createApplicationLogger } from '@commercetools-backend/loggers';
import { defaultFieldsFormatter } from '@commercetools/connect-payments-sdk';
import { config } from '../../config/config';
import { getRequestContext } from '../fastify/context/context';

export const log = createApplicationLogger({
  formatters: [
    defaultFieldsFormatter({
      projectKey: config.projectKey,
      version: process.env.npm_package_version,
      name: process.env.npm_package_name,
      correlationId: () => getRequestContext().correlationId,
      pathTemplate: () => getRequestContext().pathTemplate,
      path: () => getRequestContext().path,
    }),
  ],
});
