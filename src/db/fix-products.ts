import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Add bot_id column to products if missing
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS bot_id uuid REFERENCES telegram_bots(id) ON DELETE SET NULL`;
  console.log('✓ bot_id column ensured in products');
  
  // Verify
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`;
  console.log('Products columns:', cols.map((c: any) => c.column_name).join(', '));
}

main().catch(console.error);
