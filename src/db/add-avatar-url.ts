import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`;
  console.log('✓ avatar_url column added to users table');
}

main().catch(console.error);
