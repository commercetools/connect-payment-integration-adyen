import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

const HEADERS_ORDER = [
  'x-client-ip', // Most common
  'x-forwarded-for', // Mostly used by proxies
  'cf-connecting-ip', // Cloudflare
  'Cf-Pseudo-IPv4', // Cloudflare
  'fastly-client-ip',
  'true-client-ip', // Akamai and Cloudflare
  'x-real-ip', // Nginx
  'x-cluser-client-ip', // Rackspace LB
  'forwarded-for',
  'x-forwarded',
  'forwarded',
  'x-appengine-user-ip', // GCP App Engine
];

type HeaderKey = (typeof HEADERS_ORDER)[number];

declare module 'fastify' {
  interface FastifyRequest {
    clientIp: string;
  }
}

function extractIpFromHeader(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) value = value[0];
  return value.split(',')[0].trim();
}

export const requestIpPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorateRequest('clientIp', '');

  fastify.addHook('onRequest', async (request) => {
    let ip = '';

    for (const header of HEADERS_ORDER) {
      const value = request.headers[header as HeaderKey] as string | undefined;
      const extracted = extractIpFromHeader(value);
      if (extracted) {
        ip = extracted;
        break;
      }
    }

    if (!ip) {
      ip = request.ip;
    }

    request.clientIp = ip;
  });
});
