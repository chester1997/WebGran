import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating telegram_bot_chats table if not exists...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS telegram_bot_chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      bot_id UUID NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
      telegram_chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      username TEXT,
      photo_url TEXT,
      bot_status TEXT NOT NULL DEFAULT 'administrator',
      can_invite_users BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT telegram_bot_chats_bot_chat_unique UNIQUE (bot_id, telegram_chat_id)
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS telegram_bot_chats_store_bot_idx ON telegram_bot_chats(store_id, bot_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS telegram_bot_chats_store_active_idx ON telegram_bot_chats(store_id, is_active);
  `);

  console.log("Successfully created telegram_bot_chats table and indexes.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
