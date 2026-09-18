import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Running payments column migration...');

  // Add columns to seller_payment_connections
  await sql`
    ALTER TABLE seller_payment_connections
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS provider_user_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_email TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
  `;

  // Add columns to orders
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_id TEXT,
    ADD COLUMN IF NOT EXISTS preference_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
  `;

  console.log('✓ Migration completed successfully.');
}

main().catch(console.error);
