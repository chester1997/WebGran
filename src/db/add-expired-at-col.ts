import 'dotenv/config';
import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Running migration for accesses table (expired_at)...");
  try {
    await db.execute(sql`
      ALTER TABLE accesses 
      ADD COLUMN IF NOT EXISTS expired_at timestamp;
    `);
    console.log("Successfully added expired_at column to accesses table.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main().catch(console.error).finally(() => process.exit(0));
