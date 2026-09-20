import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE product_carousels 
    ADD COLUMN IF NOT EXISTS indicator_type TEXT NOT NULL DEFAULT 'BAR';
  `;

  await sql`
    ALTER TABLE product_carousels 
    ADD COLUMN IF NOT EXISTS icon_name TEXT;
  `;

  await sql`
    ALTER TABLE product_carousels 
    ADD COLUMN IF NOT EXISTS icon_color TEXT;
  `;

  // Set default icon for existing ranking carousels
  await sql`
    UPDATE product_carousels 
    SET indicator_type = 'ICON', icon_name = 'Trophy', icon_color = '#FFD700' 
    WHERE is_ranking = true AND (icon_name IS NULL OR indicator_type = 'BAR');
  `;

  console.log('✓ Carousel icon columns indicator_type, icon_name, icon_color added/ensured');
}

main().catch(console.error);
