import { FastifyReply, FastifyRequest } from 'fastify';
import { getConfig } from '../../../config/config';
import { log } from '../../logger';

export const corsAuthHook = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const hostHeader =
      request.headers['x-forwarded-host'] || request.headers['x-forwarded-server'] || request.headers.host;

    const origin = request.headers.origin;
    const allowedOrigins =
      getConfig()
        .allowedOrigins?.split(',')
        .map((o) => o.trim().replace(/\/$/, '')) ?? [];

    const normalizedOrigin = origin?.replace(/\/$/, '');

    // for debugging purposes, log this here to know what host originally makes the request. Will help with resolving cors errors reported by clients in the future
    log.info('CORS check', {
      origin,
      normalizedOrigin,
      hostHeader,
      ips: request.ips,
      ip: request.ip,
    });

    if (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin)) {
      reply.code(403).send({ error: 'Forbidden', message: 'CORS origin not allowed.' });
      return;
    }

    // set this header so browser knows it's safe to use the response.
    reply.header('Access-Control-Allow-Origin', origin);
  };
};
