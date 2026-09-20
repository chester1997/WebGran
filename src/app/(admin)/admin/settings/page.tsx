import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { themes, subscriptionPlans, systemSettings } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import AdminSettingsClient from "./AdminSettingsClient";

export default async function AdminSettingsPage() {
  const user = await requireAdmin();

  // 1. Fetch Subscription Plans
  const plansData = await db.query.subscriptionPlans.findMany({
    orderBy: [desc(subscriptionPlans.createdAt)]
  });

  const formattedPlans = plansData.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price).toFixed(2),
    description: p.description,
    billingInterval: p.billingInterval,
    active: p.active
  }));

  // 2. Fetch Default Theme
  const defaultThemeData = await db.query.themes.findFirst({
    where: eq(themes.isDefault, true)
  });

  const formattedTheme = defaultThemeData
    ? { name: defaultThemeData.name, slug: defaultThemeData.slug }
    : null;

  // 3. Fetch System Settings for Cora
  const settingsData = await db.query.systemSettings.findMany({
    where: inArray(systemSettings.key, ['cora_client_id', 'cora_client_secret', 'cora_environment'])
  });

  const settingsMap = new Map(settingsData.map((s) => [s.key, s.value]));
  const clientId = settingsMap.get('cora_client_id') || process.env.CORA_CLIENT_ID || '';
  const hasSecret = Boolean(settingsMap.get('cora_client_secret') || process.env.CORA_CLIENT_SECRET);
  const environment = settingsMap.get('cora_environment') || process.env.CORA_ENV || 'production';

  const formattedCora = {
    clientId,
    hasSecret,
    environment,
    isConnected: Boolean(clientId && hasSecret)
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
