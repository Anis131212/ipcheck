import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    enableAutoPipelining: true
});

const CACHE_TTL = 900; // 15 minutes

export async function getOrSetCache(key, fetchFunction) {
    // Check cache
    try {
        const cached = await redis.get(key);
        if (cached) return { ...JSON.parse(cached), fromCache: true };
    } catch (e) {
        console.error('Redis get error:', e);
    }

    // Distributed lock to prevent cache stampede
    const lockKey = `lock:${key}`;
    const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);

    if (acquired) {
        try {
            const data = await fetchFunction();
            await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL);
            return data;
        } catch (e) {
            throw e;
        } finally {
            await redis.del(lockKey);
        }
    }

    // If lock not acquired, wait and retry (simple spin lock)
    await new Promise(r => setTimeout(r, 100));
    return getOrSetCache(key, fetchFunction);
}
