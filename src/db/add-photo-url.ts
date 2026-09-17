import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE telegram_bots ADD COLUMN IF NOT EXISTS photo_url text`;
  console.log('✓ photo_url column added to telegram_bots');
}

main().catch(console.error);
