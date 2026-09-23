import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS badge TEXT;
  `;

  console.log('✓ Column "badge" successfully added/ensured in table "products"');
}

main().catch(console.error);
