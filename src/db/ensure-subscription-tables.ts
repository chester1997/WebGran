import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Ensuring subscription tables exist in DB...');

  // 1. Create subscription_plans table
  await sql`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      billing_interval TEXT NOT NULL DEFAULT 'month',
      features JSONB NOT NULL DEFAULT '{}',
      max_products INTEGER,
      max_bots INTEGER,
      max_customers INTEGER,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Create subscriptions table
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id UUID NOT NULL REFERENCES subscription_plans(id),
      status TEXT NOT NULL DEFAULT 'PENDING',
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
      current_period_end TIMESTAMP NOT NULL,
      cancelled_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 3. Create invoices table
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'cora',
      external_id TEXT,
      amount DECIMAL(10, 2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      due_date TIMESTAMP NOT NULL,
      paid_at TIMESTAMP,
      qr_code TEXT,
      qr_code_text TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 4. Create system_settings table
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 5. Seed single WebGran R$ 89,90 plan if missing
  await sql`
    INSERT INTO subscription_plans (name, slug, description, price, billing_interval, active)
    VALUES ('WebGran', 'webgran', 'Plano Único WebGran SaaS', 89.90, 'month', true)
    ON CONFLICT (slug) DO NOTHING;
  `;

  console.log('✓ Subscription tables, system_settings, and default WebGran plan ensured in DB!');
}

main().catch(console.error);
