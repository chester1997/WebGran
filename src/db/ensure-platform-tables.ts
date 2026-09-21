import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Ensuring platform payment tables exist in DB...');

  // 1. Create platform_payment_connections table
  await sql`
    CREATE TABLE IF NOT EXISTS platform_payment_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider TEXT NOT NULL DEFAULT 'MERCADO_PAGO',
      status TEXT NOT NULL DEFAULT 'DISCONNECTED',
      mp_user_id TEXT,
      mp_user_email TEXT,
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      token_expires_at TIMESTAMP,
      connected_at TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Update default provider in invoices table to 'mercado_pago' if needed
  await sql`
    ALTER TABLE invoices ALTER COLUMN provider SET DEFAULT 'mercado_pago';
  `;

  console.log('✓ platform_payment_connections ensured in DB!');
}

main().catch(console.error);
