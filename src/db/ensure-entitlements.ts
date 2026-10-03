import { db } from '@/db';
import { features, planFeatures, subscriptionPlans } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { getDefaultPlan } from '@/lib/billing/subscription-service';

export interface SeedFeatureDefinition {
  key: string;
  name: string;
  description: string;
  type: 'BOOLEAN' | 'LIMIT' | 'QUOTA';
  category: string;
  defaultValue: { value: boolean | number };
  planValue: { value: boolean | number };
}

export const INITIAL_FEATURES: SeedFeatureDefinition[] = [
  {
    key: 'max_products',
    name: 'Limite de Produtos',
    description: 'Quantidade máxima de produtos cadastrados no catálogo',
    type: 'LIMIT',
    category: 'catalog',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'max_categories',
    name: 'Limite de Categorias',
    description: 'Quantidade máxima de categorias de produtos',
    type: 'LIMIT',
    category: 'catalog',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'max_product_carousels',
    name: 'Limite de Carrosséis',
    description: 'Quantidade máxima de carrosséis na loja',
    type: 'LIMIT',
    category: 'catalog',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'max_stores',
    name: 'Limite de Lojas',
    description: 'Quantidade máxima de lojas que o vendedor pode possuir',
    type: 'LIMIT',
    category: 'management',
    defaultValue: { value: 1 },
    planValue: { value: 1 },
  },
  {
    key: 'max_orders_per_month',
    name: 'Limite de Pedidos por Mês',
    description: 'Quantidade máxima de pedidos que o vendedor pode receber no mês-calendário atual (-1 para ilimitado)',
    type: 'LIMIT',
    category: 'management',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'financial_reports_enabled',
    name: 'Relatórios Financeiros',
    description: 'Permite ao vendedor acessar os relatórios financeiros da loja',
    type: 'BOOLEAN',
    category: 'management',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'telegram_bot',
    name: 'Bot Telegram Próprio',
    description: 'Permite integrar Bot Telegram próprio da loja',
    type: 'BOOLEAN',
    category: 'integrations',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'welcome_bot_message_enabled',
    name: 'Boas-Vindas do Bot Telegram',
    description: 'Permite ao vendedor configurar e utilizar mensagens de boas-vindas personalizadas no bot do Telegram',
    type: 'BOOLEAN',
    category: 'integrations',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'max_telegram_bot_chats',
    name: 'Limite de Grupos/Canais no Bot',
    description: 'Quantidade máxima de grupos e canais vinculados ao Bot',
    type: 'LIMIT',
    category: 'integrations',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'clips_enabled',
    name: 'Módulo de Clips (Vídeos)',
    description: 'Permite publicar vídeos curtos (Clips) na loja',
    type: 'BOOLEAN',
    category: 'media',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'max_clips',
    name: 'Limite de Clips',
    description: 'Quantidade máxima de vídeos cadastrados',
    type: 'LIMIT',
    category: 'media',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'max_video_size_mb',
    name: 'Tamanho Máximo por Vídeo (MB)',
    description: 'Tamanho máximo individual por arquivo de vídeo em MB',
    type: 'LIMIT',
    category: 'media',
    defaultValue: { value: 500 },
    planValue: { value: 500 },
  },
  {
    key: 'product_videos_enabled',
    name: 'Módulo de Product Videos',
    description: 'Permite cadastrar e disponibilizar vídeos vinculados a produtos',
    type: 'BOOLEAN',
    category: 'media',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'max_product_videos',
    name: 'Limite de Product Videos',
    description: 'Quantidade máxima de vídeos de produtos cadastrados na loja (-1 para ilimitado)',
    type: 'LIMIT',
    category: 'media',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'max_banners',
    name: 'Limite de Banners',
    description: 'Quantidade máxima de banners promocionais na loja',
    type: 'LIMIT',
    category: 'marketing',
    defaultValue: { value: 5 },
    planValue: { value: 5 },
  },
  {
    key: 'coupons_enabled',
    name: 'Cupons de Desconto',
    description: 'Permite criar cupons de desconto',
    type: 'BOOLEAN',
    category: 'marketing',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'max_coupons',
    name: 'Limite de Cupons de Desconto Ativos',
    description: 'Quantidade máxima de cupons de desconto ativos na loja (-1 para ilimitado)',
    type: 'LIMIT',
    category: 'marketing',
    defaultValue: { value: -1 },
    planValue: { value: -1 },
  },
  {
    key: 'floating_notifications_enabled',
    name: 'Notificações Flutuantes de Vendas',
    description: 'Exibe notificações de escassez e compras recentes na loja',
    type: 'BOOLEAN',
    category: 'marketing',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'custom_theme_enabled',
    name: 'Personalização de Tema Studio',
    description: 'Permite personalizar temas visuais e branding da loja',
    type: 'BOOLEAN',
    category: 'customization',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'payment_gateways_enabled',
    name: 'Gateways de Pagamento',
    description: 'Permite conectar PushinPay e Mercado Pago próprio',
    type: 'BOOLEAN',
    category: 'payments',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'analytics_reports_enabled',
    name: 'Relatórios e Métricas Avançadas',
    description: 'Acesso aos dados analíticos de desempenho da loja',
    type: 'BOOLEAN',
    category: 'analytics',
    defaultValue: { value: true },
    planValue: { value: true },
  },
  {
    key: 'storage_quota_gb',
    name: 'Cota de Armazenamento (GB)',
    description: 'Espaço total de armazenamento de mídia/vídeo em GB',
    type: 'QUOTA',
    category: 'media',
    defaultValue: { value: 100 },
    planValue: { value: 100 },
  },
  {
    key: 'video_bandwidth_quota_gb',
    name: 'Cota de Tráfego de Vídeo (GB)',
    description: 'Tráfego mensal de saída de vídeo via CDN em GB',
    type: 'QUOTA',
    category: 'media',
    defaultValue: { value: 1000 },
    planValue: { value: 1000 },
  },
];

let entitlementsEnsured = false;

export async function ensureEntitlementTablesAndSeed() {
  if (entitlementsEnsured) return;

  try {
    // 1. Create tables if they do not exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        default_value JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
        feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        value JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT plan_features_plan_id_feature_id_unique UNIQUE (plan_id, feature_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seller_feature_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        override_value JSONB NOT NULL,
        reason TEXT,
        expires_at TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT seller_feature_overrides_seller_id_feature_id_unique UNIQUE (seller_id, feature_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pending_deletions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        path TEXT NOT NULL,
        resource_id TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        scheduled_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS seller_storage_usage (
        seller_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        used_bytes BIGINT NOT NULL DEFAULT 0,
        reserved_bytes BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS storage_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        reference_type TEXT NOT NULL,
        reference_id TEXT,
        requested_bytes BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch default WebGran plan
    const defaultPlan = await getDefaultPlan();

    // 3. Upsert features and plan_features idempotently
    for (const featDef of INITIAL_FEATURES) {
      let featureRecord = await db.query.features.findFirst({
        where: eq(features.key, featDef.key),
      });

      if (!featureRecord) {
        const inserted = await db
          .insert(features)
          .values({
            key: featDef.key,
            name: featDef.name,
            description: featDef.description,
            type: featDef.type,
            category: featDef.category,
            defaultValue: featDef.defaultValue,
            isActive: true,
          })
          .returning();
        featureRecord = inserted[0];
      }

      // Link feature to default plan idempotently
      if (featureRecord && defaultPlan) {
        const existingPlanFeature = await db.query.planFeatures.findFirst({
          where: and(
            eq(planFeatures.planId, defaultPlan.id),
            eq(planFeatures.featureId, featureRecord.id)
          ),
        });

        if (!existingPlanFeature) {
          await db.insert(planFeatures).values({
            planId: defaultPlan.id,
            featureId: featureRecord.id,
            value: featDef.planValue,
          });
        }
      }
    }

    entitlementsEnsured = true;
  } catch (err) {
    console.error('Error ensuring entitlement tables and seed:', err);
    throw err;
  }
}
