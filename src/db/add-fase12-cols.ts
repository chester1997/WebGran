import 'dotenv/config';
import { db } from './index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Running migration for accesses table (Phase 12 columns)...");
  try {
    await db.execute(sql`
      ALTER TABLE accesses 
      ADD COLUMN IF NOT EXISTS invite_expires_at timestamp,
      ADD COLUMN IF NOT EXISTS revocation_status text,
      ADD COLUMN IF NOT EXISTS revocation_error text,
      ADD COLUMN IF NOT EXISTS revoked_at timestamp;
    `);
    console.log("Successfully added Phase 12 columns (invite_expires_at, revocation_status, revocation_error, revoked_at) to accesses table.");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

main().catch(console.error).finally(() => process.exit(0));
