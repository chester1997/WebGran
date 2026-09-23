import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

async function run() {
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  console.log("Creating coupons table and updating orders table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "coupons" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
      "code" text NOT NULL,
      "discount_type" text NOT NULL DEFAULT 'percentage',
      "discount_value" numeric(10, 2) NOT NULL,
      "min_order_value" numeric(10, 2) DEFAULT 0,
      "max_uses" integer,
      "used_count" integer NOT NULL DEFAULT 0,
      "expires_at" timestamp,
      "status" text NOT NULL DEFAULT 'active',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "coupons_store_id_code_unique" UNIQUE ("store_id", "code")
    );
  `);

  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" text;
  `);

  console.log("DB migration completed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
