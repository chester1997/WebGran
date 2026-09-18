import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Running migration for accesses table...");

  await sql`
    ALTER TABLE accesses 
    ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'telegram',
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
    ADD COLUMN IF NOT EXISTS invite_link TEXT,
    ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS delivery_error TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `;

  await sql`
    UPDATE accesses SET status = 'ACTIVE' WHERE status = 'active';
  `;
  await sql`
    UPDATE accesses SET delivery_status = 'DELIVERED' WHERE status = 'ACTIVE';
  `;

  console.log("Migration executed successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
});
