import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // The deployment environment already provides DATABASE_URL.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile(new URL('../database/push.sql', import.meta.url), 'utf8');
const statements = schema
  .split(/;\s*(?=CREATE )/)
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log('Neon push schema is ready.');
