import { neon } from '@neondatabase/serverless';

let ensured = false;

export async function ensurePaymentTables() {
  if (ensured) return;

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!dbUrl) return;

  try {
    const sql = neon(dbUrl);

    // 1. Ensure webhook columns exist on seller_payment_connections
    await sql`
      ALTER TABLE seller_payment_connections 
      ADD COLUMN IF NOT EXISTS webhook_id TEXT,
      ADD COLUMN IF NOT EXISTS webhook_secret_encrypted TEXT;
    `;

    // 2. Ensure payment_webhook_events table exists
    await sql`
      CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT,
        connection_id TEXT,
        processed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        payload JSONB,
        CONSTRAINT payment_webhook_events_provider_event_unique UNIQUE (provider, event_id)
      );
    `;

    ensured = true;
  } catch (err) {
    console.error('[ensurePaymentTables] Error ensuring payment columns/tables:', err);
  }
}
