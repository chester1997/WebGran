export const instant = false;
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { themes, subscriptionPlans } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { mercadoPagoPlatformProvider } from "@/lib/payments/providers/mercado-pago-platform";
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

  // 3. Fetch Mercado Pago Platform Connection Status
  const platformMpStatus = await mercadoPagoPlatformProvider.getPlatformStatus();

  return (
    <AdminSettingsClient
      user={user}
      initialPlans={formattedPlans}
      defaultTheme={formattedTheme}
      initialMercadoPago={{
        isConnected: platformMpStatus.isConnected,
        status: platformMpStatus.status,
        mpUserId: platformMpStatus.mpUserId,
        mpUserEmail: platformMpStatus.mpUserEmail,
        connectedAt: platformMpStatus.connectedAt,
        updatedAt: platformMpStatus.updatedAt,
      }}
    />
  );
}
