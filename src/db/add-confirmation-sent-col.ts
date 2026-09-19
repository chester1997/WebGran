import 'dotenv/config';
import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Running migration for accesses table (confirmation_sent_at)...");
  try {
    await db.execute(sql`
      ALTER TABLE accesses 
      ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamp;
    `);
    console.log("Successfully added confirmation_sent_at column to accesses table.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main().catch(console.error).finally(() => process.exit(0));
