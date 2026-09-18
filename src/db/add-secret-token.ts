import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Adding secret_token column to telegram_bots table...");
  await sql`
    ALTER TABLE telegram_bots 
    ADD COLUMN IF NOT EXISTS secret_token text;
  `;
  console.log("Migration executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
