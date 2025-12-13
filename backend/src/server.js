import Fastify from 'fastify';
import cors from '@fastify/cors';
import { checkIPQuality } from './services/ipCheck.js';
import { getOrSetCache } from './utils/redis.js';
import 'dotenv/config';

const fastify = Fastify({
  logger: true,
  trustProxy: true, // Enable proxy trust to get real IP from Nginx
  bodyLimit: 1048576  // 1MB
});

// Register CORS
await fastify.register(cors, {
  origin: true // Allow all origins for now, configure for production later
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// IP Check Route
fastify.get('/api/check', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        ip: { type: 'string' } // Relaxed validation for now, can add format: 'ipv4' later
      }
    }
  }
}, async (request, reply) => {
  const ip = request.query.ip || request.ip;

  // Basic IP validation
  const { isIP } = await import('net');
  if (isIP(ip) === 0) {
    return reply.code(400).send({ error: 'Invalid IP address' });
  }

  try {
    // Redis cache wrapper
    const cacheKey = `ip:check:${ip}`;
    // Pass a function that returns a promise
    const result = await getOrSetCache(cacheKey, () => checkIPQuality(ip));
    return result;
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: error.message });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
