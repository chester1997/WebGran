import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Adding welcome columns to stores table...");
  await sql`
    ALTER TABLE stores 
    ADD COLUMN IF NOT EXISTS welcome_message text,
    ADD COLUMN IF NOT EXISTS welcome_banners jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS support_type text DEFAULT 'telegram',
    ADD COLUMN IF NOT EXISTS support_value text;
  `;
  console.log("Migration executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
