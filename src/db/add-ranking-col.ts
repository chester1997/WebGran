import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
if (!dbUrl) throw new Error("DATABASE_URL missing");

const sql = neon(dbUrl);

async function main() {
  console.log('Adding is_ranking column to product_carousels table if not exists...');
  await sql`ALTER TABLE product_carousels ADD COLUMN IF NOT EXISTS is_ranking boolean NOT NULL DEFAULT false`;
  console.log('✓ is_ranking column added/verified in product_carousels table.');
}

main().catch(console.error);
