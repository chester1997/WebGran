import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE stores 
    ADD COLUMN IF NOT EXISTS category_display_style TEXT NOT NULL DEFAULT 'IMAGE';
  `;

  await sql`
    ALTER TABLE categories 
    ADD COLUMN IF NOT EXISTS icon_name TEXT;
  `;

  console.log('✓ Category columns category_display_style and icon_name added/ensured');
}

main().catch(console.error);
