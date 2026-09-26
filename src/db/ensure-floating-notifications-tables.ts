import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED!);

async function main() {
  console.log('Ensuring floating notification tables and columns exist in DB...');

  // 1. Add columns to stores table if not exists
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS floating_notifications_enabled BOOLEAN NOT NULL DEFAULT true;`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS floating_notifications_pages JSONB DEFAULT '["home", "product", "category", "search"]'::jsonb;`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS floating_notifications_display_duration INTEGER NOT NULL DEFAULT 5;`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS floating_notifications_interval_min INTEGER NOT NULL DEFAULT 15;`;
  await sql`ALTER TABLE stores ADD COLUMN IF NOT EXISTS floating_notifications_interval_max INTEGER NOT NULL DEFAULT 30;`;

  // 2. Create store_floating_notifications table
  await sql`
    CREATE TABLE IF NOT EXISTS store_floating_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      text TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🔥',
      enabled BOOLEAN NOT NULL DEFAULT true,
      position INTEGER NOT NULL DEFAULT 0,
      count_min INTEGER DEFAULT 5,
      count_max INTEGER DEFAULT 18,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 3. Create indexes
  await sql`CREATE INDEX IF NOT EXISTS store_floating_notifications_store_id_idx ON store_floating_notifications(store_id);`;
  await sql`CREATE INDEX IF NOT EXISTS store_floating_notifications_store_enabled_idx ON store_floating_notifications(store_id, enabled);`;
  await sql`CREATE INDEX IF NOT EXISTS store_floating_notifications_store_product_idx ON store_floating_notifications(store_id, product_id);`;

  console.log('✓ Floating notifications schema successfully ensured in DB!');
}

main().catch(console.error);
