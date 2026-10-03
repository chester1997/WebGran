import dotenv from "dotenv";
dotenv.config();

export async function ensureProductVideoTables() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  try {
    // 1. Create product_videos table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        bunny_video_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER,
        file_size_bytes BIGINT,
        thumbnail_url TEXT,
        status TEXT NOT NULL DEFAULT 'UPLOADING',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Make product_id nullable and add file_size_bytes if upgrading existing table
    await db.execute(sql`ALTER TABLE product_videos ALTER COLUMN product_id DROP NOT NULL;`);
    await db.execute(sql`ALTER TABLE product_videos ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;`);

    // 2. Create product_videos indexes individually
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_bunny_video_id_idx ON product_videos(bunny_video_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_store_id_idx ON product_videos(store_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_product_id_idx ON product_videos(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_store_product_idx ON product_videos(store_id, product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_status_idx ON product_videos(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_videos_store_product_position_idx ON product_videos(store_id, product_id, position);`);

    // 3. Create product_video_assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_video_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        video_id UUID NOT NULL REFERENCES product_videos(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT product_video_assignments_unique UNIQUE (product_id, video_id)
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_video_assignments_store_id_idx ON product_video_assignments(store_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_video_assignments_product_id_idx ON product_video_assignments(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_video_assignments_video_id_idx ON product_video_assignments(video_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_video_assignments_store_product_idx ON product_video_assignments(store_id, product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS product_video_assignments_store_video_idx ON product_video_assignments(store_id, video_id);`);

    // 4. Create video_progress table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS video_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES telegram_customers(id) ON DELETE CASCADE,
        product_video_id UUID NOT NULL REFERENCES product_videos(id) ON DELETE CASCADE,
        position_seconds INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        progress_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT false,
        last_watched_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT video_progress_customer_video_unique UNIQUE (customer_id, product_video_id)
      );
    `);

    // 5. Create video_progress indexes individually
    await db.execute(sql`CREATE INDEX IF NOT EXISTS video_progress_customer_video_idx ON video_progress(customer_id, product_video_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS video_progress_store_idx ON video_progress(store_id);`);

    console.log('[ensureProductVideoTables] Migration applied successfully.');
  } catch (err) {
    console.error('[ensureProductVideoTables] Error ensuring tables:', err);
    throw err;
  }
}

// Allow direct execution via CLI script
if (typeof process !== "undefined" && process.argv[1] && process.argv[1].includes("ensure-product-video-tables")) {
  ensureProductVideoTables()
    .then(() => {
      console.log("Migration script execution finished.");
    })
    .catch((err) => {
      console.error("Migration failed:", err);
    });
}

