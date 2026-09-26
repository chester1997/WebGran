import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;

if (!dbUrl) {
  console.error("No DATABASE_URL found in .env");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  console.log("Adding views_count and show_fire columns to products table if not exists...");
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS show_fire BOOLEAN DEFAULT false;`;
  console.log("Migration executed successfully!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
