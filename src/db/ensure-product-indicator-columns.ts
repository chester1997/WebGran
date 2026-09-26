import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED!);

async function main() {
  console.log('Ensuring product indicator columns (show_views, fire_count) exist in DB...');

  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS show_views BOOLEAN DEFAULT false;`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS fire_count INTEGER DEFAULT 0;`;

  console.log('✓ Product indicator columns successfully ensured in DB!');
}

main().catch(console.error);
