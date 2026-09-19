import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
if (!dbUrl) throw new Error("DATABASE_URL missing");

const sql = neon(dbUrl);

async function main() {
  console.log('Adding banner_interval column to stores table if not exists...');
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS banner_interval integer NOT NULL DEFAULT 5`;
  console.log('✓ banner_interval added/verified in stores table.');

  console.log('Verifying banners table columns...');
  const bannerCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'banners' ORDER BY ordinal_position`;
  console.log('banners columns:', bannerCols.map((c: any) => c.column_name).join(', '));
}

main().catch(console.error);
