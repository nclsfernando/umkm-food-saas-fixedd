/**
 * Ensure Prisma Client is generated even when DATABASE_URL is unset (Vercel build).
 * Does not print secrets.
 */
const { execSync } = require('child_process');

if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
  process.env.DATABASE_URL = 'postgresql://build:build@127.0.0.1:5432/build';
}

execSync('npx prisma generate', { stdio: 'inherit', env: process.env });
