import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { themes, subscriptionPlans, systemSettings } from "@/db/schema";
import { eq, inArray, desc, sql } from "drizzle-orm";
import AdminSettingsClient from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  const user = await requireAdmin();

  // 1. Fetch Subscription Plans safely
  let plansData: any[] = [];
  try {
    plansData = await db.query.subscriptionPlans.findMany({
      orderBy: [desc(subscriptionPlans.createdAt)]
    });
  } catch (err) {
    console.warn("subscription_plans query failed, ensuring table exists...", err);
    try {
      await db.execute(sql`
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
      `);
      await db.execute(sql`
        INSERT INTO subscription_plans (name, slug, description, price, billing_interval, active)
        VALUES ('WebGran', 'webgran', 'Plano Único WebGran SaaS', 89.90, 'month', true)
        ON CONFLICT (slug) DO NOTHING;
      `);
      plansData = await db.query.subscriptionPlans.findMany({
        orderBy: [desc(subscriptionPlans.createdAt)]
      });
    } catch (createErr) {
      console.error("Failed to auto-create subscription_plans:", createErr);
    }
  }

  const formattedPlans = plansData.length > 0 
    ? plansData.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price).toFixed(2),
        description: p.description,
        billingInterval: p.billingInterval,
        active: p.active
      }))
    : [{
        id: "webgran",
        name: "WebGran",
        slug: "webgran",
        price: "89.90",
        description: "Plano Único WebGran SaaS",
        billingInterval: "month",
        active: true
      }];

  // 2. Fetch Default Theme safely
  let formattedTheme = null;
  try {
    const defaultThemeData = await db.query.themes.findFirst({
      where: eq(themes.isDefault, true)
    });
    if (defaultThemeData) {
      formattedTheme = { name: defaultThemeData.name, slug: defaultThemeData.slug };
    }
  } catch (err) {
    console.warn("Default theme query error:", err);
  }

  // 3. Fetch System Settings for Cora safely
  let settingsData: any[] = [];
  try {
    settingsData = await db.query.systemSettings.findMany({
      where: inArray(systemSettings.key, [
        'cora_client_id', 
        'cora_cert_pem', 
        'cora_key_pem', 
        'cora_environment',
        'cora_last_verified_at'
      ])
    });
  } catch (err) {
    console.warn("system_settings query failed, ensuring table exists...", err);
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS system_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    } catch (createErr) {
      console.error("Failed to auto-create system_settings:", createErr);
    }
  }

  const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
  const clientId = settingsMap.get('cora_client_id') || process.env.CORA_CLIENT_ID || '';
  const hasCert = Boolean(settingsMap.get('cora_cert_pem') || process.env.CORA_CERT_PEM);
  const hasKey = Boolean(settingsMap.get('cora_key_pem') || process.env.CORA_KEY_PEM);
  const environment = settingsMap.get('cora_environment') || process.env.CORA_ENV || 'production';
  const lastVerifiedAt = settingsMap.get('cora_last_verified_at') || null;

  function maskClientId(id: string): string {
    if (!id) return '';
    if (id.length <= 4) return '••••';
    return `••••${id.slice(-4)}`;
  }

  const formattedCora = {
    clientIdMasked: clientId ? maskClientId(clientId) : '',
    hasCert,
    hasKey,
    environment,
    lastVerifiedAt,
    isConnected: Boolean(clientId && hasCert && hasKey)
  };

  return (
    <AdminSettingsClient
      user={user}
      initialPlans={formattedPlans}
      defaultTheme={formattedTheme}
      initialCora={formattedCora}
    />
  );
}
