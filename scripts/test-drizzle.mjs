import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const dbUrl = envContent.match(/^DATABASE_URL="(.+)"$/m)?.[1];
process.env.DATABASE_URL = dbUrl;

const postgres = (await import('postgres')).default;
const { drizzle } = await import('drizzle-orm/postgres-js');
const { eq, isNull, desc } = await import('drizzle-orm');

// Import schema dynamically (it's TypeScript, so we need the compiled version)
// Instead, define inline for this test
const { pgTable, bigserial, text, bigint, boolean, timestamp } = await import('drizzle-orm/pg-core');

function bigintCol(name) { return bigint(name, { mode: 'number' }); }

const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  email: text('email'),
  nickName: text('nick_name'),
  isActive: boolean('is_active'),
  isAdmin: boolean('is_admin'),
  reward: bigintCol('reward'),
});

const courses = pgTable('courses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  name: text('name'),
  code: text('code'),
  scores: bigint('scores', { mode: 'number' }).array(),
  commentCount: bigintCol('comment_count'),
});

const sql = postgres(dbUrl);
const db = drizzle(sql, { schema: { users, courses } });

try {
  // Test basic select
  const userRows = await db.select().from(users).where(isNull(users.deletedAt)).limit(3);
  console.log('Users (via Drizzle):', userRows.map(u => ({ id: u.id, email: u.email, nick: u.nickName })));

  // Test courses with scores array
  const courseRows = await db.select().from(courses).where(isNull(courses.deletedAt)).limit(3);
  console.log('Courses (via Drizzle):', courseRows.map(c => ({ id: c.id, name: c.name, scores: c.scores, commentCount: c.commentCount })));

  // Verify types
  const u = userRows[0];
  console.log('id type:', typeof u.id, '| reward type:', typeof u.reward);

  const c = courseRows[0];
  console.log('scores type:', typeof c.scores?.[0], '| commentCount type:', typeof c.commentCount);

  console.log('\n--- Drizzle connection test passed! ---');
} catch (e) {
  console.error('ERROR:', e);
  process.exit(1);
} finally {
  await sql.end();
}
