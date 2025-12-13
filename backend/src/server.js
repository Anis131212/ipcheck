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

// Debug endpoint to check API configuration
fastify.get('/api/debug/config', async (request, reply) => {
  return {
    apis: {
      ipqs: !!process.env.IPQS_KEY,
      abuseipdb: !!process.env.ABUSEIPDB_KEY,
      ip2location: !!process.env.IP2LOCATION_KEY,
      ipdata: !!process.env.IPDATA_KEY,
      cloudflare: !!process.env.CLOUDFLARE_API_TOKEN,
      llm: !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL)
    },
    redis: process.env.REDIS_HOST || 'not configured'
  };
});

// Helper function to check if IP is local/internal
function isLocalOrInternalIP(ip) {
  // Check for localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  // Check for private IPv4 ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0 - 10.255.255.255
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0 - 172.31.255.255
    /^192\.168\./,              // 192.168.0.0 - 192.168.255.255
    /^169\.254\./,              // 169.254.0.0 - 169.254.255.255 (link-local)
  ];

  return privateRanges.some(range => range.test(ip));
}

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

  // Check if IP is local/internal
  if (isLocalOrInternalIP(ip)) {
    return reply.code(400).send({
      error: 'Cannot check local or internal IP addresses',
      details: 'The IP address provided is a local/internal address. Please ensure you are accessing this service from a public IP, or the frontend should auto-detect your public IP.'
    });
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
