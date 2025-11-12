import { FastifyReply, FastifyRequest } from 'fastify';
import { getConfig } from '../../../config/config';

export const corsAuthHook = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    const allowedOrigins =
      getConfig()
        .allowedOrigins?.split(',')
        .map((o) => o.trim().replace(/\/$/, '')) ?? [];

    console.log(allowedOrigins);

    if (!origin || !allowedOrigins.includes(origin)) {
      reply.code(403).send();
    }
  };
};
