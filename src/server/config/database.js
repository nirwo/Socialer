import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

// Prisma Client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Redis Client instance
const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

// Connect to Redis
await redis.connect();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await redis.quit();
});

export { prisma, redis };