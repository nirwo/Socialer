import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/socialer_test'
    }
  }
});

beforeAll(async () => {
  // Setup test database
  console.log('Setting up test database...');
});

afterAll(async () => {
  // Cleanup test database
  await prisma.$disconnect();
  console.log('Test database disconnected');
});

beforeEach(async () => {
  // Clean up data before each test
  await prisma.notification.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.share.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.user.deleteMany({});
});

export { prisma };