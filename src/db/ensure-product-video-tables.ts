import { db } from '@/db';
import { sql } from 'drizzle-orm';

let ensured = false;

export async function ensureProductVideoTables() {
  if (ensured) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        bunny_video_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER,
        thumbnail_url TEXT,
        status TEXT NOT NULL DEFAULT 'UPLOADING',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS product_videos_bunny_video_id_idx ON product_videos(bunny_video_id);
      CREATE INDEX IF NOT EXISTS product_videos_store_id_idx ON product_videos(store_id);
      CREATE INDEX IF NOT EXISTS product_videos_product_id_idx ON product_videos(product_id);
      CREATE INDEX IF NOT EXISTS product_videos_store_product_idx ON product_videos(store_id, product_id);
      CREATE INDEX IF NOT EXISTS product_videos_status_idx ON product_videos(status);
      CREATE INDEX IF NOT EXISTS product_videos_store_product_position_idx ON product_videos(store_id, product_id, position);
    `);

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

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS video_progress_customer_video_idx ON video_progress(customer_id, product_video_id);
      CREATE INDEX IF NOT EXISTS video_progress_store_idx ON video_progress(store_id);
    `);

    ensured = true;
  } catch (err) {
    console.error('[ensureProductVideoTables] Error ensuring tables:', err);
    throw err;
  }
}
