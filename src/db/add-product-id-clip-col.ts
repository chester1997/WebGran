import 'dotenv/config';
import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Running migration for clips table (Adding product_id column)...");
  try {
    await db.execute(sql`
      ALTER TABLE clips 
      ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
    `);
    console.log("Successfully added product_id column to clips table.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main().catch(console.error).finally(() => process.exit(0));
