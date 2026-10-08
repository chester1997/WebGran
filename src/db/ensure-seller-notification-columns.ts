import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Ensuring seller notification columns in stores and orders tables...");
  await sql`
    ALTER TABLE stores 
    ADD COLUMN IF NOT EXISTS telegram_notification_id text;

    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS seller_notification_sent_at timestamp,
    ADD COLUMN IF NOT EXISTS seller_notification_claimed_at timestamp;
  `;
  console.log("Migration executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
