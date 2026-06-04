import { readFileSync } from 'fs';
import postgres from 'postgres';

// Load .env.local
const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const dbUrl = envContent.match(/^DATABASE_URL="(.+)"$/m)?.[1];
if (!dbUrl) { console.error('DATABASE_URL not found in .env.local'); process.exit(1); }

const sql = postgres(dbUrl);

try {
  const result = await sql`SELECT current_database(), current_user`;
  console.log('Connection OK:', result[0]);

  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log('Tables:', tables.map(t => t.tablename));

  const users = await sql`SELECT count(*) as cnt FROM users`;
  console.log('Users:', users[0].cnt);

  const courses = await sql`SELECT count(*) as cnt FROM courses`;
  console.log('Courses:', courses[0].cnt);

  const comments = await sql`SELECT count(*) as cnt FROM comments`;
  console.log('Comments:', comments[0].cnt);

  const teachers = await sql`SELECT count(*) as cnt FROM teachers`;
  console.log('Teachers:', teachers[0].cnt);

  const courseGroups = await sql`SELECT count(*) as cnt FROM course_groups`;
  console.log('Course Groups:', courseGroups[0].cnt);

  const sampleUser = await sql`SELECT id, email, nick_name, is_active, is_admin FROM users LIMIT 3`;
  console.log('Sample users:', JSON.stringify(sampleUser, null, 2));

  const sampleCourse = await sql`SELECT id, name, code, institute, scores FROM courses LIMIT 2`;
  console.log('Sample courses:', JSON.stringify(sampleCourse, null, 2));

  // Check column names match our Drizzle schema
  const userCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`;
  console.log('User columns:', userCols.map(c => `${c.column_name}(${c.data_type})`).join(', '));

  console.log('\n--- All checks passed! ---');
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await sql.end();
}
