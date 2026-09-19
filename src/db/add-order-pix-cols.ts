import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Running migration for orders table (PIX columns)...");

  await sql`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
    ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
    ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMP;
  `;

  console.log("Migration executed successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
});
