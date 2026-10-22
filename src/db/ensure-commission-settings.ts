import { neon } from '@neondatabase/serverless';

let ensured = false;

export async function ensureCommissionSettings() {
  if (ensured) return;

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!dbUrl) return;

  try {
    const sql = neon(dbUrl);

    // 1. Ensure platform_commission_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS platform_commission_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fee_cents INTEGER NOT NULL DEFAULT 50,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_by_id UUID,
        updated_by_name TEXT,
        updated_by_email TEXT
      );
    `;

    // 2. Ensure platform_commission_audit_logs table exists
    await sql`
      CREATE TABLE IF NOT EXISTS platform_commission_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        previous_fee_cents INTEGER NOT NULL,
        new_fee_cents INTEGER NOT NULL,
        changed_by_id UUID,
        changed_by_name TEXT,
        changed_by_email TEXT,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // 3. Ensure initial configuration exists with 50 cents (R$ 0,50)
    await sql`
      INSERT INTO platform_commission_settings (fee_cents, updated_at, updated_by_name)
      SELECT 50, NOW(), 'SISTEMA'
      WHERE NOT EXISTS (SELECT 1 FROM platform_commission_settings LIMIT 1);
    `;

    ensured = true;
  } catch (err) {
    console.error('[ensureCommissionSettings] Error ensuring commission settings tables:', err);
  }
}
