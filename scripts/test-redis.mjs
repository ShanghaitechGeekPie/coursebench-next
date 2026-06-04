import { readFileSync } from 'fs';
import Redis from 'ioredis';

const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const url = envContent.match(/^REDIS_URL="(.+)"$/m)?.[1];
if (!url) { console.error('REDIS_URL not found in .env.local'); process.exit(1); }

const redis = new Redis(url);

try {
  // Test basic ops
  await redis.set('test:ping', 'pong', 'EX', 60);
  const val = await redis.get('test:ping');
  console.log('Redis SET/GET:', val);

  await redis.del('test:ping');
  console.log('Redis DEL: OK');

  console.log('\n--- Redis connection test passed! ---');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  redis.disconnect();
}
